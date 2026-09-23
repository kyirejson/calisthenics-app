import React, { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, ProgressBar } from '../components/ui';
import { getWorkout, getWorkoutExercises } from '../data/catalog';
import { getDayTrainingState, getDisplayedSchedule, localDateKey, type ScheduledDay } from '../data/planProgress';
import { getPlanDay } from '../data/trainingPlans';
import { useAppStore } from '../store/AppStore';
import { colors, radius } from '../theme';
import type { Goal } from '../types';

type Props = {
  onStart?: (workoutId: string, setMultiplier?: number, rirTarget?: number) => void;
  onRun?: () => void;
};

const weekdayLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const phaseLabels = ['适应', '积累', '强化', '减载'];
const goalLabels: Record<Goal, string> = {
  health: '健康体能',
  fat_loss: '减脂塑形',
  gain: '增肌积累',
  strength: '力量进阶',
};
const experienceLabels = { beginner: '初学阶段', intermediate: '稳定训练阶段', advanced: '高阶训练阶段' };

export function PlansScreen({ onStart, onRun }: Props) {
  const { profile, sessions } = useAppStore();
  const [expandedDate, setExpandedDate] = useState<string | null>(localDateKey(new Date()));
  const [showBasis, setShowBasis] = useState(false);
  if (!profile) return null;

  const now = new Date();
  const todayKey = localDateKey(now);
  const resolved = getPlanDay(profile, now);
  const week = getDisplayedSchedule(profile, now);
  const planned = week.filter((day) => day.type !== 'recovery');
  const completedCount = planned.filter((day) => getDayTrainingState(day, sessions).complete).length;
  const intro = resolved.phase === 'starter'
    ? `重启第 ${resolved.dayNumber} 天 · ${resolved.plan.shortName}`
    : `${goalLabels[profile.goal]} · ${resolved.plan.shortName}`;

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}><Text style={styles.eyebrow}>{resolved.phase === 'starter' ? '7 天起步' : '本周安排'}</Text><Text style={styles.title}>训练计划</Text><Text style={styles.intro}>{intro}</Text></View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryTop}><View><Text style={styles.summaryLabel}>{resolved.phase === 'starter' ? '7 天课程' : '本周完成'}</Text><Text style={styles.summaryValue}>{completedCount}<Text style={styles.summaryUnit}> / {planned.length} 课</Text></Text></View><Text style={styles.summaryFrequency}>每周 {resolved.plan.frequency} 练</Text></View>
        <ProgressBar value={planned.length ? completedCount / planned.length * 100 : 0} color={colors.lime} />
      </View>

      <View style={styles.cycleCard}>
        <View style={styles.cycleHeader}><View><Text style={styles.cycleEyebrow}>{resolved.phase === 'starter' ? `第 ${resolved.dayNumber} / 7 天 · 起步阶段` : `第 ${resolved.cycle.week} 周 · 四周循环`}</Text><Text style={styles.cycleTitle}>{resolved.phase === 'starter' ? '先建立动作习惯' : resolved.cycle.label}</Text></View><Text style={styles.cycleRir}>保留 {resolved.cycle.rirTarget} 次余力</Text></View>
        <Text style={styles.cycleNote}>{resolved.phase === 'starter' ? '前 7 天穿插温和训练与恢复；之后进入全身三练。' : resolved.cycle.note}</Text>
        {resolved.phase !== 'starter' ? <View style={styles.phaseRow}>{phaseLabels.map((label, index) => <View key={label} style={[styles.phaseStep, index + 1 === resolved.cycle.cycleWeek && styles.phaseActive]}><Text style={[styles.phaseText, index + 1 === resolved.cycle.cycleWeek && styles.phaseTextActive]}>{label}</Text></View>)}</View> : null}
      </View>

      <View style={styles.basisCard}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: showBasis }} onPress={() => setShowBasis(!showBasis)} style={styles.basisToggle}><Text style={styles.basisTitle}>这周为什么这样安排</Text><Text style={styles.basisChevron}>{showBasis ? '⌃' : '⌄'}</Text></Pressable>
        {showBasis ? <View style={styles.basisBody}>
          <Text style={styles.basisText}>参考你的{goalLabels[profile.goal]}目标、{experienceLabels[profile.experience]}和每周 {resolved.plan.frequency} 次的安排。</Text>
          <Text style={styles.basisText}>{resolved.plan.description}</Text>
          <Text style={styles.basisText}>{resolved.phase === 'starter' ? '起步周以熟悉动作和恢复为主；结束后接入三练计划。' : '常规课程按训练部位或恢复日分配；前三周调整训练量，第 4 周减少组数，并用剩余次数控制强度。'}</Text>
          <Text style={styles.basisNote}>四周节奏可以按恢复情况调整；疼痛时停止相关动作。</Text>
        </View> : null}
      </View>

      <View style={styles.sectionRow}><Text style={styles.sectionTitle}>{profile.planId === 'rebirth_7' && resolved.phase === 'starter' ? '接下来 7 天' : '每天做什么'}</Text><Text style={styles.sectionHint}>点击日期查看详情</Text></View>
      {week.map((day) => <DayCard
        key={localDateKey(day.date)}
        day={day}
        profile={profile}
        sessions={sessions}
        todayKey={todayKey}
        expanded={expandedDate === localDateKey(day.date)}
        onToggle={() => setExpandedDate(expandedDate === localDateKey(day.date) ? null : localDateKey(day.date))}
        onStart={onStart}
        onRun={onRun}
      />)}
    </ScrollView>
  </SafeAreaView>;
}

