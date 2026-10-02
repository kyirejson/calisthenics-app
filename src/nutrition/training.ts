import type { DailyWorkoutEdits, Profile, TrainingSession } from '../types';
import { getWorkoutExercises, workoutDisplayTitle } from '../data/catalog';
import { getDayTrainingState } from '../data/planProgress';
import { dailyWorkoutKey, sessionDateKey, trainingDateKey } from '../data/sessionRecords';
import { getPlanDay } from '../data/trainingPlans';
import { equipmentSessionPlan } from '../data/equipmentTraining';
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
  const state = getDayTrainingState({ ...resolved.day, date, type, ...(addedIds.length ? { workoutId } : {}) }, normalizedSessions, addedIds,
    profile.goal === 'equipment' && resolved.day.workoutId ? equipmentSessionPlan(resolved.day.workoutId, profile, date) : undefined);
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
