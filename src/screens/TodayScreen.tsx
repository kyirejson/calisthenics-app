import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, Card, Header, Page, ProgressBar, SectionTitle, commonStyles } from '../components/ui';
import { getWorkout, getWorkoutExercises, todayWorkoutId } from '../data/catalog';
import { useAppStore } from '../store/AppStore';
import { colors, radius } from '../theme';

export function TodayScreen({ onStart, onRun, onPlans }: { onStart: (workoutId: string) => void; onRun: () => void; onPlans: () => void }) {
  const { profile, sessions } = useAppStore();
  if (!profile) return null;
  const now = new Date();
  const workoutId = todayWorkoutId(profile.frequency, now);
  const workout = workoutId ? getWorkout(workoutId) : null;
  const workoutExercises = workout ? getWorkoutExercises(workout.id, profile) : [];
  const todayKey = localDate(now);
  const completedToday = sessions.find((session) => localDate(new Date(session.completedAt)) === todayKey && session.kind !== 'running');
  const streak = useMemo(() => calculateStreak(sessions.map((item) => item.completedAt)), [sessions]);
  const last7Count = sessions.filter((item) => Date.now() - new Date(item.completedAt).getTime() < 7 * 86400000).length;
  const bmr = Math.round(10 * profile.weight + 6.25 * profile.height - 5 * profile.age + (profile.sex === 'male' ? 5 : -161));
  const targetCalories = Math.round(bmr * (1.35 + profile.frequency * 0.06) + (profile.goal === 'gain' ? 250 : profile.goal === 'cut' ? -300 : 0));

  return (
    <Page>
      <Header eyebrow={formatDate(now)} title={`${greeting()}, ${profile.name}`} right={<View style={styles.streak}><Text style={styles.streakNum}>{streak}</Text><Text style={styles.streakLabel}>连续</Text></View>} />
      <LinearGradient colors={completedToday ? ['#244E3C', '#193428'] : ['#1C1E19', '#2D3321']} style={styles.heroCard}>
        <View style={styles.heroTop}><Text style={styles.heroKicker}>{completedToday ? 'TODAY · 已完成' : workout ? 'TODAY · 计划训练' : 'TODAY · 主动恢复'}</Text><Text style={styles.heroBadge}>{workout ? `${workout.estimatedMinutes} 分钟` : '休息日'}</Text></View>
        <Text style={styles.heroTitle}>{completedToday ? '今天很强，训练已完成' : workout?.name || '让身体恢复得更好'}</Text>
        <Text style={styles.heroDesc}>{completedToday ? `${completedToday.totalReps} 次动作 · ${Math.ceil(completedToday.durationSeconds / 60)} 分钟` : workout?.description || '散步、拉伸、补充睡眠，恢复也是计划的一部分。'}</Text>
        {workout && !completedToday ? (
          <>
            <View style={styles.exerciseDots}>{workoutExercises.slice(0, 5).map((exercise, index) => <View key={exercise.id} style={[styles.exerciseDot, index === 0 && { backgroundColor: colors.lime }]}><Text style={styles.exerciseDotText}>{exercise.name.slice(0, 1)}</Text></View>)}<Text style={styles.exerciseCount}>{workoutExercises.length} 个动作</Text></View>
            <Button label="开始训练  →" variant="lime" onPress={() => onStart(workout.id)} />
          </>
        ) : !workout ? <Button label="临时加练" variant="lime" onPress={() => onStart('fullA')} /> : null}
      </LinearGradient>

      <SectionTitle title="本周状态" action="调整计划" onAction={onPlans} />
      <View style={styles.metrics}>
        <Card style={styles.metric}><Text style={styles.metricLabel}>完成训练</Text><Text style={styles.metricValue}>{last7Count}<Text style={styles.metricUnit}> 次</Text></Text><ProgressBar value={(last7Count / profile.frequency) * 100} /></Card>
        <Card style={styles.metric}><Text style={styles.metricLabel}>计划频率</Text><Text style={styles.metricValue}>{profile.frequency}<Text style={styles.metricUnit}> 天</Text></Text><Text style={styles.metricHint}>每周目标</Text></Card>
      </View>

      <SectionTitle title="今日能量" />
      <Card>
        <View style={commonStyles.between}><View><Text style={styles.calorieLabel}>建议摄入</Text><Text style={styles.calorie}>{targetCalories}<Text style={styles.calorieUnit}> kcal</Text></Text></View><View style={styles.goalBadge}><Text style={styles.goalBadgeText}>{goalName(profile.goal)}</Text></View></View>
        <View style={styles.macroRow}><Macro label="蛋白质" value={`${Math.round(profile.weight * 1.8)}g`} color={colors.orange} /><Macro label="碳水" value={`${Math.round(targetCalories * 0.48 / 4)}g`} color={colors.blue} /><Macro label="脂肪" value={`${Math.round(targetCalories * 0.25 / 9)}g`} color={colors.green} /></View>
      </Card>

      <SectionTitle title="自由训练" />
      <Pressable onPress={onRun} style={styles.runCard}><View style={styles.runIcon}><Text style={styles.runIconText}>↗</Text></View><View style={{ flex: 1 }}><Text style={commonStyles.h3}>户外跑步</Text><Text style={commonStyles.muted}>GPS 记录距离、时长与实时配速</Text></View><Text style={styles.chevron}>›</Text></Pressable>
    </Page>
  );
}

