import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appPalette as c } from '../theme';
import { useRunRecorder } from './RunRecorderHost';
import { RunMap } from './RunMap';
import { mapPosition } from './locationStatus';
import { keepRunScreenOn } from './transport';
import { paceLabel, runClock, runMeasurement, usablePoint } from './model';

export type RunGoal = { label: string; distanceKm?: number; minutes?: number };
export const runGoals: RunGoal[] = [{ label: '自由跑' }, { label: '3 公里', distanceKm: 3 }, { label: '5 公里', distanceKm: 5 }, { label: '10 公里', distanceKm: 10 }, { label: '20 分钟', minutes: 20 }, { label: '30 分钟', minutes: 30 }];
export function RunFocus({ visible, goal, onClose, onFinish }: { visible: boolean; goal: RunGoal; onClose: () => void; onFinish: () => void }) {
  const run = useRunRecorder(), { snapshot, analysis } = run;
  const [locked, setLocked] = useState(false), [showMap, setShowMap] = useState(true), [awakeError, setAwakeError] = useState('');
  const running = snapshot.phase === 'running', finished = snapshot.phase === 'finished', indoor = snapshot.mode === 'indoor';
  const metric = runMeasurement(snapshot, analysis);
  const goalRatio = goal.distanceKm ? (metric.distanceKm || 0) / goal.distanceKm : goal.minutes ? snapshot.elapsedMs / (goal.minutes * 60000) : null;
  const fresh = usablePoint(snapshot.preview) && (snapshot.preview?.ageMs ?? 16000) <= 15000;
  const pace = indoor ? running ? snapshot.stepCurrentPace : null : running && fresh && analysis.lastPoint && snapshot.elapsedMs - analysis.lastPoint.elapsedMs < 15000 ? analysis.currentPace : null;
  useEffect(() => {
    if (!visible) { setLocked(false); return; }
    void keepRunScreenOn(true).catch(() => setAwakeError('屏幕常亮设置失败，记录仍继续。'));
    return () => { void keepRunScreenOn(false).catch(() => undefined); };
  }, [visible]);
  return <Modal visible={visible} animationType="fade" onRequestClose={() => { if (!locked) onClose(); }}>
    <SafeAreaView testID="run-focus" style={s.safe}><View style={s.top}><Pressable accessibilityRole="button" accessibilityLabel="退出跑步全屏，继续记录" onPress={onClose} style={s.small}><Text style={s.link}>‹ 返回</Text></Pressable><Text style={s.state}>{running ? '正在跑步' : finished ? '待保存的跑步' : snapshot.autoPaused ? '已自动暂停' : '跑步已暂停'}</Text><Pressable accessibilityRole="button" accessibilityLabel="锁定跑步屏幕" onPress={() => setLocked(true)} style={s.small}><Text style={s.link}>锁屏</Text></Pressable></View>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.hero}><Text style={s.distance}>{metric.distanceKm === undefined ? '—' : metric.distanceKm.toFixed(2)}</Text><Text style={s.caption}>公里 · {indoor ? '室内跑' : '户外跑'}</Text></View>
        <View style={s.metrics}>{[{ label: '用时', value: runClock(snapshot.elapsedMs) }, { label: metric.source === 'steps' ? '估算平均配速 /km' : '平均配速 /km', value: paceLabel(metric.averagePace) }, { label: indoor && snapshot.options?.stepTracking ? '估算当前配速 /km' : '当前配速 /km', value: paceLabel(pace) }].map(item => <View key={item.label} style={s.metric}><Text style={s.value}>{item.value}</Text><Text style={s.caption}>{item.label}</Text></View>)}</View>
        {goalRatio !== null ? <View><View style={s.goalLabel}><Text style={s.link}>{goal.label}</Text><Text style={s.caption}>{goalRatio >= 1 ? '目标已完成 · 可继续跑步' : `${Math.floor(goalRatio * 100)}%`}</Text></View><View style={s.track}><View style={[s.fill, { width: `${Math.min(100, Math.max(0, goalRatio * 100))}%` }]} /></View></View> : null}
        {!indoor ? <><Pressable accessibilityRole="button" accessibilityLabel={showMap ? '收起跑步地图' : '展开跑步地图'} onPress={() => setShowMap(!showMap)} style={s.mapToggle}><Text style={s.link}>{showMap ? '收起地图' : '展开地图'}</Text></Pressable>{showMap && visible ? <View style={s.map}><RunMap position={mapPosition(snapshot)} segments={analysis.segments} splits={analysis.splits} status={run.location.title} good={run.location.good} onLocate={() => { void run.locate(); }} interactive /></View> : null}</> : <Text style={s.caption}>{snapshot.options?.stepTracking ? `${snapshot.stepCount || 0} 步 · ${metric.source === 'steps' ? '距离按校准步长估算，可填写跑步机距离校正。' : '未测得距离，可填写跑步机距离。'}` : '室内跑记录用时，结束时可填写跑步机距离。'}</Text>}
        {snapshot.autoPaused ? <Text style={s.caption}>重新跑动后自动继续，也可手动继续。</Text> : null}
        {run.error || awakeError || (!indoor && run.location.detail) ? <Text accessibilityRole="alert" style={s.warning}>{run.error || awakeError || run.location.detail}</Text> : null}
        {analysis.splits.length && !metric.partial ? <Text style={s.caption}>最近一公里 {paceLabel((analysis.splits.at(-1)!.elapsedMs - (analysis.splits.at(-2)?.elapsedMs || 0)) / 1000)} /km</Text> : null}
      </ScrollView>
      <View style={s.dock}><Pressable accessibilityRole="button" accessibilityLabel={finished ? '重试保存跑步' : running ? '暂停跑步' : '继续跑步'} disabled={run.busy} onPress={() => { void (finished ? run.save() : running ? run.pause() : run.resume()); }} style={[s.primary, run.busy && { opacity: .5 }]}>{run.busy ? <ActivityIndicator color={c.onLime} /> : <Text style={s.primaryText}>{finished ? '重试保存' : running ? '暂停' : '继续'}</Text>}</Pressable>{!finished ? <Pressable accessibilityRole="button" accessibilityLabel="结束并保存跑步" disabled={run.busy} onPress={onFinish} style={s.end}><Text style={s.link}>结束</Text></Pressable> : null}</View>
      {locked ? <View testID="run-touch-lock" style={s.lock}><Text style={s.state}>屏幕已锁定 · 正在保留记录</Text><Text style={s.distance}>{runClock(snapshot.elapsedMs)}</Text><Pressable accessibilityRole="button" accessibilityLabel="长按解锁跑步屏幕" delayLongPress={900} onLongPress={() => setLocked(false)} style={s.unlock}><Text style={s.primaryText}>长按解锁</Text></Pressable></View> : null}
    </SafeAreaView>
  </Modal>;
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background }, top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 18 }, small: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }, link: { color: c.text, fontSize: 14 }, state: { color: c.lime, fontSize: 16, fontWeight: '800' },
  content: { padding: 20, gap: 18 }, hero: { alignItems: 'center', paddingVertical: 12 }, distance: { color: c.text, fontSize: 64, fontWeight: '900', fontVariant: ['tabular-nums'] }, caption: { color: c.muted, fontSize: 12, lineHeight: 20 }, metrics: { flexDirection: 'row', gap: 8 }, metric: { flex: 1, alignItems: 'center', gap: 5 }, value: { color: c.text, fontSize: 21, fontWeight: '800', fontVariant: ['tabular-nums'] },
  goalLabel: { flexDirection: 'row', justifyContent: 'space-between' }, track: { height: 5, borderRadius: 3, backgroundColor: c.border, marginTop: 8, overflow: 'hidden' }, fill: { height: '100%', backgroundColor: c.lime }, map: { height: 260, borderRadius: 20, overflow: 'hidden' }, mapToggle: { minHeight: 36, justifyContent: 'center' }, warning: { color: '#D8BD82', fontSize: 12, lineHeight: 20 },
  dock: { flexDirection: 'row', gap: 12, padding: 20, paddingBottom: 26 }, primary: { flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', borderRadius: 32, backgroundColor: c.lime }, primaryText: { color: c.onLime, fontSize: 20, fontWeight: '800' }, end: { width: 90, minHeight: 64, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.border, borderRadius: 32 },
  lock: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: c.background, alignItems: 'center', justifyContent: 'center', gap: 26 }, unlock: { minWidth: 210, minHeight: 66, borderRadius: 33, backgroundColor: c.lime, alignItems: 'center', justifyContent: 'center' },
});
