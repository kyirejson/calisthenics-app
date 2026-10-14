import type { TrainingSession } from '../types';
import { cleanRunVoiceStyle, type RunVoiceStyle } from './voiceClips';

export type RunPhase = 'idle' | 'running' | 'paused' | 'finished';
export type RunMode = 'outdoor' | 'indoor';
export type RunPoint = { latitude: number; longitude: number; accuracy: number; timestamp: number; elapsedMs: number; segment: number; ageMs?: number; monotonicNanos?: number; provider?: string; cached?: boolean };
export type LocationDiagnostics = { permission: boolean; providerAvailable: boolean; enabled: boolean; listening: boolean; waitMs: number; satellites: number | null; usedSatellites: number | null; satelliteAgeMs: number | null; rejection: string; requestError: string; gpsListening?: boolean; systemEnabled?: boolean; auxiliaryProviders?: string[]; providerErrors?: Record<string, string>; networkAvailable?: boolean; networkEnabled?: boolean };
export type RunOptions = { autoPause: boolean; voice: boolean; voiceStyle?: RunVoiceStyle; stepTracking: boolean; stepLengthM?: number };
export const defaultRunOptions = (): RunOptions => ({ autoPause: false, voice: true, voiceStyle: 'female', stepTracking: false });
export function cleanRunOptions(value: RunOptions): RunOptions {
  if (!value || ['autoPause', 'voice', 'stepTracking'].some(key => typeof value[key as keyof RunOptions] !== 'boolean')) throw Error('跑步设置无效。');
  if (value.stepLengthM !== undefined && (!Number.isFinite(value.stepLengthM) || value.stepLengthM < .3 || value.stepLengthM > 2)) throw Error('校准步长应为 0.3–2 米/步。');
  return { autoPause: value.autoPause, voice: value.voice, voiceStyle: cleanRunVoiceStyle(value.voiceStyle), stepTracking: value.stepTracking, ...(value.stepLengthM === undefined ? {} : { stepLengthM: value.stepLengthM }) };
}
export type RunSnapshot = { phase: RunPhase; mode?: RunMode; manualDistanceKm?: number; id?: string; startedAt?: number; completedAt?: number; elapsedMs: number; error: string; locationError?: string; preview: RunPoint | null; mapPosition?: RunPoint | null; samples: RunPoint[]; sampleCount: number; interrupted?: boolean; location?: LocationDiagnostics; options?: RunOptions; autoPaused?: boolean; stepAvailable?: boolean; stepCount?: number; stepDistanceM?: number; stepCurrentPace?: number; stepPartial?: boolean; featureIssue?: string };
export const emptyRun = (): RunSnapshot => ({ phase: 'idle', elapsedMs: 0, error: '', preview: null, samples: [], sampleCount: 0 });
/** Mileage policy only. Never use this to gate starting a stopwatch. */
export function usablePoint(point: RunPoint | null | undefined) {
  return !!point && !point.cached && (!point.provider || ['gps', 'fused', 'browser'].includes(point.provider)) && (point.ageMs === undefined || Number.isFinite(point.ageMs) && point.ageMs >= 0 && point.ageMs <= 15000) && Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90 && Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180 && Number.isFinite(point.accuracy) && point.accuracy >= 0 && point.accuracy <= 35;
}
export function metresBetween(a: Pick<RunPoint, 'latitude' | 'longitude'>, b: Pick<RunPoint, 'latitude' | 'longitude'>) {
  const radians = Math.PI / 180, x = Math.sin((b.latitude - a.latitude) * radians / 2), y = Math.sin((b.longitude - a.longitude) * radians / 2);
  const h = Math.min(1, x * x + Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians) * y * y);
  return 6371008.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Same calculation for real Android fixes and browser fixes. Never interpolate gaps. */
