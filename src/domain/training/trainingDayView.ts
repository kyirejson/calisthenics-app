import type { DailyWorkoutEdits, Profile, TrainingSession } from '../../types';
import { getWorkout, getWorkoutExercises, workoutDisplayTitle } from './catalog';
import { getDayTrainingState } from './planProgress';
import { dailyWorkoutKey, trainingDateKey } from './sessionRecords';
import { getPlanDay } from './trainingPlans';
import { resumableSession } from './sessionResume';

/** Read-only view of one calendar day. This never saves or starts a session. */
export function getTrainingDayView(
  profile: Profile,
  sessions: TrainingSession[],
  edits: DailyWorkoutEdits,
  now: Date,
  selected: Date | null,
) {
  const date = selected && Number.isFinite(selected.getTime()) ? selected : now;
  const key = trainingDateKey(date);
  const isToday = key === trainingDateKey(now);
  const at = isToday
    ? now
    : new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
  const resolved = getPlanDay(profile, date);
  const editableWorkoutId = resolved.day.workoutId || 'custom_daily';
  const addedIds = edits[dailyWorkoutKey(key, editableWorkoutId)]?.exerciseIds || [];
  const workout = resolved.day.workoutId || addedIds.length ? getWorkout(editableWorkoutId) : null;
  const exercises = resumableSession(sessions, key, editableWorkoutId)?.resumeState?.items || (workout
    ? getWorkoutExercises(
        workout.id,
        profile,
        resolved.cycle.setMultiplier,
        resolved.cycle.dupDay,
        resolved.cycle.week,
        { sessions, date: at, addedExerciseIds: addedIds },
      )
    : []);
  const state = getDayTrainingState(
    {
      date,
      ...resolved.day,
      ...(workout?.id === 'custom_daily'
        ? { type: 'strength' as const, workoutId: workout.id }
        : {}),
    },
    sessions,
    addedIds,
  );
  const title = workoutDisplayTitle(resolved.day.title, exercises)
    .replace(/^(初试身手|渐入佳境|炉火纯青|闭关修炼|登峰造极)\s*·\s*/, '')
    .replace(/\s*[（(](握力|小腿|颈部)[）)]$/, '');
  return {
    date,
    key,
    isToday,
    resolved,
    editableWorkoutId,
    addedIds,
    workout,
    exercises,
    state,
    title,
  };
}
