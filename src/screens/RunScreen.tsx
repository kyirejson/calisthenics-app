import * as Location from 'expo-location';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Page, ProgressBar } from '../components/ui';
import { AppGlyph, type GlyphName } from '../components/AppGlyph';
import { GpsTrailMap } from '../components/GpsTrailMap';
import { useAppUpdates } from '../components/AppUpdates';
import { useAppStore } from '../store/AppStore';
import { getPlanDay } from '../data/trainingPlans';
import { normalizeRunningGoal, resolveRunningGoal, runningGoalProgress } from '../data/runGoals';
import { appPalette as palette, progressPageLayout } from '../theme';
import type { TrainingSession } from '../types';
import { showMessage } from '../utils/confirm';
import { downsampleTrack, formatPace, formatRunClock, haversine, type GeoPoint } from '../utils/geo';
import { validGeoPoint } from '../utils/mapViewport';

type RunningProps = { embedded?: boolean; onBack?: () => void; onComplete?: () => void };

/** The Today pane and full-screen recorder use the same GPS / saving logic. */
export function RunScreen({ onBack, onComplete }: { onBack: () => void; onComplete: () => void }) {
  return <RunningSession onBack={onBack} onComplete={onComplete} />;
}

export function RunningSession({ embedded = false, onBack, onComplete }: RunningProps) {
  const { profile, settings, saveSession, updateSettings } = useAppStore();
  const { blockUpdates } = useAppUpdates();
  const [status, setStatus] = useState<'idle' | 'running' | 'paused'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [distanceM, setDistanceM] = useState(0);
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [trail, setTrail] = useState<GeoPoint[]>([]);
  const [current, setCurrent] = useState<GeoPoint | null>(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [canAskLocation, setCanAskLocation] = useState(true);
  const [showGoal, setShowGoal] = useState(false);
  const [goalKind, setGoalKind] = useState<'distance' | 'duration'>('distance');
  const [goalValue, setGoalValue] = useState('5');
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalError, setGoalError] = useState('');
  const watch = useRef<Location.LocationSubscription | null>(null);
  const lastPoint = useRef<GeoPoint | null>(null);
  const startedAt = useRef<Date | null>(null);
  const statusRef = useRef<'idle' | 'running' | 'paused'>('idle');
  const active = useRef(true);
  const generation = useRef(0);
  const locationPending = useRef(false);
  const goalPending = useRef(false);
  const savePending = useRef(false);
  const watchStarting = useRef<number | null>(null);
  const elapsedMs = useRef(0);
  const runningSince = useRef<number | null>(null);

  // 预览：已授权时取当前位置画底图；未授权不主动弹窗，点开始记录时再请求
  useEffect(() => {
    active.current = true;
    let previewActive = true;
    (async () => {
      try {
        const existing = await Location.getForegroundPermissionsAsync();
        if (!previewActive) return;
        setCanAskLocation(existing.canAskAgain);
        if (!existing.granted) {
          if (!existing.canAskAgain) setPermission('denied');
          return;
        }
        setPermission('granted');
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (previewActive && validGeoPoint(pos?.coords)) setCurrent({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      } catch { /* 定位预览失败不影响记录 */ }
    })();
    return () => { previewActive = false; active.current = false; generation.current++; watch.current?.remove(); watch.current = null; };
  }, []);

  useEffect(() => {
    if (status !== 'running') return;
    const update = () => setElapsed(Math.floor((elapsedMs.current + (runningSince.current === null ? 0 : Math.max(0, Date.now() - runningSince.current))) / 1000));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [status]);

  useLayoutEffect(() => { if (status !== 'idle' || showGoal || locating) return blockUpdates(); }, [status, showGoal, locating, blockUpdates]);

  if (!profile) return null;
  const now = new Date();
  const plannedDay = getPlanDay(profile, now).day;
  const weightLoss = profile.goal === 'weight_loss';
  const targetMinutes = plannedDay.type === 'cardio' ? plannedDay.targetMinutes : undefined;
  const km = distanceM / 1000;
  const pace = km > 0.03 ? elapsed / km : 0;
  const goal = resolveRunningGoal(settings.runningGoal, targetMinutes);
  const goalPercent = runningGoalProgress(goal, distanceM, elapsed);
  const gpsReady = permission === 'granted' && current !== null;

  const locate = async () => {
    if (locationPending.current) return;
    locationPending.current = true; setLocating(true);
    try {
      const existing = await Location.getForegroundPermissionsAsync();
      if (!active.current) return;
      if (!existing.granted && !existing.canAskAgain && Platform.OS !== 'web') {
        setCanAskLocation(false); setPermission('denied');
        void Linking.openSettings().catch(() => showMessage('无法打开定位设置', '请在系统设置中为 Uncover 开启定位权限。'));
        return;
      }
      const result = existing.granted ? existing : await Location.requestForegroundPermissionsAsync();
      if (!active.current) return;
      setCanAskLocation(result.canAskAgain);
      if (!result.granted) { setPermission('denied'); return; }
      setPermission('granted');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (active.current && validGeoPoint(pos?.coords)) setCurrent({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      if (active.current && statusRef.current === 'running') await followLocation(generation.current);
    } catch { if (active.current) showMessage('暂时无法定位', '可重试定位，或直接开始计时。'); }
    finally { locationPending.current = false; if (active.current) setLocating(false); }
  };

  const editGoal = () => {
    setGoalKind(goal?.kind || 'distance'); setGoalValue(String(goal?.value || 5)); setGoalError(''); setShowGoal(true);
  };
  const saveGoal = async (clear = false) => {
    if (goalPending.current) return;
    const next = clear ? null : normalizeRunningGoal({ kind: goalKind, value: goalValue.trim() ? Number(goalValue) : NaN });
    if (!clear && !next) { setGoalError(goalKind === 'distance' ? '请输入 0.5–50 km 的距离。' : '请输入 1–240 分钟的整数时长。'); return; }
    goalPending.current = true; setGoalSaving(true); setGoalError('');
    try { await updateSettings({ runningGoal: next || undefined }); setShowGoal(false); }
    catch { setGoalError('目标未能保存，请重试。'); }
    finally { goalPending.current = false; setGoalSaving(false); }
  };

  const followLocation = async (ticket: number) => {
    if (watch.current || watchStarting.current === ticket) return;
    watchStarting.current = ticket;
    try {
      const subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 2000, distanceInterval: 3 },
        location => {
          const accuracy = location.coords.accuracy;
          if (ticket !== generation.current || statusRef.current !== 'running' || typeof accuracy !== 'number' || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 35) return;
          const next: GeoPoint = { latitude: location.coords.latitude, longitude: location.coords.longitude };
          if (!validGeoPoint(next)) return;
          if (lastPoint.current) {
            const segment = haversine(lastPoint.current, next);
            setDistanceM(value => value + segment);
          }
          lastPoint.current = next; setCurrent(next);
          // Downsample rather than discard the beginning of a long run.
          setTrail(previous => { const points = [...previous, next]; return points.length > 600 ? downsampleTrack(points, 480) : points; });
        },
      );
      if (!active.current || ticket !== generation.current) subscription.remove();
      else watch.current = subscription;
    } finally { if (watchStarting.current === ticket) watchStarting.current = null; }
  };

  const stopClock = () => {
    if (runningSince.current !== null) elapsedMs.current += Math.max(0, Date.now() - runningSince.current);
    runningSince.current = null;
    const seconds = Math.floor(elapsedMs.current / 1000);
    setElapsed(seconds); return seconds;
  };

  const begin = async () => {
    if (statusRef.current !== 'idle') return;
    const ticket = ++generation.current;
    startedAt.current = new Date();
    elapsedMs.current = 0; runningSince.current = Date.now();
    statusRef.current = 'running';
    setStatus('running');
    setTrail([]);
    setDistanceM(0);
    setElapsed(0);
    lastPoint.current = null;
    try {
      const existing = await Location.getForegroundPermissionsAsync();
      const result = existing.granted || !existing.canAskAgain ? existing : await Location.requestForegroundPermissionsAsync();
      if (!active.current || ticket !== generation.current) return;
      setCanAskLocation(result.canAskAgain);
      if (!result.granted) {
        setPermission('denied');
        setCurrent(null);
        showMessage('仅记录运动时间', `未授权定位，仍可完成${weightLoss ? '快走或骑行' : '跑步'}计时；距离、配速和地图轨迹不会记录。`);
        return;
      }
      setPermission('granted');
      await followLocation(ticket);
    } catch {
      if (!active.current || ticket !== generation.current) return;
      setPermission('denied');
      setCurrent(null);
      showMessage('仅记录运动时间', '定位暂不可用，本次仍可计时。');
    }
  };

  const togglePause = () => {
    const next = statusRef.current === 'running' ? 'paused' : 'running';
    if (next === 'paused') stopClock(); else runningSince.current = Date.now();
    statusRef.current = next;
    lastPoint.current = null; // 暂停期间的位移不计入距离
    setStatus(next);
    if (next === 'running' && permission === 'granted' && !watch.current) {
      void followLocation(generation.current).catch(() => showMessage('定位暂不可用', '保留已有路线，本次继续计时。'));
    }
  };

  const finish = async () => {
    if (statusRef.current === 'idle' || savePending.current) return;
    savePending.current = true;
    statusRef.current = 'paused';
    setStatus('paused');
    generation.current++;
    watch.current?.remove();
    watch.current = null;
    const seconds = Math.max(1, stopClock());
    const kmTotal = distanceM / 1000;
    const session: TrainingSession = {
      id: `run_${Date.now()}`,
      workoutId: 'outdoor_run',
      workoutName: plannedDay.type === 'cardio' ? plannedDay.title : '有氧活动',
      startedAt: (startedAt.current || new Date()).toISOString(),
      completedAt: new Date().toISOString(),
      durationSeconds: seconds,
      exercises: [],
      totalReps: 0,
      kind: 'running',
      distanceKm: Number(kmTotal.toFixed(2)),
      calories: weightLoss ? undefined : Math.round((profile.weight || 65) * kmTotal * 1.02),
      completion: targetMinutes ? seconds < targetMinutes * 60 ? 'partial' : 'complete' : goal && runningGoalProgress(goal, distanceM, seconds) < 100 ? 'partial' : 'complete',
      // 轨迹入库（降采样 ≤240 点）：最近记录卡与数据页的训练历史都能重画这条路线
      ...(trail.length >= 2 ? { route: downsampleTrack(trail, 240) } : {}),
    };
    setSaving(true);
    try {
      await saveSession(session);
      showMessage('跑步记录已保存', `${formatRunClock(seconds)}${kmTotal > 0.03 ? ` · ${kmTotal.toFixed(2)} 公里` : ''} · 已计入训练历史`);
    } catch {
      savePending.current = false;
      setSaving(false);
      showMessage('保存失败', '数据仍保留在此页，请重试保存。');
      return;
    }
    setSaving(false);
    savePending.current = false;
    setStatus('idle');
    setTrail([]);
    setDistanceM(0);
    setElapsed(0);
    elapsedMs.current = 0; runningSince.current = null;
    startedAt.current = null;
    statusRef.current = 'idle';
    onComplete?.();
  };


  return <Page tone="dark" testID="running-content" style={styles.content}>
    {!embedded ? <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="返回今日页" onPress={onBack} style={styles.back}><AppGlyph name="back" color={palette.text} /></Pressable><Text style={styles.title}>有氧记录</Text></View> : null}
    <View style={styles.heading}><Text style={styles.sectionTitle}>{weightLoss ? '步行与有氧' : '户外跑步'}</Text><View style={styles.signal}><View style={[styles.signalDot, gpsReady && { backgroundColor: palette.lime }]} /><Text testID="running-gps-status" style={styles.signalText}>{status === 'paused' ? '已暂停' : gpsReady ? status === 'running' ? 'GPS 记录中' : 'GPS 就绪' : locating ? '正在定位' : permission === 'denied' ? '仅计时' : '等待定位'}</Text></View></View>
    <View testID="running-map" style={styles.map}><GpsTrailMap trail={trail} current={current} fitTrack style={StyleSheet.absoluteFill} placeholderTitle={permission === 'denied' ? '未开启定位' : locating ? '正在获取位置' : '定位后显示路线'} placeholderHint={permission === 'denied' ? '仍可记录运动时间' : undefined} placeholderAction={{ label: locating ? '正在定位…' : !canAskLocation && Platform.OS !== 'web' ? '打开定位设置' : '开启定位', onPress: () => void locate(), disabled: locating }} /></View>
    <View style={styles.distanceRow}><Text testID="running-distance" style={styles.distance}>{km.toFixed(2)}<Text style={styles.unit}> km</Text></Text></View>
    <View style={styles.stats}><RunMetric icon="clock" label="用时" value={formatRunClock(elapsed)} testID="running-elapsed" /><View style={styles.divider} /><RunMetric icon="pace" label="平均配速" value={formatPace(pace)} /></View>
    <View testID="running-goal-card" style={styles.target}><Pressable accessibilityRole="button" accessibilityLabel="设置跑步目标" disabled={goalSaving || saving} onPress={editGoal} style={styles.targetHead}><Text style={styles.note}>{goal ? (settings.runningGoal ? '今日目标 ' : '课程目标 ') + goal.value + (goal.kind === 'distance' ? ' km' : ' 分钟') : '今日目标'}</Text><View style={styles.goalSummary}><Text testID="running-goal-progress" style={styles.targetValue}>{goal ? (goal.kind === 'distance' ? km.toFixed(2) : Math.floor(elapsed / 60)) + ' / ' + goal.value + (goal.kind === 'distance' ? ' km' : ' 分钟') : '设置目标'}</Text><AppGlyph name="chevron" size={12} /></View></Pressable><ProgressBar value={goalPercent} color={palette.lime} /></View>
    <View style={styles.controls}>{status === 'idle' ? <Pressable accessibilityRole="button" accessibilityLabel="开始记录" disabled={saving} onPress={() => void begin()} style={[styles.primary, saving && styles.disabled]}><AppGlyph name="run" color={palette.onLime} /><Text style={styles.primaryText}>开始记录</Text></Pressable> : <><Pressable accessibilityRole="button" accessibilityLabel={status === 'running' ? '暂停记录' : '继续记录'} disabled={saving} onPress={togglePause} style={styles.secondary}><AppGlyph name={status === 'running' ? 'pause' : 'run'} color={palette.text} size={18} /><Text style={styles.secondaryText}>{status === 'running' ? '暂停' : '继续'}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="结束并保存" disabled={saving} onPress={() => void finish()} style={[styles.primary, saving && styles.disabled]}><AppGlyph name="stop" color={palette.onLime} size={16} /><Text style={styles.primaryText}>{saving ? '保存中…' : '结束跑步'}</Text></Pressable></>}</View>
    <Modal transparent visible={showGoal} animationType="fade" onRequestClose={() => { if (!goalSaving) setShowGoal(false); }}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.backdrop}><View testID="running-goal-sheet" style={styles.goalSheet}><ScrollView keyboardShouldPersistTaps="handled" style={styles.goalScroll} contentContainerStyle={styles.goalBody}>
      <View style={styles.goalHeader}><Text style={styles.modalTitle}>跑步目标</Text><Pressable accessibilityRole="button" accessibilityLabel="关闭跑步目标" disabled={goalSaving} onPress={() => setShowGoal(false)} style={styles.close}><AppGlyph name="plus" /></Pressable></View>
      <View style={styles.goalKinds}>{(['distance', 'duration'] as const).map(kind => <Pressable key={kind} accessibilityRole="radio" accessibilityState={{ checked: goalKind === kind }} aria-checked={goalKind === kind} disabled={goalSaving} onPress={() => { setGoalKind(kind); setGoalValue(kind === 'distance' ? '5' : '30'); setGoalError(''); }} style={[styles.kindChoice, goalKind === kind && styles.kindChoiceActive]}><Text style={[styles.kindText, goalKind === kind && { color: palette.lime }]}>{kind === 'distance' ? '距离' : '时长'}</Text></Pressable>)}</View>
      <View style={styles.goalInputRow}><TextInput accessibilityLabel="跑步目标数值" keyboardType={goalKind === 'distance' ? 'decimal-pad' : 'number-pad'} editable={!goalSaving} value={goalValue} onChangeText={value => { setGoalValue(value); setGoalError(''); }} style={styles.goalInput} /><Text style={styles.goalUnit}>{goalKind === 'distance' ? 'km' : '分钟'}</Text></View>
      <View style={styles.presets}>{(goalKind === 'distance' ? [1, 3, 5, 10, 21] : [15, 20, 30, 45, 60, 90]).map(value => <Pressable key={value} accessibilityRole="button" disabled={goalSaving} accessibilityLabel={'选择跑步目标' + value + (goalKind === 'distance' ? '公里' : '分钟')} onPress={() => { setGoalValue(String(value)); setGoalError(''); }} style={[styles.preset, Number(goalValue) === value && styles.kindChoiceActive]}><Text style={styles.kindText}>{value}</Text></Pressable>)}</View>
      <Text style={styles.goalHint}>自选目标不改变训练课程，未达标也能保存记录。</Text>{goalError ? <Text accessibilityRole="alert" style={styles.goalError}>{goalError}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="保存跑步目标" disabled={goalSaving} onPress={() => void saveGoal()} style={[styles.primary, styles.saveGoal, goalSaving && styles.disabled]}><Text style={styles.primaryText}>{goalSaving ? '保存中…' : '保存目标'}</Text></Pressable>
      {settings.runningGoal ? <Pressable accessibilityRole="button" accessibilityLabel="清除自选跑步目标" disabled={goalSaving} onPress={() => void saveGoal(true)} style={styles.clearGoal}><Text style={styles.kindText}>{targetMinutes ? '恢复课程目标' : '清除自选目标'}</Text></Pressable> : null}
    </ScrollView></View></KeyboardAvoidingView></Modal>
  </Page>;
}

function RunMetric({ icon, label, value, testID }: { icon: GlyphName; label: string; value: string; testID?: string }) {
  return <View style={styles.metric}><AppGlyph name={icon} color={palette.lime} size={20} /><View style={styles.metricCopy}><Text style={styles.metricLabel}>{label}</Text><Text testID={testID} style={styles.metricValue}>{value}</Text></View></View>;
}
const styles = StyleSheet.create({
  content: { ...progressPageLayout.content, paddingBottom: 110 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: palette.card, alignItems: 'center', justifyContent: 'center' },
  title: { ...progressPageLayout.title, color: palette.text },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 12 },
  sectionTitle: { ...progressPageLayout.sectionTitle, color: palette.text },
  signal: { flexDirection: 'row', alignItems: 'center', gap: 6 }, signalDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.faint }, signalText: { color: palette.muted, fontSize: 11 },
  map: { aspectRatio: 1.38, borderRadius: 16, borderWidth: 1, borderColor: palette.border, overflow: 'hidden', backgroundColor: palette.card },
  distanceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 18 },
  distance: { color: palette.text, fontSize: 52, lineHeight: 62, fontWeight: '900', letterSpacing: -1.4, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 18, letterSpacing: 0, fontWeight: '700', color: palette.muted },
  stats: { flexDirection: 'row', gap: 14, marginVertical: 16 }, metric: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 }, metricCopy: { flex: 1, minWidth: 0 }, metricLabel: { color: palette.muted, fontSize: 11 }, metricValue: { color: palette.text, fontSize: 22, fontWeight: '800', marginTop: 5, fontVariant: ['tabular-nums'] }, divider: { width: 1, backgroundColor: palette.border },
  target: { backgroundColor: palette.card, paddingHorizontal: 14, paddingTop: 2, paddingBottom: 14, borderRadius: 16, borderWidth: 1, borderColor: palette.border, gap: 2 }, targetHead: { minHeight: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, goalSummary: { flexDirection: 'row', alignItems: 'center', gap: 5 }, targetValue: { color: palette.text, fontSize: 11, fontWeight: '700' }, note: { color: palette.muted, fontSize: 12 },
  controls: { flexDirection: 'row', gap: 10, marginTop: 12 }, primary: { flex: 1, minHeight: 48, backgroundColor: palette.lime, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, primaryText: { color: palette.onLime, fontSize: 13, fontWeight: '800' }, secondary: { flex: 1, minHeight: 48, borderWidth: 1, borderColor: palette.oliveBorder, backgroundColor: palette.background, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, secondaryText: { color: palette.text, fontSize: 13, fontWeight: '800' }, disabled: { opacity: .45 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.72)', padding: 16, justifyContent: 'center', alignItems: 'center' }, goalSheet: { width: '100%', maxWidth: 440, maxHeight: '100%', flexShrink: 1, borderRadius: 20, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card, overflow: 'hidden' }, goalScroll: { flexGrow: 0 }, goalBody: { padding: 16 }, goalHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 }, modalTitle: { ...progressPageLayout.title, color: palette.text, flex: 1 }, close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '45deg' }] }, goalKinds: { flexDirection: 'row', gap: 8, marginTop: 12 }, kindChoice: { flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: palette.raised, borderWidth: 1, borderColor: palette.border, alignItems: 'center', justifyContent: 'center' }, kindChoiceActive: { backgroundColor: palette.olive, borderColor: palette.oliveBorder }, kindText: { color: palette.muted, fontSize: 12, fontWeight: '700' }, goalInputRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 }, goalInput: { flex: 1, minWidth: 0, minHeight: 52, borderWidth: 1, borderColor: palette.border, borderRadius: 12, backgroundColor: palette.raised, color: palette.text, fontSize: 24, fontWeight: '800', paddingHorizontal: 12 }, goalUnit: { color: palette.muted, fontSize: 13 }, presets: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 10 }, preset: { minWidth: 44, minHeight: 44, flexGrow: 1, paddingHorizontal: 8, borderRadius: 10, borderWidth: 1, borderColor: palette.border, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.raised }, goalHint: { color: palette.muted, fontSize: 11, lineHeight: 18, marginTop: 14 }, goalError: { color: palette.danger, fontSize: 12, lineHeight: 19, marginTop: 10 }, saveGoal: { flex: 0, marginTop: 16 }, clearGoal: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
});