export function analyseRun(samples: readonly RunPoint[]) {
  const segments: RunPoint[][] = [], splits: Array<{ km: number; latitude: number; longitude: number; elapsedMs: number }> = [];
  let anchor: RunPoint | null = null, observed: RunPoint | null = null, broken = true, distanceM = 0, trackedMs = 0;
  for (const point of samples) {
    if (!usablePoint(point) || !Number.isFinite(point.elapsedMs) || !Number.isFinite(point.timestamp)) { broken = true; observed = null; continue; }
    // Android fixes have a monotonic clock: changing the phone's wall clock must
    // not silently stop mileage. Browsers fall back to their GPS timestamps.
    const previousFix = observed ?? anchor;
    const unordered = previousFix && (Number.isFinite(point.monotonicNanos) && Number.isFinite(previousFix.monotonicNanos)
      ? point.monotonicNanos! <= previousFix.monotonicNanos! : point.timestamp <= previousFix.timestamp);
    if (previousFix && (point.elapsedMs < previousFix.elapsedMs || unordered)) continue;
    const gap = anchor ? point.elapsedMs - anchor.elapsedMs : 0;
    if (!anchor || broken || point.segment !== anchor.segment || point.provider !== anchor.provider || gap > 30000) {
      segments.push([point]); anchor = point; observed = point; broken = false; continue;
    }
    const distance = metresBetween(anchor, point), seconds = gap / 1000;
    if (seconds <= 0 || distance / seconds > 12) continue;
    if (observed && point.elapsedMs > observed.elapsedMs && point.elapsedMs - observed.elapsedMs <= 30000) trackedMs += point.elapsedMs - observed.elapsedMs;
    observed = point;
    // Accumulate movement from the last accepted fix, not each noisy GPS tick.
    const noise = Math.max(4, Math.min(12, (anchor.accuracy + point.accuracy) * 0.5));
    if (distance < noise) continue;
    const previous = distanceM; distanceM += distance;
    for (let km = Math.floor(previous / 1000) + 1; km <= Math.floor(distanceM / 1000); km++) {
      const t = (km * 1000 - previous) / distance;
      splits.push({ km, latitude: anchor.latitude + (point.latitude - anchor.latitude) * t, longitude: anchor.longitude + (point.longitude - anchor.longitude) * t, elapsedMs: anchor.elapsedMs + gap * t });
    }
    segments[segments.length - 1].push(point); anchor = point;
  }
  const last = segments[segments.length - 1] || [], tail = last.length ? last.filter(point => point.elapsedMs >= last[last.length - 1].elapsedMs - 30000) : [];
  let recentMetres = 0;
  for (let i = 1; i < tail.length; i++) recentMetres += metresBetween(tail[i - 1], tail[i]);
  const recentSeconds = tail.length > 1 ? (tail[tail.length - 1].elapsedMs - tail[0].elapsedMs) / 1000 : 0;
  return { distanceM, trackedMs, segments, splits, lastPoint: anchor, currentPace: recentSeconds >= 5 && recentMetres >= 10 ? recentSeconds * 1000 / recentMetres : null };
}
export function runMeasurement(snapshot: RunSnapshot, result = analyseRun(snapshot.samples)) {
  const manual = snapshot.manualDistanceKm;
  if (manual !== undefined && (!Number.isFinite(manual) || manual < 0 || manual > 1000)) throw Error('请输入 0–1000 公里之间的有效距离。');
  const measured = snapshot.mode !== 'indoor' && result.trackedMs > 0;
  const length = snapshot.options?.stepLengthM;
  const steps = snapshot.mode === 'indoor' && Number.isFinite(snapshot.stepDistanceM) && snapshot.stepDistanceM! > 0 && Number.isSafeInteger(snapshot.stepCount) && snapshot.stepCount! > 0 && snapshot.options?.stepTracking === true && Number.isFinite(length) && length! >= .3 && length! <= 2 && Math.abs(snapshot.stepDistanceM! - snapshot.stepCount! * length!) < .001;
  const stepKm = steps ? snapshot.stepDistanceM! / 1000 : undefined;
  const partial = steps ? !!snapshot.stepPartial : measured && snapshot.elapsedMs - result.trackedMs > Math.max(15000, snapshot.elapsedMs * 0.1);
  return { distanceKm: manual ?? stepKm ?? (measured ? result.distanceM / 1000 : undefined), source: manual !== undefined ? 'manual' as const : steps ? 'steps' as const : measured ? 'location' as const : 'unmeasured' as const,
    partial: manual === undefined && partial, averagePace: manual !== undefined ? (manual > 0 ? snapshot.elapsedMs / 1000 / manual : null) : steps && !partial ? snapshot.elapsedMs / 1000 / stepKm! : measured && !partial && result.distanceM >= 10 ? snapshot.elapsedMs / result.distanceM : null };
}
export function runRecordMeasurement(session: TrainingSession) {
  const km = Number.isFinite(session.distanceKm) && session.distanceKm! >= 0 ? session.distanceKm! : undefined;
  return { km, label: km === undefined ? '仅记录用时 · 距离未测得' : session.distanceSource === 'manual' ? '手动填写距离' : session.distanceSource === 'steps' ? '计步 × 校准步长 · 估算距离' + (session.runDistancePartial ? ' · 部分未记录' : '') : session.runDistancePartial ? '仅含已定位路段' : '定位记录距离',
    pace: km && !session.runDistancePartial ? session.durationSeconds / km : null };
}
/** A timer can start without GPS; only a positive measured/entered distance creates history. */
export function hasRecordedRunDistance(km: number | null | undefined) {
  return Number.isFinite(km) && km! > 0 && km! <= 1000;
}
export function runClock(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000)), hours = Math.floor(seconds / 3600);
  return (hours ? String(hours).padStart(2, '0') + ':' : '') + String(Math.floor(seconds / 60) % 60).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
}
export function paceLabel(secondsPerKm: number | null | undefined) {
  if (!Number.isFinite(secondsPerKm) || !secondsPerKm || secondsPerKm <= 0) return '—';
  const rounded = Math.round(secondsPerKm);
  return `${Math.floor(rounded / 60)}′${String(rounded % 60).padStart(2, '0')}″`;
}
export function toRunSession(snapshot: RunSnapshot): TrainingSession {
  if (!snapshot.id || !snapshot.startedAt || snapshot.phase !== 'finished' || !snapshot.completedAt) throw Error('跑步尚未结束。');
  const result = analyseRun(snapshot.samples);
  const measurement = runMeasurement(snapshot, result), indoor = snapshot.mode === 'indoor', segments = indoor ? [] : result.segments;
  return { id: snapshot.id, workoutId: indoor ? 'indoor_running' : 'outdoor_running', workoutName: indoor ? '室内跑' : '户外跑', startedAt: new Date(snapshot.startedAt).toISOString(), completedAt: new Date(snapshot.completedAt).toISOString(),
    durationSeconds: Math.max(1, Math.floor(snapshot.elapsedMs / 1000)), exercises: [], totalReps: 0, kind: 'running', runMode: indoor ? 'indoor' : 'outdoor', distanceKm: measurement.distanceKm,
    distanceSource: measurement.source, runDistancePartial: measurement.partial,
    ...(indoor && snapshot.stepCount ? { runStepCount: snapshot.stepCount, runStepLengthM: snapshot.options?.stepLengthM } : {}),
    runSplits: measurement.partial || indoor ? [] : result.splits.map((split, index) => ({ km: split.km, seconds: (split.elapsedMs - (result.splits[index - 1]?.elapsedMs || 0)) / 1000 })),
    route: segments.flat().map(point => ({ latitude: point.latitude, longitude: point.longitude })),
    runSegments: segments.map(segment => segment.map(point => ({ latitude: point.latitude, longitude: point.longitude }))), completion: 'complete' };
}
