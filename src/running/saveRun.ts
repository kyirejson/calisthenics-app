import type { TrainingSession } from '../types';
import { hasRecordedRunDistance, toRunSession, type RunSnapshot } from './model';

/** Keep the finish/acknowledge transaction, but never save a distance-free timer. */
export async function persistFinishedRun(snapshot: RunSnapshot, saveSession: (session: TrainingSession) => Promise<void>, acknowledge: (id: string) => Promise<void>) {
  const session = toRunSession(snapshot);
  const recordable = hasRecordedRunDistance(session.distanceKm);
  if (recordable) await saveSession(session);
  // Failure keeps the finished draft available for retry; no other history is removed.
  await acknowledge(session.id);
  return recordable ? session : null;
}
