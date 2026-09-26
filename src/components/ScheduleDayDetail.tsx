import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getWorkout, getWorkoutExercises, workoutDisplayTitle } from '../data/catalog';
import type { ScheduledDay } from '../data/planProgress';
import { getPlanDay, plannedCardioMinutes } from '../data/trainingPlans';
import { estimateStrengthSession, preferredSessionMinutes } from '../data/trainingPrescription';
import { colors, radius } from '../theme';
import type { Profile, TrainingSession } from '../types';
import { ExercisePhoto } from './ExerciseResource';
import { RecoveryDayContent } from './RecoveryGuide';
import { dailyWorkoutKey, trainingDateKey } from '../data/sessionRecords';
import { useAppStore } from '../store/AppStore';

export function ScheduleDayDetail({ profile, day, sessions, onOpenExercise }: {
  profile: Profile;
  day: ScheduledDay;
  sessions: TrainingSession[];
  onOpenExercise: (exerciseId: string) => void;
}) {
  const { dailyEdits } = useAppStore();
  const editableWorkoutId = day.workoutId || 'custom_daily';
  const addedIds = dailyEdits[dailyWorkoutKey(trainingDateKey(day.date), editableWorkoutId)]?.exerciseIds || [];
  const workout = day.workoutId || addedIds.length ? getWorkout(editableWorkoutId) : null;
  const cycle = workout ? getPlanDay(profile, day.date).cycle : null;
  const at = trainingDateKey(day.date) === trainingDateKey() ? new Date() : new Date(day.date.getFullYear(), day.date.getMonth(), day.date.getDate(), 23, 59, 59);
  const exercises = workout && cycle ? getWorkoutExercises(workout.id, profile, cycle.setMultiplier, cycle.dupDay, cycle.week, { sessions, date: at, addedExerciseIds: addedIds }) : [];
  const estimate = workout ? estimateStrengthSession(exercises, preferredSessionMinutes(profile), profile.goal === 'street_mastery') : null;

  return <View style={styles.card}>
    <Text style={styles.title}>{workoutDisplayTitle(day.title, exercises)}</Text>
    {estimate ? <Text style={styles.meta}>{exercises.length} 个动作 · 预计 {estimate.totalMinutes} 分钟 · 点击动作查看图解与技巧</Text> : null}
    <View style={styles.tip}><Text style={styles.tipLabel}>{day.type === 'recovery' ? '恢复建议' : '注意事项'}</Text><Text style={styles.tipText}>{day.tip}</Text></View>
    {day.type === 'recovery' && !day.workoutId ? <View style={styles.recoveryWrap}><RecoveryDayContent dayOfWeek={day.date.getDay()} weightLoss={profile.goal === 'weight_loss'} profile={profile} /></View> : null}
    {day.type === 'cardio' ? <View style={styles.exercise}>
      <View style={styles.cardioImage}><Text style={styles.cardioIcon}>{profile.goal === 'weight_loss' ? '🚶' : '🏃'}</Text></View>
      <View style={styles.exerciseMain}><Text style={styles.exerciseOrder}>轻松活动</Text><Text style={styles.exerciseName}>{profile.goal === 'weight_loss' || profile.goal === 'street_mastery' ? '快走或舒适骑行' : '快走或轻松跑'}</Text><Text style={styles.exerciseMeta}>活动 {day.targetMinutes || plannedCardioMinutes(profile)} 分钟 · 另留 8 分钟热身与整理</Text></View>
    </View> : null}
    {exercises.map((exercise, index) => <Pressable accessibilityRole="button" accessibilityLabel={`查看${exercise.name}动作指导`} onPress={() => onOpenExercise(exercise.id)} key={`${exercise.id}-${index}`} style={styles.exercise}>
      <View style={styles.exerciseImage}><ExercisePhoto exercise={exercise} resizeMode="contain" showShade={false} showTag={false} compact style={styles.exercisePhoto} /></View>
      <View style={styles.exerciseMain}><Text style={styles.exerciseOrder}>动作 {String(index + 1).padStart(2, '0')}</Text><Text style={styles.exerciseName}>{exercise.name}</Text><Text style={styles.exerciseMeta}>{exercise.targetSets} 组 × {exercise.targetValue} {exercise.targetUnit === 'seconds' ? '秒' : exercise.targetUnit === 'meters' ? '米' : exercise.targetUnit === 'steps' ? '步' : '次'}{exercise.id === 'aux_singleLegCalf' ? '（左右合计）' : ''} · 休息 {exercise.restSeconds} 秒</Text></View><Text style={styles.exerciseArrow}>›</Text>
    </Pressable>)}
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 16 },
  title: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  meta: { color: colors.inkMuted, fontSize: 11, marginTop: 4 },
  tip: { backgroundColor: '#F2F5E8', borderRadius: radius.sm, padding: 11, marginTop: 12 },
  tipLabel: { color: colors.green, fontSize: 10, fontWeight: '900' },
  tipText: { color: colors.ink, fontSize: 11, lineHeight: 17, marginTop: 4 },
  recoveryWrap: { marginTop: 10 },
  exercise: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.line, marginTop: 12, paddingTop: 12 },
  exerciseImage: { width: 78, height: 72, borderRadius: 12, overflow: 'hidden', backgroundColor: '#F0F0EA', marginRight: 12 },
  cardioImage: { width: 78, height: 72, borderRadius: 12, backgroundColor: '#E9F3E5', marginRight: 12, alignItems: 'center', justifyContent: 'center' },
  cardioIcon: { fontSize: 34 },
  exercisePhoto: { backgroundColor: '#F0F0EA' },
  exerciseMain: { flex: 1 },
  exerciseOrder: { color: colors.limeDark, fontSize: 9, fontWeight: '900' },
  exerciseName: { color: colors.ink, fontSize: 13, fontWeight: '900', marginTop: 4 },
  exerciseMeta: { color: colors.inkMuted, fontSize: 10, lineHeight: 15, marginTop: 4 },
  exerciseArrow: { color: colors.inkMuted, fontSize: 20, marginLeft: 5 },
});
