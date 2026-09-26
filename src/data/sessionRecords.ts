import type { DailyWorkoutEdits, SessionExercise, TrainingSession } from '../types';

export function trainingDateKey(date = new Date()) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export function sessionDateKey(session: TrainingSession) {
  return session.trainingDate || trainingDateKey(new Date(session.startedAt || session.completedAt));
}

export function dailyWorkoutKey(date: string, workoutId: string) {
  return `${date}:${workoutId}`;
}

export function completedExercises(exercises: SessionExercise[]): SessionExercise[] {
  return exercises.map((exercise) => ({
    ...exercise,
    sets: exercise.sets.filter((set) => set.completed && Number.isFinite(set.reps) && set.reps > 0),
  })).filter((exercise) => exercise.sets.length > 0);
}

export function cleanSession(session: TrainingSession): TrainingSession {
  const exercises = completedExercises(session.exercises);
  return {
    ...session,
    exercises,
    totalReps: exercises.flatMap((exercise) => exercise.sets)
      .filter((set) => !set.unit || set.unit === 'reps').reduce((sum, set) => sum + set.reps, 0),
  };
}

/** Viewing a strength workout is not training; running has no checkbox sets. */
export function normalizeTrainingSessions(sessions: readonly TrainingSession[]): TrainingSession[] {
  return sessions.map((session) => session.kind === 'running' ? session : cleanSession(session))
    .filter((session) => session.kind === 'running' || session.exercises.length > 0);
}

export function withoutTrainingDay(sessions: TrainingSession[], edits: DailyWorkoutEdits, date: string) {
  return {
    sessions: sessions.filter((session) => sessionDateKey(session) !== date),
    edits: Object.fromEntries(Object.entries(edits).filter(([, edit]) => edit.date !== date)),
  };
}

/** The 200-rep gate is a product rule, not a medical assessment or a book standard. */
export function headstandReadiness(sessions: readonly TrainingSession[], date = new Date()) {
  const totals = new Map<string, number>();
  const seen = new Set<string>();
  for (const session of sessions) {
    if (seen.has(session.id) || session.kind === 'running') continue;
    seen.add(session.id);
    for (const exercise of session.exercises) {
      if (exercise.exerciseId !== 'push_06') continue;
      for (const set of exercise.sets) {
        if (!set.completed || (set.unit && set.unit !== 'reps') || !Number.isInteger(set.reps) || set.reps <= 0) continue;
        const at = new Date(set.completedAt || session.startedAt || session.completedAt);
        if (!Number.isFinite(at.getTime()) || at > date) continue;
        const key = trainingDateKey(at);
        totals.set(key, (totals.get(key) || 0) + set.reps);
      }
    }
  }
  const qualifiedDay = [...totals.entries()].find(([, reps]) => reps >= 200)?.[0];
  return { unlocked: Boolean(qualifiedDay), qualifiedDay, bestDayReps: Math.max(0, ...totals.values()), todayReps: totals.get(trainingDateKey(date)) || 0, requiredReps: 200 };
}

export function usesHeadstandGate(profile: { goal: string; frequency: number; experience: string }) {
  return profile.goal === 'street_mastery';
}
