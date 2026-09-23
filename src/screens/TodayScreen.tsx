import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, Card, Header, Page, ProgressBar, SectionTitle } from '../components/ui';
import { getWorkout, getWorkoutExercises } from '../data/catalog';
import { calculateNutritionPlan } from '../data/nutritionPlanner';
import { getDayTrainingState, getDisplayedSchedule, localDateKey } from '../data/planProgress';
import { getPlanDay, getTrainingPlan, recommendPlanId } from '../data/trainingPlans';
import { useAppStore } from '../store/AppStore';
import { colors, radius } from '../theme';
import type { Goal } from '../types';

type Props = {
  onStart: (workoutId: string, setMultiplier?: number, rirTarget?: number) => void;
  onRun: () => void;
  onPlans: () => void;
  onNutrition: () => void;
};

const goalChoices: Array<{ key: Goal; label: string }> = [
  { key: 'health', label: '健康体能' },
  { key: 'fat_loss', label: '减脂塑形' },
  { key: 'gain', label: '增肌积累' },
  { key: 'strength', label: '力量进阶' },
];

export function TodayScreen({ onStart, onRun, onPlans, onNutrition }: Props) {
  const { profile, sessions, saveProfile } = useAppStore();
  const [pendingGoal, setPendingGoal] = useState<Goal | null>(null);
  const [savingGoal, setSavingGoal] = useState(false);
  const [goalError, setGoalError] = useState('');
  if (!profile) return null;

  const now = new Date();
  const resolved = getPlanDay(profile, now);
  const currentGoal = pendingGoal || profile.goal;
  const goalChanged = currentGoal !== profile.goal;
  const nextPlanId = goalChanged ? recommendPlanId({ ...profile, goal: currentGoal }) : profile.planId;
  const nextPlan = getTrainingPlan(nextPlanId);
  const workout = resolved.day.type === 'strength' && resolved.day.workoutId ? getWorkout(resolved.day.workoutId) : null;
  const workoutExercises = workout ? getWorkoutExercises(workout.id, profile, resolved.cycle.setMultiplier) : [];
  const week = getDisplayedSchedule(profile, now);
  const plannedDays = week.filter((day) => day.type !== 'recovery');
  const completedDays = plannedDays.filter((day) => getDayTrainingState(day, sessions).complete).length;
  const todayState = getDayTrainingState({ date: now, ...resolved.day }, sessions);
  const streak = calculateStreak(sessions.filter((item) => item.completion !== 'partial').map((item) => item.completedAt));
  const nutrition = calculateNutritionPlan({ ...profile, frequency: resolved.plan.frequency }, resolved.day.type !== 'recovery');

  const applyGoal = async () => {
    if (!goalChanged || savingGoal) return;
    setSavingGoal(true);
    setGoalError('');
    try {
      await saveProfile({
        ...profile,
        goal: currentGoal,
        planId: nextPlanId,
        frequency: nextPlan.frequency,
        planStartedAt: nextPlanId === profile.planId ? profile.planStartedAt : new Date().toISOString(),
      });
      setPendingGoal(null);
    } catch {
      setGoalError('保存失败，请重试。');
    } finally {
      setSavingGoal(false);
    }
  };

  return <Page>
    <Header eyebrow={formatDate(now)} title={`${greeting()}，${profile.name}`} right={streak > 0 ? <View style={styles.streak}><Text style={styles.streakNum}>{streak}</Text><Text style={styles.streakLabel}>连续天数</Text></View> : null} />

    <Card style={styles.goalCard}>
      <View style={styles.goalHeader}><Text style={styles.goalTitle}>训练目标</Text><Text style={styles.goalPlan}>{resolved.plan.shortName} · 每周 {resolved.plan.frequency} 练</Text></View>
      <View style={styles.goalChoices}>{goalChoices.map((choice) => <Pressable key={choice.key} accessibilityRole="button" accessibilityState={{ selected: currentGoal === choice.key }} onPress={() => { setPendingGoal(choice.key === profile.goal ? null : choice.key); setGoalError(''); }} style={[styles.goalChoice, currentGoal === choice.key && styles.goalChoiceActive]}><Text style={[styles.goalChoiceText, currentGoal === choice.key && styles.goalChoiceTextActive]}>{choice.label}</Text></Pressable>)}</View>
      {goalChanged ? <View style={styles.goalChange}><Text style={styles.goalChangeText}>将安排「{nextPlan.shortName}」· 每周 {nextPlan.frequency} 练{nextPlanId !== profile.planId ? '，从适应周开始' : ''}</Text><Pressable disabled={savingGoal} onPress={() => void applyGoal()} style={styles.goalApply}><Text style={styles.goalApplyText}>{savingGoal ? '保存中' : '应用目标'}</Text></Pressable></View> : null}
      {goalError ? <Text style={styles.goalError}>{goalError}</Text> : null}
    </Card>

    <LinearGradient colors={todayState.complete ? ['#244E3C', '#193428'] : ['#1C1E19', '#2D3321']} style={styles.heroCard}>
      <View style={styles.heroTop}><Text style={styles.heroKicker}>{todayState.complete ? '今日 · 已完成' : '今日安排'}</Text><Text style={styles.heroBadge}>{resolved.cycle.label}</Text></View>
      <Text style={styles.heroTitle}>{todayState.complete ? '今天的训练已完成' : resolved.day.title}</Text>
      <Text style={styles.heroDesc}>{todayState.complete && todayState.session ? `${Math.max(1, Math.ceil(todayState.session.durationSeconds / 60))} 分钟 · ${todayState.session.kind === 'running' ? '有氧训练' : todayState.session.workoutName}` : resolved.day.tip}</Text>
      {workout && !todayState.complete ? <>
        <Text style={styles.workoutMeta}>{workoutExercises.length} 个动作 · 约 {workout.estimatedMinutes} 分钟 · 保留 {resolved.cycle.rirTarget} 次余力</Text>
        <Text style={styles.workoutNames} numberOfLines={2}>{workoutExercises.map((exercise) => exercise.name).join(' · ')}</Text>
        <Button label={todayState.partial ? '开始完整训练  →' : '开始今日训练  →'} variant="lime" onPress={() => onStart(workout.id, resolved.cycle.setMultiplier, resolved.cycle.rirTarget)} />
      </> : resolved.day.type === 'cardio' && !todayState.complete ? <Button label="记录今日有氧  →" variant="lime" onPress={onRun} /> : resolved.day.type === 'recovery' ? <Pressable onPress={onPlans} style={styles.recoveryLink}><Text style={styles.recoveryLinkText}>查看恢复安排  ›</Text></Pressable> : null}
    </LinearGradient>

    <SectionTitle title="训练进度" action="查看 7 天安排" onAction={onPlans} />
    <Pressable onPress={onPlans}><Card style={styles.progressCard}>
      <View style={styles.progressTop}><View><Text style={styles.progressLabel}>已完成课程</Text><Text style={styles.progressValue}>{completedDays}<Text style={styles.progressUnit}> / {plannedDays.length}</Text></Text></View><View style={styles.progressPhase}><Text style={styles.progressPhaseTitle}>第 {resolved.cycle.week} 周</Text><Text style={styles.progressPhaseText}>{resolved.cycle.label}</Text></View></View>
      <ProgressBar value={plannedDays.length ? completedDays / plannedDays.length * 100 : 0} />
    </Card></Pressable>

    <SectionTitle title="今日能量" action="查看饮食安排" onAction={onNutrition} />
    <Pressable onPress={onNutrition}><Card>
      {nutrition.safetyLevel === 'blocked' ? <>
        <Text style={styles.nutritionLabel}>饮食建议</Text>
        <Text style={styles.safetyTitle}>{nutrition.safetyTitle || '请核对身体资料'}</Text>
        <Text style={styles.safetyBody}>{nutrition.safetyMessage}</Text>
      </> : <>
        <View style={styles.nutritionTop}><View><Text style={styles.nutritionLabel}>{nutrition.goalLabel} · 今日计划摄入</Text><Text style={styles.calorie}>{nutrition.targetCalories}<Text style={styles.calorieUnit}> kcal</Text></Text></View><Text style={styles.nutritionArrow}>›</Text></View>
        <View style={styles.macroRow}><Macro label="蛋白质" value={`${nutrition.protein}g`} color={colors.orange} /><Macro label="碳水" value={`${nutrition.carbs}g`} color={colors.blue} /><Macro label="脂肪" value={`${nutrition.fat}g`} color={colors.green} /></View>
        {nutrition.safetyLevel === 'warning' ? <Text style={styles.nutritionWarning}>⚠ {nutrition.safetyTitle} · 查看说明</Text> : null}
      </>}
    </Card></Pressable>

    <SectionTitle title="其他训练" />
    <Pressable onPress={onRun} style={styles.runCard}><View style={styles.runIcon}><Text style={styles.runIconText}>↗</Text></View><View style={styles.runInfo}><Text style={styles.runTitle}>户外跑步</Text><Text style={styles.runSub}>记录路线、距离和配速</Text></View><Text style={styles.chevron}>›</Text></Pressable>
  </Page>;
}

