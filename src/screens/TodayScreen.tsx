import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, Card, Header, Page, ProgressBar, SectionTitle, commonStyles } from '../components/ui';
import { getWorkout, getWorkoutExercises } from '../data/catalog';
import { calculateNutritionPlan } from '../data/nutritionPlanner';
import { getPlanDay } from '../data/trainingPlans';
import { useAppStore } from '../store/AppStore';
import { colors, radius } from '../theme';

type Props = {
  onStart: (workoutId: string, setMultiplier?: number, rirTarget?: number) => void;
  onRun: () => void;
  onPlans: () => void;
  onNutrition: () => void;
};

export function TodayScreen({ onStart, onRun, onPlans, onNutrition }: Props) {
  const { profile, sessions } = useAppStore();
  if (!profile) return null;
  const now = new Date();
  const resolved = getPlanDay(profile, now);
  const workout = resolved.day.type === 'strength' && resolved.day.workoutId ? getWorkout(resolved.day.workoutId) : null;
  const workoutExercises = workout ? getWorkoutExercises(workout.id, profile, resolved.cycle.setMultiplier) : [];
  const todayKey = localDate(now);
  const completedSessions = sessions.filter((session) => session.completion !== 'partial');
  const completedStrength = completedSessions.find((session) => localDate(new Date(session.completedAt)) === todayKey && session.kind !== 'running' && (!workout || session.workoutId === workout.id));
  const anyStrengthToday = completedSessions.find((session) => localDate(new Date(session.completedAt)) === todayKey && session.kind !== 'running');
  const completedRun = sessions.find((session) => localDate(new Date(session.completedAt)) === todayKey && session.kind === 'running');
  const completedForPlan = resolved.day.type === 'cardio' ? completedRun : resolved.day.type === 'strength' ? completedStrength : anyStrengthToday;
  const streak = useMemo(() => calculateStreak(sessions.filter((item) => item.completion !== 'partial').map((item) => item.completedAt)), [sessions]);
  const strengthLast7 = sessions.filter((item) => item.kind !== 'running' && item.completion !== 'partial' && Date.now() - new Date(item.completedAt).getTime() < 7 * 86400000).length;
  const nutrition = calculateNutritionPlan({ ...profile, frequency: resolved.plan.frequency }, resolved.day.type !== 'recovery');

  return <Page>
    <Header eyebrow={formatDate(now)} title={`${greeting()}, ${profile.name}`} right={<View style={styles.streak}><Text style={styles.streakNum}>{streak}</Text><Text style={styles.streakLabel}>连续</Text></View>} />
    <LinearGradient colors={completedForPlan ? ['#244E3C', '#193428'] : ['#1C1E19', '#2D3321']} style={styles.heroCard}>
      <View style={styles.heroTop}><Text style={styles.heroKicker}>{completedForPlan ? 'TODAY · 已完成' : `TODAY · ${resolved.plan.shortName}`}</Text><Text style={styles.heroBadge}>{resolved.cycle.label} · RIR {resolved.cycle.rirTarget}</Text></View>
      <Text style={styles.heroTitle}>{completedForPlan ? '今天的计划已完成' : resolved.day.title}</Text>
      <Text style={styles.heroDesc}>{completedForPlan ? `${completedForPlan.kind === 'running' ? `${completedForPlan.distanceKm || 0} 公里` : `${completedForPlan.totalReps} 次动作`} · ${Math.ceil(completedForPlan.durationSeconds / 60)} 分钟` : resolved.day.tip}</Text>
      {workout && !completedForPlan ? <>
        <View style={styles.exerciseDots}>{workoutExercises.slice(0, 5).map((exercise, index) => <View key={exercise.id} style={[styles.exerciseDot, index === 0 && { backgroundColor: colors.lime }]}><Text style={styles.exerciseDotText}>{exercise.name.slice(0, 1)}</Text></View>)}<Text style={styles.exerciseCount}>{workoutExercises.length} 个动作 · 约 {workout.estimatedMinutes} 分钟</Text></View>
        <Button label="开始今日训练  →" variant="lime" onPress={() => onStart(workout.id, resolved.cycle.setMultiplier, resolved.cycle.rirTarget)} />
      </> : resolved.day.type === 'cardio' && !completedForPlan ? <Button label="开始有氧记录  →" variant="lime" onPress={onRun} /> : resolved.day.type === 'recovery' ? <Button label="今天想临时加练" variant="lime" onPress={() => onStart('fullA', 0.75, 3)} /> : null}
    </LinearGradient>

    <SectionTitle title="本周训练" action="查看计划" onAction={onPlans} />
    <View style={styles.metrics}>
      <Card style={styles.metric}><Text style={styles.metricLabel}>力量训练</Text><Text style={styles.metricValue}>{strengthLast7}<Text style={styles.metricUnit}> 次</Text></Text><ProgressBar value={(strengthLast7 / Math.max(1, resolved.plan.frequency)) * 100} /></Card>
      <Card style={styles.metric}><Text style={styles.metricLabel}>周期阶段</Text><Text style={styles.phaseValue}>{resolved.cycle.label}</Text><Text style={styles.metricHint}>第 {resolved.cycle.week} 周 · 组数 {Math.round(resolved.cycle.setMultiplier * 100)}%</Text></Card>
    </View>

    <SectionTitle title="今日能量" action="完整饮食计划" onAction={onNutrition} />
    <Pressable onPress={onNutrition}><Card>
      {nutrition.safetyLevel === 'blocked' ? <>
        <Text style={styles.calorieLabel}>营养计划已启用安全保护</Text>
        <Text style={styles.safetyTitle}>{nutrition.safetyTitle || '请先核对身体资料'}</Text>
        <Text style={styles.safetyBody}>{nutrition.safetyMessage}</Text>
        <Text style={styles.openHint}>查看均衡饮食建议  ›</Text>
      </> : <>
        <View style={commonStyles.between}><View><Text style={styles.calorieLabel}>今日计划摄入</Text><Text style={styles.calorie}>{nutrition.targetCalories}<Text style={styles.calorieUnit}> kcal</Text></Text></View><View style={styles.goalBadge}><Text style={styles.goalBadgeText}>{nutrition.goalLabel}</Text></View></View>
        <Text style={styles.energyHint}>维持消耗约 {nutrition.tdee} kcal · {nutrition.calorieDelta > 0 ? '盈余' : '缺口'} {Math.abs(nutrition.calorieDelta)} kcal</Text>
        <View style={styles.macroRow}><Macro label="蛋白质" value={`${nutrition.protein}g`} color={colors.orange} /><Macro label="碳水" value={`${nutrition.carbs}g`} color={colors.blue} /><Macro label="脂肪" value={`${nutrition.fat}g`} color={colors.green} /></View>
        {nutrition.safetyLevel === 'warning' ? <Text style={styles.energyHint}>⚠ {nutrition.safetyTitle} · 点击查看说明</Text> : null}
        <Text style={styles.openHint}>查看四餐安排与饮食模式  ›</Text>
      </>}
    </Card></Pressable>

    <SectionTitle title="自由训练" />
    <Pressable onPress={onRun} style={styles.runCard}><View style={styles.runIcon}><Text style={styles.runIconText}>↗</Text></View><View style={{ flex: 1 }}><Text style={commonStyles.h3}>户外跑步</Text><Text style={commonStyles.muted}>GPS 记录距离、时长与实时配速</Text></View><Text style={styles.chevron}>›</Text></Pressable>
  </Page>;
}