function Macro({ label, value, color }: { label: string; value: string; color: string }) { return <View style={styles.macro}><View style={[styles.macroDot, { backgroundColor: color }]} /><Text style={styles.macroLabel}>{label}</Text><Text style={styles.macroValue}>{value}</Text></View>; }
function localDate(date: Date) { return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`; }
function calculateStreak(values: string[]) { const dates = new Set(values.map((v) => localDate(new Date(v)))); let count = 0; const d = new Date(); for (let i = 0; i < 365; i++) { if (!dates.has(localDate(d))) { if (i === 0) { d.setDate(d.getDate() - 1); continue; } break; } count++; d.setDate(d.getDate() - 1); } return count; }
function greeting() { const h = new Date().getHours(); return h < 11 ? '早上好' : h < 18 ? '下午好' : '晚上好'; }
function formatDate(d: Date) { return `${d.getMonth() + 1}月${d.getDate()}日 · ${['周日','周一','周二','周三','周四','周五','周六'][d.getDay()]}`; }
function goalName(goal: string) { return ({ strength: '力量提升', gain: '增肌', cut: '减脂', health: '健康' } as Record<string,string>)[goal] || goal; }

const styles = StyleSheet.create({
  streak: { width: 52, height: 52, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }, streakNum: { color: colors.ink, fontWeight: '900', fontSize: 19 }, streakLabel: { color: colors.inkMuted, fontSize: 9, fontWeight: '700' },
  heroCard: { borderRadius: radius.lg, padding: 22, overflow: 'hidden' }, heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, heroKicker: { color: colors.lime, fontSize: 11, fontWeight: '900', letterSpacing: 1.1 }, heroBadge: { color: '#C7CAC0', fontSize: 12, fontWeight: '700' }, heroTitle: { color: '#FFFFFF', fontSize: 27, lineHeight: 33, fontWeight: '900', letterSpacing: -0.8, marginTop: 28 }, heroDesc: { color: '#BFC2B7', fontSize: 14, lineHeight: 21, marginTop: 9, marginBottom: 20 },
  exerciseDots: { flexDirection: 'row', alignItems: 'center', marginBottom: 22 }, exerciseDot: { width: 34, height: 34, marginRight: -6, borderRadius: 17, backgroundColor: '#4B4F44', borderWidth: 2, borderColor: '#24271F', alignItems: 'center', justifyContent: 'center' }, exerciseDotText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' }, exerciseCount: { marginLeft: 14, color: '#BFC2B7', fontSize: 12, fontWeight: '700' },
  metrics: { flexDirection: 'row', gap: 12 }, metric: { flex: 1, minHeight: 130 }, metricLabel: { color: colors.inkMuted, fontSize: 12, fontWeight: '700' }, metricValue: { color: colors.ink, fontSize: 32, fontWeight: '900', marginVertical: 12 }, metricUnit: { fontSize: 13, color: colors.inkMuted }, metricHint: { color: colors.inkMuted, fontSize: 12, marginTop: 3 },
  calorieLabel: { color: colors.inkMuted, fontSize: 12, fontWeight: '700' }, calorie: { color: colors.ink, fontSize: 31, fontWeight: '900', marginTop: 3 }, calorieUnit: { fontSize: 13, color: colors.inkMuted }, goalBadge: { backgroundColor: '#EEF3DA', borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 12 }, goalBadgeText: { color: '#52611C', fontWeight: '800', fontSize: 12 }, macroRow: { flexDirection: 'row', marginTop: 22, paddingTop: 17, borderTopWidth: 1, borderTopColor: colors.line }, macro: { flex: 1 }, macroDot: { width: 7, height: 7, borderRadius: 4, marginBottom: 6 }, macroLabel: { color: colors.inkMuted, fontSize: 11 }, macroValue: { color: colors.ink, fontWeight: '800', marginTop: 3 },
  runCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }, runIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#E7EDFF', alignItems: 'center', justifyContent: 'center' }, runIconText: { color: colors.blue, fontSize: 22, fontWeight: '900' }, chevron: { color: colors.inkMuted, fontSize: 28 },
});