function DayCard({
  day, profile, sessions, todayKey, expanded, onToggle, onStart, onRun,
}: {
  day: ScheduledDay;
  profile: NonNullable<ReturnType<typeof useAppStore>['profile']>;
  sessions: ReturnType<typeof useAppStore>['sessions'];
  todayKey: string;
  expanded: boolean;
  onToggle: () => void;
  onStart?: Props['onStart'];
  onRun?: Props['onRun'];
}) {
  const dayKey = localDateKey(day.date);
  const isToday = dayKey === todayKey;
  const state = getDayTrainingState(day, sessions);
  const workout = day.type === 'strength' && day.workoutId ? getWorkout(day.workoutId) : null;
  const cycle = getPlanDay(profile, day.date).cycle;
  const exercises = workout ? getWorkoutExercises(workout.id, profile, cycle.setMultiplier) : [];
  const typeName = day.type === 'strength' ? '力量' : day.type === 'cardio' ? '有氧' : '恢复';
  const detail = workout
    ? `${exercises.length} 个动作 · 约 ${workout.estimatedMinutes} 分钟`
    : day.type === 'cardio' ? '轻松跑或快走' : '让身体为下一次训练恢复';

  return <View style={[styles.dayCard, isToday && styles.dayCardToday]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${weekdayLabels[day.date.getDay()]} ${day.title}，查看安排`} onPress={onToggle} style={styles.dayHead}>
      <View style={[styles.dateTile, isToday && styles.dateTileToday]}><Text style={[styles.weekday, isToday && styles.dateTodayText]}>{weekdayLabels[day.date.getDay()].slice(1)}</Text><Text style={[styles.dateNum, isToday && styles.dateTodayText]}>{day.date.getDate()}</Text></View>
      <View style={styles.dayMain}><View style={styles.dayNameRow}><Text numberOfLines={1} style={styles.dayTitle}>{day.title}</Text>{isToday ? <Text style={styles.todayLabel}>今天</Text> : null}</View><Text style={styles.dayMeta}>{detail}</Text></View>
      <View style={styles.dayRight}><Text style={[styles.typeLabel, day.type === 'recovery' && styles.restLabel, state.complete && styles.doneLabel]}>{state.complete ? '已完成' : state.partial ? '已部分记录' : typeName}</Text><Text style={styles.expandGlyph}>{expanded ? '⌃' : '⌄'}</Text></View>
    </Pressable>
    {expanded ? <View style={styles.dayDetails}>
      <View style={styles.tipBox}><Text style={styles.tipLabel}>{day.type === 'recovery' ? '恢复建议' : '训练注意'}</Text><Text style={styles.tipText}>{day.tip}</Text></View>
      {workout ? <View style={styles.exerciseList}>{exercises.map((exercise, index) => <View key={`${exercise.id}-${index}`} style={[styles.exerciseRow, index > 0 && styles.exerciseBorder]}><Text style={styles.exerciseIndex}>{String(index + 1).padStart(2, '0')}</Text><View style={styles.exerciseInfo}><Text style={styles.exerciseName}>{exercise.name}</Text><Text style={styles.exerciseMeta}>{exercise.targetSets} 组 · 组间休息 {exercise.restSeconds} 秒</Text></View></View>)}</View> : null}
      {state.complete && state.session ? <Text style={styles.finishText}>已完成 · {Math.max(1, Math.ceil(state.session.durationSeconds / 60))} 分钟</Text> : null}
      {isToday && !state.complete && day.type === 'strength' && workout && onStart ? <View style={styles.dayAction}><Button label={state.partial ? '开始完整训练' : '开始今日训练'} variant="lime" onPress={() => onStart(workout.id, cycle.setMultiplier, cycle.rirTarget)} /></View> : null}
      {isToday && !state.complete && day.type === 'cardio' && onRun ? <View style={styles.dayAction}><Button label="记录今日有氧" variant="lime" onPress={onRun} /></View> : null}
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 125 },
  header: { marginBottom: 20 },
  eyebrow: { color: colors.inkMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  title: { color: colors.ink, fontSize: 34, lineHeight: 41, fontWeight: '900', letterSpacing: -1.1, marginTop: 5 },
  intro: { color: colors.inkMuted, fontSize: 13, marginTop: 4 },
  summaryCard: { backgroundColor: colors.ink, borderRadius: radius.lg, padding: 20, marginBottom: 12 },
  summaryTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  summaryLabel: { color: '#BFC2B8', fontSize: 11, fontWeight: '700' },
  summaryValue: { color: '#FFFFFF', fontSize: 30, fontWeight: '900', marginTop: 4 },
  summaryUnit: { color: '#BFC2B8', fontSize: 13, fontWeight: '700' },
  summaryFrequency: { color: colors.lime, fontSize: 11, fontWeight: '800', backgroundColor: '#353B2A', paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.pill },
  cycleCard: { backgroundColor: colors.card, borderColor: colors.line, borderWidth: 1, borderRadius: radius.md, padding: 18 },
  cycleHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  cycleEyebrow: { color: colors.inkMuted, fontSize: 11, fontWeight: '700' },
  cycleTitle: { color: colors.ink, fontSize: 20, fontWeight: '900', marginTop: 4 },
  cycleRir: { color: colors.green, fontSize: 10, fontWeight: '800', marginTop: 2 },
  cycleNote: { color: colors.inkMuted, fontSize: 12, lineHeight: 18, marginTop: 8 },
  phaseRow: { flexDirection: 'row', gap: 6, marginTop: 15 },
  phaseStep: { flex: 1, backgroundColor: colors.paper, borderRadius: radius.pill, alignItems: 'center', paddingVertical: 7 },
  phaseActive: { backgroundColor: colors.lime },
  phaseText: { color: colors.inkMuted, fontSize: 10, fontWeight: '700' },
  phaseTextActive: { color: colors.ink, fontWeight: '900' },
  basisCard: { backgroundColor: colors.card, borderColor: colors.line, borderWidth: 1, borderRadius: radius.md, marginTop: 10, overflow: 'hidden' },
  basisToggle: { paddingHorizontal: 16, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  basisTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  basisChevron: { color: colors.inkMuted, fontSize: 17 },
  basisBody: { paddingHorizontal: 16, paddingBottom: 15, borderTopColor: colors.line, borderTopWidth: 1 },
  basisText: { color: colors.inkMuted, fontSize: 11, lineHeight: 17, marginTop: 9 },
  basisNote: { color: colors.green, fontSize: 10, lineHeight: 16, marginTop: 9 },
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 24, marginBottom: 12 },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: '900' },
  sectionHint: { color: colors.inkMuted, fontSize: 10 },
  dayCard: { backgroundColor: colors.card, borderColor: colors.line, borderWidth: 1, borderRadius: radius.md, marginBottom: 9, overflow: 'hidden' },
  dayCardToday: { borderColor: colors.limeDark },
  dayHead: { minHeight: 78, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, gap: 11 },
  dateTile: { width: 42, height: 48, borderRadius: 12, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  dateTileToday: { backgroundColor: colors.lime },
  weekday: { color: colors.inkMuted, fontSize: 10, fontWeight: '800' },
  dateNum: { color: colors.ink, fontSize: 17, fontWeight: '900', lineHeight: 21 },
  dateTodayText: { color: colors.ink },
  dayMain: { flex: 1, minWidth: 0 },
  dayNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dayTitle: { color: colors.ink, fontSize: 13, fontWeight: '900', flexShrink: 1 },
  todayLabel: { color: '#506316', fontSize: 9, fontWeight: '900' },
  dayMeta: { color: colors.inkMuted, fontSize: 10, marginTop: 5 },
  dayRight: { alignItems: 'flex-end', minWidth: 50 },
  typeLabel: { color: colors.green, fontSize: 10, fontWeight: '800' },
  restLabel: { color: colors.inkMuted },
  doneLabel: { color: colors.green },
  expandGlyph: { color: colors.inkMuted, fontSize: 16, lineHeight: 19, marginTop: 3 },
  dayDetails: { paddingHorizontal: 15, paddingBottom: 16, borderTopColor: colors.line, borderTopWidth: 1 },
  tipBox: { backgroundColor: '#F2F5E7', borderRadius: radius.sm, padding: 12, marginTop: 14 },
  tipLabel: { color: '#506316', fontSize: 10, fontWeight: '900' },
  tipText: { color: colors.ink, fontSize: 12, lineHeight: 18, marginTop: 4 },
  exerciseList: { marginTop: 11 },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', minHeight: 49, gap: 10 },
  exerciseBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  exerciseIndex: { color: colors.limeDark, fontSize: 11, fontWeight: '900', width: 22 },
  exerciseInfo: { flex: 1 },
  exerciseName: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  exerciseMeta: { color: colors.inkMuted, fontSize: 10, marginTop: 3 },
  dayAction: { marginTop: 13 },
  finishText: { color: colors.green, fontSize: 12, fontWeight: '800', marginTop: 13 },
});