function Macro({ label, value, color }: { label: string; value: string; color: string }) { return <View style={styles.macro}><View style={[styles.macroDot, { backgroundColor: color }]} /><Text style={styles.macroLabel}>{label}</Text><Text style={styles.macroValue}>{value}</Text></View>; }
function localDate(date: Date) { return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`; }
function calculateStreak(values: string[]) { const dates = new Set(values.map((v) => localDate(new Date(v)))); let count = 0; const d = new Date(); for (let i = 0; i < 365; i++) { if (!dates.has(localDate(d))) { if (i === 0) { d.setDate(d.getDate() - 1); continue; } break; } count++; d.setDate(d.getDate() - 1); } return count; }
function greeting() { const h = new Date().getHours(); return h < 11 ? '早上好' : h < 18 ? '下午好' : '晚上好'; }
function formatDate(d: Date) { return `${d.getMonth() + 1}月${d.getDate()}日 · ${['周日','周一','周二','周三','周四','周五','周六'][d.getDay()]}`; }

const styles = StyleSheet.create({
  streak: { width: 52, height: 52, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }, streakNum: { color: colors.ink, fontWeight: '900', fontSize: 19 }, streakLabel: { color: colors.inkMuted, fontSize: 9, fontWeight: '700' },
  heroCard: { borderRadius: radius.lg, padding: 22, overflow: 'hidden' }, heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, heroKicker: { color: colors.lime, fontSize: 11, fontWeight: '900', letterSpacing: 1.1 }, heroBadge: { color: '#C7CAC0', fontSize: 11, fontWeight: '700' }, heroTitle: { color: '#FFFFFF', fontSize: 27, lineHeight: 33, fontWeight: '900', letterSpacing: -0.8, marginTop: 28 }, heroDesc: { color: '#BFC2B7', fontSize: 14, lineHeight: 21, marginTop: 9, marginBottom: 20 },
  exerciseDots: { flexDirection: 'row', alignItems: 'center', marginBottom: 22 }, exerciseDot: { width: 34, height: 34, marginRight: -6, borderRadius: 17, backgroundColor: '#4B4F44', borderWidth: 2, borderColor: '#24271F', alignItems: 'center', justifyContent: 'center' }, exerciseDotText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' }, exerciseCount: { marginLeft: 14, color: '#BFC2B7', fontSize: 11, fontWeight: '700' },
  metrics: { flexDirection: 'row', gap: 12 }, metric: { flex: 1, minHeight: 130 }, metricLabel: { color: colors.inkMuted, fontSize: 12, fontWeight: '700' }, metricValue: { color: colors.ink, fontSize: 32, fontWeight: '900', marginVertical: 12 }, metricUnit: { fontSize: 13, color: colors.inkMuted }, metricHint: { color: colors.inkMuted, fontSize: 11, marginTop: 8, lineHeight: 16 }, phaseValue: { color: colors.ink, fontSize: 21, fontWeight: '900', marginTop: 18 },
  calorieLabel: { color: colors.inkMuted, fontSize: 12, fontWeight: '700' }, calorie: { color: colors.ink, fontSize: 31, fontWeight: '900', marginTop: 3 }, calorieUnit: { fontSize: 13, color: colors.inkMuted }, goalBadge: { backgroundColor: '#EEF3DA', borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 12 }, goalBadgeText: { color: '#52611C', fontWeight: '800', fontSize: 12 }, energyHint: { color: colors.inkMuted, fontSize: 11, marginTop: 8 }, safetyTitle: { color: colors.ink, fontSize: 18, fontWeight: '900', marginTop: 8 }, safetyBody: { color: colors.inkMuted, fontSize: 11, lineHeight: 18, marginTop: 7 }, macroRow: { flexDirection: 'row', marginTop: 18, paddingTop: 15, borderTopWidth: 1, borderTopColor: colors.line }, macro: { flex: 1 }, macroDot: { width: 7, height: 7, borderRadius: 4, marginBottom: 6 }, macroLabel: { color: colors.inkMuted, fontSize: 11 }, macroValue: { color: colors.ink, fontWeight: '800', marginTop: 3 }, openHint: { color: colors.blue, fontSize: 11, fontWeight: '800', marginTop: 17 },
  runCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }, runIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#E7EDFF', alignItems: 'center', justifyContent: 'center' }, runIconText: { color: colors.blue, fontSize: 22, fontWeight: '900' }, chevron: { color: colors.inkMuted, fontSize: 28 },
});
