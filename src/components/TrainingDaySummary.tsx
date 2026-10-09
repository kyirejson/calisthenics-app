import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { buildSetDistribution, type buildTrainingDay, type DayExercise } from '../domain/training/dayTraining';
import { formatDuration, historyUnitLabels } from '../domain/training/trainingHistory';
import { progressNumber } from '../domain/training/progressChart';
import { appPalette as c } from '../theme';

type Props = { day: ReturnType<typeof buildTrainingDay>; isToday: boolean; savedSessionId?: string; expanded: boolean; onToggle: () => void };

export function TrainingDaySummary({ day, isToday, savedSessionId, expanded, onToggle }: Props) {
  const [width, setWidth] = useState(300);
  const [openAction, setOpenAction] = useState<string | null>(null);
  const segments = buildSetDistribution(day.exercises);
  const size = Math.max(100, Math.min(160, width * 0.53)), radius = size / 2 - 10, circumference = 2 * Math.PI * radius;
  const date = new Date(...parseDate(day.date));
  const saved = day.records.some(session => session.id === savedSessionId);
  const duration = day.unmeasuredCount === day.records.length ? '未记时' : formatDuration(day.durationSeconds);
  return <View testID={'training-day-summary-' + day.date} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    <Pressable accessibilityRole="button" accessibilityLabel={(expanded ? '收起' : '展开') + day.date + '训练历史'} accessibilityState={{ expanded }} aria-expanded={expanded} onPress={() => { setOpenAction(null); onToggle(); }} style={({ pressed }) => [s.heading, expanded && s.headingExpanded, pressed && s.pressed]}>
      <View style={s.headingCopy}><Text style={s.title}>{isToday ? '今日训练' : `${date.getMonth() + 1}月${date.getDate()}日训练`}</Text><Text style={s.small}>{day.setCount} 组 · {day.records.length} 次训练{saved ? ' · 已保存' : ''}</Text></View><Text style={s.date}>{date.getFullYear()} / {date.getMonth() + 1} / {date.getDate()}</Text><Text style={s.chevron}>{expanded ? '⌃' : '⌄'}</Text>
    </Pressable>
    {expanded ? <View testID={'training-day-expanded-' + day.date}>
    <Text style={s.caption}>完成组数分布</Text>
    <View style={s.visual}>
      <View style={{ width: size, height: size }} accessibilityRole="image" accessibilityLabel={day.setCount ? `共完成${day.setCount}组，${day.exercises.map(item => item.name + item.sets.length + '组').join('，')}` : '没有力量训练组'}>
        <Svg testID={'training-day-chart-' + day.date} width={size} height={size} viewBox={`0 0 ${size} ${size}`} pointerEvents="none">
          <Circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={c.border} strokeWidth={14} />
          {segments.map(segment => {
            const length = segment.sweep / 360 * circumference;
            const gap = segments.length === 1 ? 0 : Math.min(4, length * 0.12);
            return <Circle key={segment.key} testID={'training-day-segment-' + segment.key} cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={segment.color} strokeWidth={14} strokeDasharray={`${length - gap} ${circumference - length + gap}`} rotation={segment.start - 90} origin={`${size / 2},${size / 2}`} />;
          })}
        </Svg>
        <View pointerEvents="none" style={s.center}><Text testID={'training-day-sets-' + day.date} style={s.setCount}>{day.setCount || '—'}<Text style={s.unit}>{day.setCount ? ' 组' : ''}</Text></Text><Text style={s.small}>{day.setCount ? '实际完成' : '无力量组'}</Text></View>
      </View>
      <View style={s.metrics}><Text testID={'training-day-duration-' + day.date} style={s.duration}>{duration}</Text><Text style={s.small}>{day.unmeasuredCount > 0 && day.durationSeconds > 0 ? '已记用时 · 含休息' : '用时 · 含休息'}</Text><View style={s.metricDivider} /><Text style={s.sessions}>{day.records.length}<Text style={s.unit}> 次训练</Text></Text>{day.unmeasuredCount > 0 ? <Text style={s.small}>{day.unmeasuredCount} 次未记时</Text> : null}</View>
    </View>
    {day.exercises.length > 0 ? <><Text style={s.caption}>动作累计</Text><View style={s.actions}>{day.exercises.map((item, index) => {
      const actionExpanded = openAction === item.key;
      return <View key={item.key}>
        <Pressable accessibilityRole="button" accessibilityLabel={(actionExpanded ? '收起' : '展开') + item.name + '当日组次明细'} accessibilityState={{ expanded: actionExpanded }} aria-expanded={actionExpanded} onPress={() => setOpenAction(actionExpanded ? null : item.key)} style={({ pressed }) => [s.action, pressed && s.pressed]}>
          <View style={[s.dot, { backgroundColor: segments[index].color }]} /><View style={s.actionName}><Text style={s.name}>{item.name}</Text><Text style={s.small}>{item.sets.length} 组{item.perSide ? ' · 每侧' : ''}</Text></View>
          <Text testID={'training-day-total-' + item.key} style={s.total}>{progressNumber(item.sets.reduce((sum, set) => sum + set.reps, 0))}<Text style={s.unit}> {historyUnitLabels[item.unit]}{item.perSide ? '/侧' : ''}</Text></Text><Text style={s.chevron}>{actionExpanded ? '⌄' : '›'}</Text>
        </Pressable>
        {actionExpanded ? <ActionSets item={item} /> : null}
      </View>;
    })}</View></> : null}
    </View> : null}
  </View>;
}

