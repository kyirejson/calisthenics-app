import type { DailyWorkoutEdits, Profile, TrainingSession } from '../types';
import { getWorkoutExercises, workoutDisplayTitle } from '../data/catalog';
import { getDayTrainingState } from '../data/planProgress';
import { dailyWorkoutKey, sessionDateKey, trainingDateKey } from '../data/sessionRecords';
import { getPlanDay } from '../data/trainingPlans';
import { estimateStrengthSession, preferredSessionMinutes } from '../data/trainingPrescription';
import { localWeightDate } from '../data/weightTrend';
import { dateAtNoon, isValidDateKey } from './validation';
import type { NutritionTrainingContext, TrainingTime } from './types';

export function nutritionSessionDate(session: TrainingSession): string | null {
  const key = sessionDateKey(session);
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(key);
  if (!match) return null;
  const padded = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  return isValidDateKey(padded) ? padded : null;
}

export function meaningfulTrainingSessions(sessions: TrainingSession[], date: string): TrainingSession[] {
  return sessions.filter(session => nutritionSessionDate(session) === date && (session.kind === 'running'
    ? Number.isFinite(session.durationSeconds) && session.durationSeconds > 0
    : session.exercises.some(exercise => exercise.sets.some(set => set.completed && Number.isFinite(set.reps) && set.reps > 0))));
}

export function getNutritionTrainingContext(profile: Profile, sessions: TrainingSession[], edits: DailyWorkoutEdits, key = localWeightDate(new Date())): NutritionTrainingContext {
  const date = dateAtNoon(key);
  const resolved = getPlanDay(profile, date);
  const dateKey = trainingDateKey(date);
  const workoutId = resolved.day.workoutId || 'custom_daily';
  const addedIds = edits[dailyWorkoutKey(dateKey, workoutId)]?.exerciseIds || [];
  const items = resolved.day.workoutId || addedIds.length
    ? getWorkoutExercises(workoutId, profile, resolved.cycle.setMultiplier, resolved.cycle.dupDay, resolved.cycle.week, { sessions, date, addedExerciseIds: addedIds }) : [];
  const actual = meaningfulTrainingSessions(sessions, key);
  const normalizedSessions = actual.map(session => ({ ...session, trainingDate: dateKey }));
  const type = !resolved.day.workoutId && addedIds.length ? 'strength' : resolved.day.type;
  const state = getDayTrainingState({ ...resolved.day, date, type, ...(addedIds.length ? { workoutId } : {}) }, normalizedSessions, addedIds);
  const completedMinutes = Math.round(actual.reduce((sum, session) => sum + (Number.isFinite(session.durationSeconds) && session.durationSeconds > 0 ? session.durationSeconds : 0), 0) / 60);
  const completedSets = actual.reduce((sum, session) => sum + session.exercises.reduce((total, exercise) => total + exercise.sets.filter(set => set.completed && set.reps > 0).length, 0), 0);
  const rest = type === 'recovery' && !resolved.day.workoutId && !addedIds.length;
  // An extra workout on an originally free day is visible, but never converted
  // into a guessed calorie allowance.
  const observedType = rest && actual.length ? actual.some(session => session.kind !== 'running') ? 'strength' : 'cardio' : type;
  return {
    type: observedType, title: addedIds.length && !resolved.day.workoutId ? '今日自选训练' : rest && actual.length ? '今日额外训练' : workoutDisplayTitle(resolved.day.title, items),
    plannedMinutes: resolved.day.type === 'cardio' ? resolved.day.targetMinutes || 0
      : items.length ? estimateStrengthSession(items, preferredSessionMinutes(profile), profile.goal === 'street_mastery').totalMinutes : 0,
    completedMinutes, completedSets, sessionCount: actual.length,
    status: state.complete || (rest && actual.some(session => session.completion !== 'partial')) ? 'complete'
      : actual.length ? 'partial' : rest ? 'rest' : 'planned',
  };
}

export const trainingTimeLabels: Record<TrainingTime, string> = { unspecified: '未定', morning: '早上', midday: '中午', evening: '晚上' };

export function trainingNutritionGuidance(training: NutritionTrainingContext, time: TrainingTime): string {
  if (training.type === 'recovery') return '恢复日照常规律进餐，保留蛋白质和主食，不因休息自动扣减能量。';
  const timing = time === 'morning' ? '把早餐与训练前后的进餐衔接；胃肠不适时按耐受调整时间。'
    : time === 'midday' ? '把午餐与训练前后的进餐衔接；临近训练避免突然吃得很油腻。'
    : time === 'evening' ? '把加餐、晚餐与训练前后衔接，不必为错过短暂“窗口”焦虑。'
    : '选一个常用训练时段，让菜单分配更贴近日程；也可以保持当前餐次。';
  return training.type === 'strength' ? `${timing}全天蛋白质优先分散到各餐。`
    : `${timing}以平时耐受的主食搭配蛋白质，不自动开具运动饮料或补剂方案。`;
}
