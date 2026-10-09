import type { SetLog, TrainingSession } from '../../types';
import {
  historySessionDate,
  localDayKey,
  setHistoryUnit,
  validHistorySessions,
  type HistoryUnit,
} from './trainingHistory';

export type DayExercise = {
  key: string;
  exerciseId: string;
  name: string;
  unit: HistoryUnit;
  perSide: boolean;
  sets: SetLog[];
  sessionIds: string[];
};
/** Same local training-day and validity rules as the history page, never planned reps. */
export function buildTrainingDay(
  sessions: readonly TrainingSession[],
  now = new Date(),
  date = localDayKey(now),
) {
  const records = validHistorySessions(sessions, now).filter(
    (session) => session.kind !== 'running' && localDayKey(historySessionDate(session)!) === date,
  );
  const grouped = new Map<string, DayExercise>();
  const totals: Record<HistoryUnit, number> = { reps: 0, seconds: 0, steps: 0, meters: 0 };
  let setCount = 0;
  for (const session of records)
    for (const exercise of session.exercises)
      for (const set of exercise.sets) {
        const unit = setHistoryUnit(exercise, set),
          perSide = !!exercise.targetSnapshot?.perSide;
        // Do not merge different units, bilateral conventions or equipment load bases.
        const key = `${exercise.exerciseId}:${unit}:${perSide}:${exercise.targetSnapshot?.loadBasis || 'none'}`;
        let item = grouped.get(key);
        if (!item) {
          item = {
            key,
            exerciseId: exercise.exerciseId,
            name: exercise.name,
            unit,
            perSide,
            sets: [],
            sessionIds: [],
          };
          grouped.set(key, item);
        }
        item.sets.push(set);
        if (!item.sessionIds.includes(session.id)) item.sessionIds.push(session.id);
        setCount++;
        totals[unit] += set.reps * (perSide && unit === 'reps' ? 2 : 1);
      }
  return {
    date,
    records,
    exercises: [...grouped.values()],
    setCount,
    totals,
    exerciseCount: new Set([...grouped.values()].map((item) => item.exerciseId)).size,
    durationSeconds: records.reduce(
      (sum, session) =>
        sum +
        (Number.isFinite(session.durationSeconds) && session.durationSeconds > 0
          ? session.durationSeconds
          : 0),
      0,
    ),
    unmeasuredCount: records.filter(
      (session) => !Number.isFinite(session.durationSeconds) || session.durationSeconds <= 0,
    ).length,
  };
}

const distributionColors = [
  '#C7F548',
  '#86B79A',
  '#89A7C3',
  '#79828D',
  '#D3AE82',
  '#A297C7',
  '#83B9B9',
  '#BB8F9E',
];
/** Distribution measures sets, not mixed-unit repetitions, time, load or target completion. */
export function buildSetDistribution(exercises: readonly DayExercise[]) {
  const totalSets = exercises.reduce((sum, item) => sum + item.sets.length, 0);
  let angle = 0;
  return exercises
    .filter((item) => item.sets.length > 0)
    .map((item, index) => {
      const sweep = (item.sets.length / totalSets) * 360;
      const segment = {
        key: item.key,
        color: distributionColors[index] || `hsl(${(index * 137 + 80) % 360}, 35%, 65%)`,
        count: item.sets.length,
        start: angle,
        sweep,
      };
      angle += sweep;
      return segment;
    });
}
