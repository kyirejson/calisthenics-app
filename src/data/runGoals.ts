export type RunningGoal = { kind: 'distance' | 'duration'; value: number };

export function normalizeRunningGoal(input: unknown): RunningGoal | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  if (!['distance', 'duration'].includes(raw.kind as string) || typeof raw.value !== 'number' || !Number.isFinite(raw.value)) return null;
  const kind = raw.kind as RunningGoal['kind'];
  if (raw.value < (kind === 'distance' ? .5 : 1) || raw.value > (kind === 'distance' ? 50 : 240)) return null;
  if (kind === 'duration' && !Number.isInteger(raw.value)) return null;
  return { kind, value: kind === 'distance' ? Math.round(raw.value * 100) / 100 : raw.value };
}

/** A user's goal is independent of the training course. No fabricated 5 km prescription. */
export function resolveRunningGoal(saved: RunningGoal | undefined, plannedMinutes?: number): RunningGoal | null {
  const custom = normalizeRunningGoal(saved);
  if (custom) return custom;
  return normalizeRunningGoal({ kind: 'duration', value: plannedMinutes });
}

export function runningGoalProgress(goal: RunningGoal | null, meters: number, seconds: number): number {
  const valid = normalizeRunningGoal(goal);
  if (!valid) return 0;
  const actual = valid.kind === 'distance' ? meters / 1000 : seconds / 60;
  return Number.isFinite(actual) ? Math.min(100, Math.max(0, actual / valid.value * 100)) : 0;
}
