import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, PermissionsAndroid, Platform, View } from 'react-native';
import { useAppStore } from '../store/AppStore';
import { useUpdateBlock } from '../components/AppUpdates';
import { analyseRun, cleanRunOptions, emptyRun, toRunSession, type RunOptions, type RunSnapshot, type RunMode } from './model';
import { configureRunOptions, runningInsets, runningSupported, runningTransport as transport } from './transport';
import { locationStatus } from './locationStatus';

type RunContext = { snapshot: RunSnapshot; analysis: ReturnType<typeof analyseRun>; busy: boolean; ready: boolean; error: string; location: ReturnType<typeof locationStatus>; locate: () => Promise<void>; stopPreview: () => void; configure: (options: RunOptions) => Promise<boolean>; start: (mode?: RunMode) => Promise<void>; pause: () => Promise<boolean>; resume: () => Promise<void>; save: (distance?: number) => Promise<void> };
const Context = createContext<RunContext | null>(null);
export function useRunRecorder() { const value = useContext(Context); if (!value) throw Error('Missing RunRecorderHost'); return value; }
export function RunRecorderHost({ children }: { children: React.ReactNode }) {
  const { ready: storeReady, saveSession } = useAppStore(state => ({ ready: state.ready, saveSession: state.saveSession }));
  const [snapshot, setSnapshot] = useState(emptyRun), [error, setError] = useState(''), [busy, setBusy] = useState(false), [ready, setReady] = useState(false);
  const [insets, setInsets] = useState({ top: 0, bottom: 0 });
  const previewWanted = useRef(false), previewStarted = useRef(0);
  const locationFailure = useRef(false);
  const current = useRef(snapshot), locked = useRef(false), fetching = useRef<Promise<RunSnapshot> | null>(null), mounted = useRef(true);
  useUpdateBlock(snapshot.phase !== 'idle');
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let active = true;
    const updateInsets = () => { void runningInsets().then(value => { if (active) setInsets(value); }).catch(() => undefined); };
    updateInsets(); const timer = setTimeout(updateInsets, 500);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') updateInsets(); });
    return () => { active = false; clearTimeout(timer); subscription.remove(); };
  }, []);
  const refresh = useCallback(async (): Promise<RunSnapshot> => {
    if (!runningSupported) {
      if (mounted.current) { setReady(true); setError(Platform.OS === 'android' ? '此安装包不含跑步定位模块，请安装新版 APK。' : '跑步后台定位目前支持 Android；浏览器可前台记录。'); }
      return current.current;
    }
    if (fetching.current) return fetching.current;
    const operation = (async () => {
      let next = await transport.snapshot(current.current.sampleCount);
      if (next.id !== current.current.id) next = await transport.snapshot(0);
      const samples = next.id === current.current.id && next.sampleCount >= current.current.sampleCount ? (next.samples.length ? [...current.current.samples, ...next.samples] : current.current.samples) : next.samples;
      next = { ...next, samples, sampleCount: samples.length };
      current.current = next; if (mounted.current) {
        setSnapshot(next); setReady(true);
        if (locationFailure.current && locationStatus(next).good) { locationFailure.current = false; setError(''); }
      }
      return next;
    })();
    fetching.current = operation;
    try { return await operation; } finally { fetching.current = null; }
  }, []);
  useEffect(() => {
    mounted.current = true;
    if (!storeReady) return;
    const poll = () => { void refresh().catch(() => { if (mounted.current) setError('无法读取跑步记录，请返回跑步页重试。'); }); };
    poll(); const timer = setInterval(poll, 1000);
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') { void transport.stopPreview().catch(() => undefined); return; }
      if (previewWanted.current && current.current.phase === 'idle' && !locked.current) {
        previewStarted.current = Date.now();
        void transport.preview().then(() => { if (mounted.current) setError(''); poll(); }).catch(failure => { locationFailure.current = true; if (mounted.current) setError(failure instanceof Error ? failure.message : '恢复定位请求失败，请重试。'); });
      } else poll();
    });
    return () => { mounted.current = false; clearInterval(timer); subscription.remove(); };
  }, [storeReady, refresh]);
  const action = async (operation: () => Promise<void>, isLocationAction = false) => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(''); locationFailure.current = false;
    try { await operation(); await refresh(); } catch (failure) { locationFailure.current = isLocationAction; setError(failure instanceof Error ? failure.message : '操作失败，请重试。'); } finally { locked.current = false; if (mounted.current) setBusy(false); }
  };
  const permission = async () => {
    if (!runningSupported) throw Error('当前安装包尚未包含 Android 跑步定位模块，需要安装新版 APK。');
    if (Platform.OS !== 'android') return;
    const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
    if (!await PermissionsAndroid.check(fine)) {
      const granted = await PermissionsAndroid.requestMultiple([PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION, fine]);
      if (granted[fine] !== PermissionsAndroid.RESULTS.GRANTED && granted[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] !== PermissionsAndroid.RESULTS.GRANTED) throw Error('位置权限未开启；仍可开始计时，开启权限后可记录轨迹。');
    }
  };
  const requestPreview = async () => { previewWanted.current = true; previewStarted.current = Date.now(); await transport.preview(); await refresh(); };
  const locate = () => action(async () => { await permission(); await requestPreview(); }, true);
  const waitPhase = async (phase: RunSnapshot['phase']) => {
    for (let attempt = 0; attempt < 25; attempt++) {
      const next = await refresh(); if (next.phase === phase) return next;
      if (next.error) throw Error(next.error);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw Error('跑步记录服务未响应，请重试。');
  };
  const start = (mode: RunMode = 'outdoor') => action(async () => {
    if (!runningSupported) throw Error('当前安装包不含跑步记录模块，请安装新版 APK。');
    if (mode === 'outdoor') await permission().catch(() => undefined); // Denial disables positioning, not the stopwatch.
    if (Platform.OS === 'android' && Number(Platform.Version) >= 33) { try { await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS); } catch { /* Notification refusal must not crash GPS. */ } }
    await transport.start(`run_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`, mode); await waitPhase('running'); previewWanted.current = false;
  });
  const configure = async (value: RunOptions) => {
    let saved = false;
    await action(async () => {
      const options = cleanRunOptions(value);
      if (options.stepTracking) {
        if (current.current.stepAvailable !== true) throw Error('当前设备未提供可用的计步传感器，仍可计时并手动填写距离。');
        if (Platform.OS === 'android' && Number(Platform.Version) >= 29) {
          const activity = PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION;
          if (!await PermissionsAndroid.check(activity) && await PermissionsAndroid.request(activity) !== PermissionsAndroid.RESULTS.GRANTED)
            throw Error('未授权身体活动权限，计步未启用；仍可使用计时和手动距离。');
        }
      }
      await configureRunOptions(options); saved = true;
    });
    return saved;
  };
  const pause = async () => {
    let paused = false;
    await action(async () => { await transport.pause(); await waitPhase('paused'); paused = true; });
    return paused;
  };
  const resume = () => action(async () => { await transport.resume(); await waitPhase('running'); });
  const save = (distance?: number) => action(async () => {
    if (distance !== undefined && (!Number.isFinite(distance) || distance < 0 || distance > 1000)) throw Error('请输入 0–1000 公里之间的有效距离。');
    await transport.finish(distance); const finished = await waitPhase('finished');
    await saveSession(toRunSession(finished)); // Stable ID: retry replaces the same record, never duplicates.
    await transport.acknowledge(finished.id!); await refresh();
    if (finished.mode !== 'indoor') await requestPreview().catch(() => undefined);
  });
  const analysis = useMemo(() => analyseRun(snapshot.samples), [snapshot.samples]);
  const stopPreview = useCallback(() => { previewWanted.current = false; void transport.stopPreview().catch(() => undefined); }, []);
  const location = locationStatus(snapshot, previewWanted.current, previewStarted.current ? Date.now() - previewStarted.current : 0);
  return <Context.Provider value={{ snapshot, analysis, error: error || snapshot.error || snapshot.featureIssue || '', location, busy, ready, locate, stopPreview, configure, start, pause, resume, save }}>{Platform.OS === 'android' ? <View style={{ flex: 1, backgroundColor: '#0D1114', paddingTop: insets.top, paddingBottom: insets.bottom }}><View style={{ flex: 1 }}>{children}</View></View> : children}</Context.Provider>;
}