function Macro({ label, value, color }: { label: string; value: string; color: string }) {
  return <View style={styles.macro}><View style={[styles.macroDot, { backgroundColor: color }]} /><Text style={styles.macroLabel}>{label}</Text><Text style={styles.macroValue}>{value}</Text></View>;
}

function calculateStreak(values: string[]) {
  const dates = new Set(values.map((value) => localDateKey(new Date(value))));
  let count = 0;
  const date = new Date();
  for (let i = 0; i < 365; i++) {
    if (!dates.has(localDateKey(date))) {
      if (i === 0) { date.setDate(date.getDate() - 1); continue; }
      break;
    }
    count++;
    date.setDate(date.getDate() - 1);
  }
  return count;
}

function greeting() {
  const hour = new Date().getHours();
  return hour < 11 ? '早上好' : hour < 18 ? '下午好' : '晚上好';
}

function formatDate(date: Date) {
  return `${date.getMonth() + 1}月${date.getDate()}日 · ${['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()]}`;
}

const styles = StyleSheet.create({
  streak: { minWidth: 55, height: 52, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 },
  streakNum: { color: colors.ink, fontWeight: '900', fontSize: 18 },
  streakLabel: { color: colors.inkMuted, fontSize: 8, fontWeight: '700' },
  goalCard: { padding: 15, marginBottom: 13 },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  goalTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  goalPlan: { color: colors.inkMuted, fontSize: 10, fontWeight: '700' },
  goalChoices: { flexDirection: 'row', gap: 5, marginTop: 12 },
  goalChoice: { flex: 1, minHeight: 37, borderRadius: 10, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  goalChoiceActive: { backgroundColor: colors.lime },
  goalChoiceText: { color: colors.inkMuted, fontSize: 10, fontWeight: '800' },
  goalChoiceTextActive: { color: colors.ink },
  goalChange: { borderTopColor: colors.line, borderTopWidth: 1, marginTop: 12, paddingTop: 11, flexDirection: 'row', alignItems: 'center', gap: 8 },
  goalChangeText: { color: colors.inkMuted, fontSize: 10, lineHeight: 15, flex: 1 },
  goalApply: { backgroundColor: colors.ink, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 9 },
  goalApplyText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  goalError: { color: colors.danger, fontSize: 11, marginTop: 8 },
  heroCard: { borderRadius: radius.lg, padding: 20, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroKicker: { color: colors.lime, fontSize: 11, fontWeight: '900' },
  heroBadge: { color: '#C7CAC0', fontSize: 11, fontWeight: '700' },
  heroTitle: { color: '#FFFFFF', fontSize: 25, lineHeight: 31, fontWeight: '900', letterSpacing: -0.6, marginTop: 20 },
  heroDesc: { color: '#BFC2B7', fontSize: 13, lineHeight: 20, marginTop: 8 },
  workoutMeta: { color: colors.lime, fontSize: 11, fontWeight: '800', marginTop: 14 },
  workoutNames: { color: '#C7CAC0', fontSize: 11, lineHeight: 17, marginTop: 5, marginBottom: 17 },
  recoveryLink: { alignSelf: 'flex-start', marginTop: 18, borderBottomColor: colors.lime, borderBottomWidth: 1, paddingBottom: 3 },
  recoveryLinkText: { color: colors.lime, fontSize: 13, fontWeight: '800' },
  progressCard: { paddingVertical: 16 },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  progressLabel: { color: colors.inkMuted, fontSize: 11, fontWeight: '700' },
  progressValue: { color: colors.ink, fontSize: 28, fontWeight: '900', marginTop: 2 },
  progressUnit: { color: colors.inkMuted, fontSize: 13 },
  progressPhase: { alignItems: 'flex-end' },
  progressPhaseTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  progressPhaseText: { color: colors.inkMuted, fontSize: 10, marginTop: 4 },
  nutritionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nutritionLabel: { color: colors.inkMuted, fontSize: 11, fontWeight: '700' },
  calorie: { color: colors.ink, fontSize: 30, fontWeight: '900', marginTop: 4 },
  calorieUnit: { color: colors.inkMuted, fontSize: 12 },
  nutritionArrow: { color: colors.inkMuted, fontSize: 26 },
  macroRow: { flexDirection: 'row', marginTop: 14, paddingTop: 13, borderTopWidth: 1, borderTopColor: colors.line },
  macro: { flex: 1 },
  macroDot: { width: 6, height: 6, borderRadius: 3, marginBottom: 5 },
  macroLabel: { color: colors.inkMuted, fontSize: 10 },
  macroValue: { color: colors.ink, fontWeight: '800', fontSize: 12, marginTop: 2 },
  nutritionWarning: { color: colors.danger, fontSize: 10, marginTop: 12 },
  safetyTitle: { color: colors.ink, fontSize: 16, fontWeight: '900', marginTop: 7 },
  safetyBody: { color: colors.inkMuted, fontSize: 11, lineHeight: 17, marginTop: 6 },
  runCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  runIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#E7EDFF', alignItems: 'center', justifyContent: 'center' },
  runIconText: { color: colors.blue, fontSize: 20, fontWeight: '900' },
  runInfo: { flex: 1 },
  runTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  runSub: { color: colors.inkMuted, fontSize: 11, marginTop: 3 },
  chevron: { color: colors.inkMuted, fontSize: 25 },
});
