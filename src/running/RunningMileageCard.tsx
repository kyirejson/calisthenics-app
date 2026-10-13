import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { appPalette as c } from '../theme';
import type { TrainingSession } from '../types';
import { mileageLabel, runningStatistics, type RunPeriod } from './statistics';

export function RunningMileageCard({ sessions, now }: { sessions: readonly TrainingSession[]; now: Date }) {
  const [period, setPeriod] = useState<RunPeriod>('week');
  const stats = useMemo(() => runningStatistics(sessions, now), [sessions, now]);
  const days = stats.days(period), ceiling = Math.max(1, Math.ceil(Math.max(...days.map(day => day.km))));
  const plot = { left: 28, right: 346, top: 18, bottom: 118 }, stride = (plot.right - plot.left) / days.length;
  const dayLabel = (index: number) => period === 'week' ? ['一', '二', '三', '四', '五', '六', '日'][index] : String(days[index].day);
  const labelVisible = (index: number) => period === 'week' || index === 0 || index === days.length - 1 || days[index].day % 5 === 0 && index < days.length - 3;
  return <View testID="running-data-section" style={s.section}>
    <Text style={s.heading}>跑步数据</Text>
    <View style={s.totals}>
      {([{ label: '本周', value: stats.weekKm, id: 'run-week-mileage' }, { label: '本月', value: stats.monthKm, id: 'run-month-mileage' }]).map(item => <View key={item.id} style={s.total}><Text style={s.caption}>{item.label}</Text><Text testID={item.id} style={s.value}>{mileageLabel(item.value)}<Text style={s.unit}> km</Text></Text></View>)}
    </View>
    <View style={s.chart}>
      <View style={s.chartHead}><Text style={s.caption}>每日里程 · km</Text><View style={s.switcher}>{(['week', 'month'] as const).map(key => <Pressable key={key} accessibilityRole="tab" accessibilityLabel={key === 'week' ? '查看本周跑步里程' : '查看本月跑步里程'} accessibilityState={{ selected: period === key }} onPress={() => setPeriod(key)} style={[s.choice, key === period && s.selected]}><Text style={[s.choiceText, key === period && s.selectedText]}>{key === 'week' ? '本周' : '本月'}</Text></Pressable>)}</View></View>
      <View testID="running-mileage-chart" accessible accessibilityLabel={`${period === 'week' ? '本周' : '本月'}每日跑步公里数。${days.filter(day => day.runs).map(day => `${day.key} ${mileageLabel(day.km)}公里`).join('；') || '暂无已保存里程'}`}>
        <Svg width="100%" height={154} viewBox="0 0 360 154" pointerEvents="none">
          {[0, .5, 1].map(ratio => { const y = plot.bottom - ratio * (plot.bottom - plot.top); return <ViewGrid key={ratio} y={y} label={mileageLabel(ceiling * ratio)} />; })}
          {days.map((day, index) => { const x = plot.left + stride * (index + .5), barHeight = day.km / ceiling * (plot.bottom - plot.top); return <G key={day.key}>
            {!day.future && day.km > 0 ? <Rect x={x - stride * .28} y={plot.bottom - barHeight} width={stride * .56} height={barHeight} rx={Math.min(4, stride * .16)} fill={index === days.findLastIndex(row => !row.future) ? c.lime : '#88AE8F'} /> : null}
            {period === 'week' && day.km > 0 ? <SvgText x={x} y={plot.bottom - barHeight - 5} textAnchor="middle" fill={c.text} fontSize={11}>{mileageLabel(day.km)}</SvgText> : null}
            {labelVisible(index) ? <SvgText x={x} y={140} textAnchor="middle" fill={day.future ? c.faint : c.muted} fontSize={11}>{dayLabel(index)}</SvgText> : null}
          </G>; })}
        </Svg>
      </View>
      {!days.some(day => day.km > 0) ? <Text style={s.caption}>还没有可统计的跑步里程，保存跑步后会自动更新。</Text> : null}
    </View>
    <View style={s.milestone} testID="running-milestone">
      <View style={s.chartHead}><Text style={s.subheading}>里程碑</Text><Text style={s.caption}>累计已保存里程</Text></View>
      <Text style={s.milestoneValue}>{mileageLabel(stats.lifetimeKm)}<Text style={s.caption}> / {stats.milestone.nextGoal} km</Text></Text>
      <View accessibilityRole="progressbar" accessibilityLabel="跑步累计里程碑" accessibilityValue={{ min: 0, max: stats.milestone.nextGoal, now: stats.lifetimeKm }} style={s.rail}><View style={[s.fill, { width: `${stats.milestone.progress}%` }]} /></View>
      <View style={s.goals}>{stats.milestone.goals.map(goal => <Text key={goal} style={[s.goal, stats.lifetimeKm >= goal && s.earned, stats.milestone.nextGoal === goal && s.next]}>{stats.lifetimeKm >= goal ? '✓ ' : ''}{goal}</Text>)}</View>
      <Text style={s.caption}>再跑 <Text style={s.earned}>{mileageLabel(stats.milestone.remaining)}</Text> 公里，点亮 {stats.milestone.nextGoal} 公里。</Text>
    </View>
    {stats.unknownRuns || stats.estimatedRuns || stats.partialRuns ? <Text testID="running-statistics-note" style={s.note}>{[stats.unknownRuns ? `${stats.unknownRuns} 次仅计时未计里程` : '', stats.estimatedRuns ? `含 ${stats.estimatedRuns} 次估算或手填距离` : '', stats.partialRuns ? `${stats.partialRuns} 次仅有部分路段` : ''].filter(Boolean).join(' · ')}</Text> : null}
  </View>;
}
function ViewGrid({ y, label }: { y: number; label: string }) { return <G><Line x1={28} x2={346} y1={y} y2={y} stroke="#303B3F" strokeWidth={1} /><SvgText x={20} y={y + 4} textAnchor="end" fill={c.faint} fontSize={10}>{label}</SvgText></G>; }
const s = StyleSheet.create({
  section: { marginTop: 22, gap: 10 }, heading: { color: c.text, fontSize: 19, fontWeight: '800' }, totals: { flexDirection: 'row', gap: 10 }, total: { flex: 1, padding: 14, borderWidth: 1, borderColor: '#303B3F', borderRadius: 14, backgroundColor: '#182124' }, caption: { color: c.muted, fontSize: 12, lineHeight: 19 }, value: { color: c.lime, fontSize: 30, lineHeight: 38, fontWeight: '800', fontVariant: ['tabular-nums'] }, unit: { color: c.text, fontSize: 14, fontWeight: '500' }, chart: { backgroundColor: '#182124', borderWidth: 1, borderColor: '#303B3F', borderRadius: 14, padding: 12 }, chartHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, switcher: { flexDirection: 'row', gap: 4 }, choice: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 12 }, selected: { backgroundColor: c.lime }, choiceText: { color: c.muted, fontSize: 12, fontWeight: '700' }, selectedText: { color: c.onLime }, milestone: { padding: 14, backgroundColor: '#182124', borderWidth: 1, borderColor: '#303B3F', borderRadius: 14, gap: 8 }, subheading: { color: c.text, fontSize: 14, fontWeight: '800' }, milestoneValue: { color: c.text, fontSize: 21, fontWeight: '800' }, rail: { height: 5, backgroundColor: '#344044', borderRadius: 3, overflow: 'hidden' }, fill: { height: '100%', backgroundColor: c.lime }, goals: { flexDirection: 'row', justifyContent: 'space-between' }, goal: { color: c.faint, fontSize: 12 }, earned: { color: c.lime }, next: { color: c.text, fontWeight: '800' }, note: { color: c.faint, fontSize: 11, lineHeight: 18 },
});
