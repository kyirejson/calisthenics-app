import AsyncStorage from '@react-native-async-storage/async-storage';
import { emptyRun, usablePoint, analyseRun, cleanRunOptions, defaultRunOptions, type RunOptions, type RunSnapshot, type RunPoint, type RunMode } from './model';
import { MotionGate } from './motionGate';
import { webRunVoice, stopWebRunVoice } from './webVoice';
import { browserLocationError, browserPositionValid } from './browserLocation';
import { kilometreAnnouncement } from './kilometreAnnouncement';
import { cleanRunVoiceStyle, type RunVoiceStyle } from './voiceClips';

// Browser-only adapter. Refresh restores a pause; it never counts a closed page.
const KEY = 'uncover.running.web-journal.v2';
const OPTIONS = 'uncover.running.options.v1';
const motion = new MotionGate();
let options = defaultRunOptions(), spokenKm = 0;
let state = emptyRun(), loaded = false, storageCorrupt = false, watch: number | null = null, base = 0, activeSince = 0, segment = 0, lastTimestamp = 0, generation = 0, lastCheckpoint = 0;
let pending: Promise<unknown> = Promise.resolve();
const monotonic = () => typeof performance === 'undefined' ? Date.now() : performance.now();
const elapsed = () => base + (activeSince ? Math.max(0, monotonic() - activeSince) : 0);
async function persist() {
  const serialized = JSON.stringify({ ...state, elapsedMs: elapsed(), spokenKm });
  const operation = pending.catch(() => undefined).then(() => AsyncStorage.setItem(KEY, serialized));
  pending = operation; await operation;
}
async function load() {
  if (loaded) return;
  const savedOptions = await AsyncStorage.getItem(OPTIONS);
  if (savedOptions) options = cleanRunOptions(JSON.parse(savedOptions));
  const raw = await AsyncStorage.getItem(KEY);
  if (raw) {
    try {
      const saved = JSON.parse(raw) as RunSnapshot & { spokenKm?: number };
      if (!saved.id || !Array.isArray(saved.samples) || !Number.isFinite(saved.elapsedMs) || !['running', 'paused', 'finished'].includes(saved.phase)) throw Error();
      if (saved.mode !== undefined && !['outdoor', 'indoor'].includes(saved.mode)) throw Error();
      if (saved.manualDistanceKm !== undefined && (!Number.isFinite(saved.manualDistanceKm) || saved.manualDistanceKm < 0 || saved.manualDistanceKm > 1000)) throw Error();
      const { spokenKm: savedSpokenKm, ...restored } = saved;
      state = { ...restored, phase: saved.phase === 'running' ? 'paused' : saved.phase, interrupted: saved.phase === 'running' || saved.autoPaused, autoPaused: false, preview: null, mapPosition: null, locationError: '' };
      const distanceKm = Math.floor(analyseRun(saved.samples).distanceM / 1000);
      spokenKm = Number.isSafeInteger(savedSpokenKm) && savedSpokenKm! >= 0 ? Math.min(savedSpokenKm!, distanceKm) : distanceKm;
      base = Math.max(0, saved.elapsedMs); segment = (saved.samples.at(-1)?.segment || 0) + 1;
    } catch { storageCorrupt = true; state.error = '本机跑步草稿无法读取，未覆盖原文件。'; }
  }
  loaded = true;
}
function speak(text: string) { return state.options?.voice ? webRunVoice(text, issue => { state.featureIssue = issue; }, state.options.voiceStyle ?? 'female') : false; }
function automaticMotion(point: RunPoint, speed: number | null | undefined) {
  if (!state.options?.autoPause || state.mode === 'indoor' || state.phase !== 'running' && !state.autoPaused) return;
  const change = motion.update(point.timestamp, speed, point.accuracy, !!state.autoPaused);
  if (change === 'pause') { base = elapsed(); activeSince = 0; state.phase = 'paused'; state.autoPaused = true; segment++; speak('已自动暂停，重新跑动后继续'); }
  if (change === 'resume') { activeSince = monotonic(); state.phase = 'running'; state.autoPaused = false; speak('已自动继续跑步'); }
  return change;
}
function announceProgress() {
  if (state.phase !== 'running' || !state.options?.voice) return;
  const elapsedMs = elapsed(), analysis = analyseRun(state.samples);
  const partial = elapsedMs - analysis.trackedMs > Math.max(15000, elapsedMs * .1);
  const announcement = kilometreAnnouncement(analysis.distanceM, elapsedMs, spokenKm, 'location', partial);
  if (announcement && speak(announcement.text)) spokenKm = announcement.km;
}
function stopPreview() { generation++; if (watch !== null && typeof navigator !== 'undefined') navigator.geolocation?.clearWatch(watch); watch = null; }
async function preview() {
  await load(); stopPreview();
  if (storageCorrupt) throw Error(state.error);
  if (typeof navigator === 'undefined' || !navigator.geolocation) throw Error('当前浏览器不支持定位。');
  if (typeof isSecureContext !== 'undefined' && !isSecureContext) throw Error('浏览器定位需要 HTTPS 或本机 localhost。');
  state.locationError = '';
  const ownGeneration = generation;
  let preciseError = '', approximateError = '';
  const report = () => { if (generation === ownGeneration) state.locationError = [preciseError, approximateError].filter(Boolean).join(' ') + '计时不受影响；不会用虚构位置替代当前坐标。'; };
  const receive = (position: GeolocationPosition, mapOnly: boolean) => {
    if (generation !== ownGeneration) return;
    if (!browserPositionValid(position)) {
      const message = '浏览器返回无效或超过两分钟的坐标，未采用。';
      if (mapOnly) approximateError = message; else preciseError = message;
      report(); return;
    }
    const age = Math.max(0, Date.now() - position.timestamp);
    const point: RunPoint = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, timestamp: position.timestamp, elapsedMs: elapsed(), segment, provider: mapOnly ? 'browser-preview' : 'browser', cached: age > 15000 };
    // A quick approximate/cached fix is map-only. Never replace a fresh, more
    // accurate tracking position with a late, coarse preview callback.
    const displayed = state.mapPosition;
    if (!displayed || point.timestamp >= displayed.timestamp && (Date.now() - displayed.timestamp > 15000 || !mapOnly || point.accuracy < displayed.accuracy)) state.mapPosition = point;
    if (mapOnly) { approximateError = ''; state.locationError = preciseError; return; }
    preciseError = ''; state.locationError = '';
    if (!state.preview || point.timestamp >= state.preview.timestamp) state.preview = point;
    if (age > 15000 || point.timestamp <= lastTimestamp) return;
    lastTimestamp = point.timestamp;
    const transition = automaticMotion(point, position.coords.speed);
    point.elapsedMs = elapsed(); point.segment = segment;
    if (state.phase === 'running') { state.samples.push(point); state.sampleCount = state.samples.length; }
    if (state.phase === 'running' || transition) void persist().catch(() => { base = elapsed(); activeSince = 0; state.phase = 'paused'; state.autoPaused = false; state.error = '草稿保存失败，已暂停以保护记录。'; });
  };
  // Fast map preview runs alongside the tracking request, not instead of it.
  // Browser providers may share a backend; failure of both is still reported.
  if (navigator.geolocation.getCurrentPosition) {
    try { navigator.geolocation.getCurrentPosition(position => receive(position, true), failure => { approximateError = browserLocationError(failure, '大致位置请求'); report(); }, { enableHighAccuracy: false, maximumAge: 60000, timeout: 12000 }); }
    catch (failure) { approximateError = failure instanceof Error ? failure.message : '大致位置请求启动失败。'; report(); }
  }
  watch = navigator.geolocation.watchPosition(position => {
    receive(position, false);
  }, failure => { preciseError = browserLocationError(failure, '连续定位请求'); report(); }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
}
async function updateVoice(patch: { voice?: boolean; voiceStyle?: RunVoiceStyle }) {
  await load();
  if (storageCorrupt) throw Error(state.error);
  const previousOptions = options, previousState = state, previousSpoken = spokenKm;
  const next = cleanRunOptions({ ...options, ...patch });
  await AsyncStorage.setItem(OPTIONS, JSON.stringify(next));
  options = next;
  if (state.phase !== 'idle') {
    const wasEnabled = state.options?.voice;
    state = { ...state, options: cleanRunOptions({ ...(state.options ?? previousOptions), ...patch }) };
    if (patch.voice === true && !wasEnabled) spokenKm = Math.max(spokenKm, Math.floor(analyseRun(state.samples).distanceM / 1000));
    try { await persist(); } catch (failure) { options = previousOptions; state = previousState; spokenKm = previousSpoken; await AsyncStorage.setItem(OPTIONS, JSON.stringify(previousOptions)); throw failure; }
  }
  if (patch.voice === false || patch.voiceStyle !== undefined) stopWebRunVoice();
  state.featureIssue = '';
}
export const browserRunning = {
  snapshot: async (after: number): Promise<RunSnapshot> => {
    await load();
    announceProgress();
    if (state.phase === 'running' && monotonic() - lastCheckpoint >= 5000) {
      lastCheckpoint = monotonic();
      try { await persist(); } catch { base = elapsed(); activeSince = 0; state.phase = 'paused'; state.error = '草稿保存失败，已暂停以保护记录。'; }
    }
    const ageMs = state.preview ? Math.max(0, Date.now() - state.preview.timestamp) : 0;
    return { ...state, options: state.options ?? options, stepAvailable: false, elapsedMs: elapsed(), preview: state.preview ? { ...state.preview, ageMs } : null, mapPosition: state.mapPosition ? { ...state.mapPosition, ageMs: Math.max(0, Date.now() - state.mapPosition.timestamp) } : null, samples: state.samples.slice(Math.max(0, after)), sampleCount: state.samples.length };
  },
  configure: async (value: RunOptions) => {
    await load(); if (state.phase !== 'idle') throw Error('请先结束本次跑步，再调整记录设置。');
    const next = cleanRunOptions(value); if (next.stepTracking) throw Error('浏览器不提供可靠的计步传感器，请使用 Android 安装包。');
    await AsyncStorage.setItem(OPTIONS, JSON.stringify(next)); options = next;
  },
  setVoice: async (enabled: boolean) => {
    if (typeof enabled !== 'boolean') throw Error('语音开关无效。');
    await updateVoice({ voice: enabled });
  },
  setVoiceStyle: async (style: RunVoiceStyle) => { await updateVoice({ voiceStyle: cleanRunVoiceStyle(style) }); },
  preview, stopPreview: async () => { if (state.phase !== 'running' && !state.autoPaused) stopPreview(); },
  start: async (id: string, mode: RunMode = 'outdoor') => {
    await load();
    if (state.phase !== 'idle' || storageCorrupt) throw Error(state.error || '请先处理上次跑步。');
    if (!['outdoor', 'indoor'].includes(mode)) throw Error('跑步模式无效。');
    const first = state.preview, firstMap = state.mapPosition;
    stopPreview();
    state = { ...emptyRun(), options, id, mode, startedAt: Date.now(), phase: 'running', preview: mode === 'outdoor' ? first : null, mapPosition: mode === 'outdoor' ? firstMap : null }; base = 0; activeSince = monotonic(); segment = 0; motion.reset(); spokenKm = 0;
    if (mode === 'outdoor' && usablePoint(first) && Date.now() - first!.timestamp >= 0 && Date.now() - first!.timestamp <= 15000) state.samples.push({ ...first!, elapsedMs: 0, segment });
    try { await persist(); } catch (error) { base = elapsed(); activeSince = 0; state.phase = 'paused'; throw error; }
    speak('开始跑步');
    if (mode === 'outdoor') await preview().catch(error => { state.locationError = error instanceof Error ? error.message : '定位不可用，计时仍在继续。'; });
  },
  pause: async () => { if (state.phase !== 'running' && !state.autoPaused) return; if (state.phase === 'running') { base = elapsed(); activeSince = 0; segment++; } state.phase = 'paused'; state.autoPaused = false; motion.reset(); stopPreview(); await persist(); speak('跑步已暂停'); },
  resume: async () => {
    if (state.phase !== 'paused') throw Error('跑步状态已变化。');
    activeSince = monotonic(); state.phase = 'running'; state.autoPaused = false; state.error = ''; motion.reset();
    try { await persist(); } catch (error) { base = elapsed(); activeSince = 0; state.phase = 'paused'; throw error; }
    if (state.mode !== 'indoor') await preview().catch(error => { state.locationError = error instanceof Error ? error.message : '定位不可用，计时仍在继续。'; });
    speak('继续跑步');
  },
  finish: async (distance?: number) => {
    if (state.phase === 'idle') throw Error('没有正在记录的跑步。');
    if (distance !== undefined) {
      if (!Number.isFinite(distance) || distance < 0 || distance > 1000) throw Error('请输入 0–1000 公里之间的有效距离。');
      state.manualDistanceKm = distance;
    }
    if (state.phase !== 'finished') { base = elapsed(); activeSince = 0; state.phase = 'finished'; state.autoPaused = false; state.completedAt = Date.now(); stopPreview(); stopWebRunVoice(); }
    await persist();
  },
  acknowledge: async (id: string) => { if (state.id !== id || state.phase !== 'finished') return; await pending.catch(() => undefined); await AsyncStorage.removeItem(KEY); state = { ...emptyRun(), preview: state.preview, mapPosition: state.mapPosition }; base = 0; },
  clear: async () => { stopPreview(); stopWebRunVoice(); motion.reset(); await pending.catch(() => undefined); await AsyncStorage.removeItem(KEY); await AsyncStorage.removeItem(OPTIONS); options = defaultRunOptions(); state = emptyRun(); base = 0; activeSince = 0; loaded = true; storageCorrupt = false; lastTimestamp = 0; },
};
