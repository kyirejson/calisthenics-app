import type { DailyWorkoutEdits, Profile, TrainingSession } from '../types';
import { getCycleMeta, getWeekSchedule } from '../data/trainingPlans';
import { getWorkoutExercises } from '../data/catalog';
import { equipmentPlanReview } from '../data/equipmentPlanReview';
import { equipmentAvailableGear, equipmentSplitConfig, equipmentSplitFrequencies } from '../data/equipmentTraining';
import { localWeightDate } from '../data/weightTrend';
import { validCompletedSets, validHistorySessions } from '../data/trainingHistory';
import { trainingGoalLabel } from '../data/trainingGoals';
import { dailyWorkoutKey } from '../data/sessionRecords';

export function assistantTrainingSnapshot(profile: Profile, sessions: TrainingSession[], edits: DailyWorkoutEdits, now = new Date()) {
  const week = getWeekSchedule(profile, now), review = profile.goal === 'equipment' ? equipmentPlanReview(profile, now) : null;
  return {
    topic: profile.goal, label: trainingGoalLabel(profile.goal), date: localWeightDate(now), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    planId: profile.planId, frequency: profile.frequency,
    ...(profile.goal === 'equipment' ? { split: equipmentSplitConfig(profile), allowedFrequencies: equipmentSplitFrequencies[equipmentSplitConfig(profile)], gear: equipmentAvailableGear(profile), audit: { status: review!.status, issues: review!.issues } } : {}),
    ...(profile.goal === 'street_mastery' ? { levels: profile.levels } : {}),
    week: week.map((day, index) => {
      const meta = getCycleMeta(profile, day.date);
      const items = review ? review.courses.find(course => course.workoutId === day.workoutId)?.items || []
        : day.workoutId ? getWorkoutExercises(day.workoutId, profile, meta.setMultiplier, meta.dupDay, meta.cycleWeek, { sessions, date: day.date, addedExerciseIds: edits[dailyWorkoutKey(localWeightDate(day.date), day.workoutId)]?.exerciseIds }) : [];
      return { date: localWeightDate(day.date), title: day.title, type: day.type, actions: items.map(item => ({ id: item.id, name: item.name, sets: item.targetSets, value: item.targetValue, unit: item.targetUnit })), index };
    }),
    recentActual: validHistorySessions(sessions, now).sort((a, b) => b.completedAt.localeCompare(a.completedAt)).slice(0, 8).map(session => ({ id: session.id, date: session.trainingDate || localWeightDate(new Date(session.startedAt)), title: session.workoutName, completion: session.completion || 'partial', completedSets: session.exercises.reduce((sum, ex) => sum + validCompletedSets(ex, undefined, now).length, 0) })),
  };
}
export type AssistantTrainingSnapshot = ReturnType<typeof assistantTrainingSnapshot>;
