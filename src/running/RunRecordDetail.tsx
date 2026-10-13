import { StyleSheet, Text, View } from 'react-native';
import type { TrainingSession } from '../types';
import { appPalette as c } from '../theme';
import { paceLabel, runClock, runRecordMeasurement } from './model';
import { RunMap } from './RunMap';

/** One receipt for the finish screen and the profile's running history/calendar. */
export function RunRecordDetail({ session }: { session: TrainingSession }) {
  const metrics = runRecordMeasurement(session);
  return <View testID="run-record-detail" style={s.root}>
    <Text style={s.distance}>{metrics.km === undefined ? '—' : metrics.km.toFixed(2)}<Text style={s.unit}> 公里</Text></Text>
    <View style={s.metrics}><View><Text style={s.value}>{runClock(session.durationSeconds * 1000)}</Text><Text style={s.caption}>用时 · 不含暂停</Text></View><View><Text style={s.value}>{paceLabel(metrics.pace)}</Text><Text style={s.caption}>{session.distanceSource === 'steps' ? '估算平均配速 /km' : '平均配速 /km'}</Text></View></View>
    <Text style={s.caption}>{session.runMode === 'indoor' ? '室内跑 · ' : ''}{metrics.label}</Text>
    {session.runStepCount ? <Text style={s.caption}>{session.runStepCount} 步{session.runStepLengthM ? ` · 校准步长 ${session.runStepLengthM} 米/步` : ' · 未校准步长'}</Text> : null}
    {session.runMode !== 'indoor' && (session.route?.length || 0) >= 2 ? <View style={s.map}><RunMap position={null} segments={session.runSegments || [session.route!]} status="已保存的定位轨迹" good interactive={false} /></View> : null}
    {session.runSplits?.length ? <View testID="run-splits"><Text style={s.heading}>公里分段</Text>{session.runSplits.map(split => <View key={split.km} style={s.split}><Text style={s.caption}>第 {split.km} 公里</Text><Text style={s.splitPace}>{paceLabel(split.seconds)} /km</Text></View>)}</View> : null}
  </View>;
}
const s = StyleSheet.create({
  root: { gap: 12 }, distance: { color: c.lime, fontSize: 46, fontWeight: '900', fontVariant: ['tabular-nums'] }, unit: { color: c.muted, fontSize: 13 },
  metrics: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 }, value: { color: c.text, fontSize: 24, fontWeight: '800' }, caption: { color: c.muted, fontSize: 12, lineHeight: 20 },
  map: { height: 240, overflow: 'hidden', borderRadius: 14 }, heading: { color: c.text, fontSize: 16, fontWeight: '700', marginVertical: 8 }, split: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border }, splitPace: { color: c.text, fontSize: 15, fontVariant: ['tabular-nums'] },
});
