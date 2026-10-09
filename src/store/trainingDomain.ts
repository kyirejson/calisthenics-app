import type { DailyWorkoutEdits, TrainingSession } from '../types';
import {
  cleanSession,
  dailyWorkoutKey,
  withoutTrainingDay,
} from '../domain/training/sessionRecords';
import { exercises } from '../domain/training/catalog';
import { storageKeys as keys, type DomainContext } from './contracts';
import { createWriteQueue } from './writeQueue';
type Journal = { sessions: TrainingSession[]; dailyEdits: DailyWorkoutEdits };
const exerciseIds = new Set(exercises.map((exercise) => exercise.id));
export function createTrainingDomain(
  context: DomainContext,
  writeBatch: (pairs: Array<[string, string]>) => Promise<void>,
) {
  const queue = createWriteQueue(context.guard);
  const erasedIds = new Set<string>();
  const update = (change: (current: Journal) => Journal, erase = false) =>
    queue.enqueue(async () => {
      const current = context.read(),
        next = change(current),
        pairs: Array<[string, string]> = [];
      if (next.sessions !== current.sessions) {
        context.assertWritable(keys.sessions);
        pairs.push([keys.sessions, JSON.stringify(next.sessions)]);
      }
      if (next.dailyEdits !== current.dailyEdits) {
        context.assertWritable(keys.dailyEdits);
        pairs.push([keys.dailyEdits, JSON.stringify(next.dailyEdits)]);
      }
      if (erase) await context.storage.multiRemove([keys.sessionsBackup]);
      if (pairs.length) await writeBatch(pairs);
      if (erase) for (const session of current.sessions) {
        if (!next.sessions.some(item => item.id === session.id)) erasedIds.add(session.id);
      }
      context.commit(next);
    });
  return {
    drain: queue.drain,
    actions: {
      saveSession: (session: TrainingSession) =>
        update((current) => {
          const cleaned = cleanSession(session),
            remaining = current.sessions.filter((item) => item.id !== cleaned.id);
          if (erasedIds.has(cleaned.id)) throw Error('此训练记录已删除，请重新开始训练。');
          return {
            dailyEdits: current.dailyEdits,
            sessions:
              cleaned.kind !== 'running' && !cleaned.exercises.length
                ? remaining
                : [cleaned, ...remaining],
          };
        }),
      deleteSession: (id: string) => update((current) => ({
          dailyEdits: current.dailyEdits,
          sessions: current.sessions.filter((session) => session.id !== id),
        }), true),
      addDailyExercise: (date: string, workoutId: string, exerciseId: string) =>
        update((current) => {
          if (!exerciseIds.has(exerciseId)) throw Error('此动作已不在动作库中。');
          const key = dailyWorkoutKey(date, workoutId);
          return {
            sessions: current.sessions,
            dailyEdits: {
              ...current.dailyEdits,
              [key]: {
                date,
                workoutId,
                exerciseIds: [
                  ...new Set([...(current.dailyEdits[key]?.exerciseIds || []), exerciseId]),
                ],
              },
            },
          };
        }),
      removeDailyExercise: (date: string, workoutId: string, exerciseId: string) =>
        update((current) => {
          const key = dailyWorkoutKey(date, workoutId),
            dailyEdits = { ...current.dailyEdits };
          if (dailyEdits[key]) {
            const exerciseIds = dailyEdits[key].exerciseIds.filter((id) => id !== exerciseId);
            if (exerciseIds.length) dailyEdits[key] = { date, workoutId, exerciseIds };
            else delete dailyEdits[key];
          }
          return { sessions: current.sessions, dailyEdits };
        }),
      resetTrainingDay: (date: string) => update((current) => {
          const next = withoutTrainingDay(current.sessions, current.dailyEdits, date);
          return { sessions: next.sessions, dailyEdits: next.edits };
        }, true),
    },
  };
}
