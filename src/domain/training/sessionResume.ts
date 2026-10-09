import type { TrainingSession } from '../../types';
import type { PrescribedExercise } from './trainingPrescription';
import { sessionDateKey, normalizeTrainingDate } from './sessionRecords';

export function resumableSession(sessions: readonly TrainingSession[], date: string, workoutId: string) {
  return sessions.filter(session => session.kind !== 'running' && session.workoutId === workoutId &&
    sessionDateKey(session) === normalizeTrainingDate(date) && session.completion === 'partial' && session.inProgress !== false)
    .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))[0];
}
export function restoreCourseSets(items: readonly PrescribedExercise[], session?: TrainingSession) {
  return Object.fromEntries(items.map(item => {
    const saved = session?.resumeState?.sets[item.id];
    if (saved?.length) return [item.id, saved.map(set => ({ ...set }))];
    const done = session?.exercises.find(exercise => exercise.exerciseId === item.id)?.sets || [];
    return [item.id, Array.from({ length: Math.max(item.targetSets, done.length) }, (_, index) => {
      const set = done[index];
      return set ? { reps: String(set.reps), load: set.loadKg === undefined ? '' : String(set.loadKg),
        rir: set.rir === undefined ? '' : String(set.rir), completed: true, completedAt: set.completedAt } :
        { reps: item.repRange ? '' : String(item.targetValue), load: '', rir: '', completed: false };
    })];
  }));
}
export function completedCourseSets(sessions: readonly TrainingSession[], date: string, workoutId: string, exerciseId: string) {
  const latest = sessions.filter(session => session.kind !== 'running' && session.workoutId === workoutId && sessionDateKey(session) === normalizeTrainingDate(date))
    .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))[0];
  return latest?.exercises.find(exercise => exercise.exerciseId === exerciseId)?.sets.filter(set => set.completed) || [];
}