function parseDate(key: string): [number, number, number] { const [year, month, day] = key.split('-').map(Number); return [year, month - 1, day]; }
function ActionSets({ item }: { item: DayExercise }) {
  return <View testID={'training-day-details-' + item.key} style={s.details}>{item.sets.map((set, index) => <View key={index} style={s.setChip}><Text style={s.small}>第 {index + 1} 组</Text><Text style={s.setValue}>{progressNumber(set.reps)} {historyUnitLabels[item.unit]}{set.loadKg !== undefined ? ` × ${progressNumber(set.loadKg)} kg` : ''}</Text>{set.rir !== undefined ? <Text style={s.small}>余力 {progressNumber(set.rir)}</Text> : null}</View>)}</View>;
}

const s = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52 }, headingExpanded: { marginBottom: 17 }, headingCopy: { flex: 1, minWidth: 0, gap: 4 }, title: { color: c.text, fontSize: 17, fontWeight: '800' }, date: { color: c.muted, fontSize: 10, fontVariant: ['tabular-nums'] }, caption: { color: c.muted, fontSize: 11, marginBottom: 10 },
  visual: { flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: 21 }, center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', gap: 4 }, setCount: { color: c.text, fontSize: 31, fontWeight: '800', fontVariant: ['tabular-nums'] }, unit: { color: c.muted, fontSize: 11, fontWeight: '400' }, small: { color: c.muted, fontSize: 10, lineHeight: 17 },
  metrics: { flex: 1, minWidth: 0 }, duration: { color: c.text, fontSize: 23, lineHeight: 32, fontWeight: '800', fontVariant: ['tabular-nums'] }, metricDivider: { height: 1, backgroundColor: c.border, marginVertical: 10 }, sessions: { color: c.text, fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'] },
  actions: { borderTopWidth: 1, borderTopColor: c.border }, action: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 64, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: c.border }, dot: { width: 10, height: 10, borderRadius: 5 }, actionName: { flex: 1, minWidth: 0, gap: 3 }, name: { color: c.text, fontSize: 12, lineHeight: 18, fontWeight: '700' }, total: { color: c.text, fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'], maxWidth: '40%', textAlign: 'right' }, chevron: { color: c.muted, fontSize: 21, width: 11 },
  details: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 12 }, setChip: { minWidth: 86, maxWidth: '100%', padding: 10, borderRadius: 10, backgroundColor: c.background, gap: 4 }, setValue: { color: c.text, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
