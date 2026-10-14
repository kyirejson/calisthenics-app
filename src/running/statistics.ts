import type { TrainingSession } from '../types';
import { historySessionDate, localDayKey, validHistorySessions } from '../domain/training/trainingHistory';
import { hasRecordedRunDistance } from './model';

export type RunPeriod = 'week' | 'month';
export type DailyMileage = { key: string; day: number; km: number; runs: number; future: boolean };
export function mileageLabel(km: number) { return km.toFixed(2).replace(/\.?0+$/, ''); }

/** Saved records are the only evidence: no live workout, invented distance or stored aggregate. */
export function runningStatistics(sessions: readonly TrainingSession[], now = new Date()) {
  const today = localDayKey(now);
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (now.getDay() + 6) % 7, 12);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 12);
  const runs = validHistorySessions(sessions, now).filter(session => session.kind === 'running' && !session.inProgress && hasRecordedRunDistance(session.distanceKm));
  const daily = new Map<string, { km: number; runs: number }>();
  let weekKm = 0, monthKm = 0, lifetimeKm = 0, estimatedRuns = 0, partialRuns = 0;
  for (const run of runs) {
    const date = localDayKey(historySessionDate(run)!);
    const km = run.distanceKm!;
    const previous = daily.get(date) || { km: 0, runs: 0 };
    daily.set(date, { km: previous.km + km, runs: previous.runs + 1 });
    lifetimeKm += km;
    if (date >= localDayKey(weekStart)) weekKm += km;
    if (date >= localDayKey(monthStart)) monthKm += km;
    if (run.distanceSource === 'steps' || run.distanceSource === 'manual') estimatedRuns++;
    if (run.runDistancePartial) partialRuns++;
  }
  const days = (period: RunPeriod): DailyMileage[] => {
    const start = period === 'week' ? weekStart : monthStart;
    const length = period === 'week' ? 7 : new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return Array.from({ length }, (_, index) => {
      const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index, 12);
      const key = localDayKey(day), entry = daily.get(key);
      return { key, day: day.getDate(), km: entry?.km || 0, runs: entry?.runs || 0, future: key > today };
    });
  };
  const goals = [10, 50, 100, 200, 500, 1000];
  while (goals.at(-1)! <= lifetimeKm) goals.push(goals.at(-1)! * 2);
  const nextIndex = goals.findIndex(goal => goal > lifetimeKm), nextGoal = goals[nextIndex];
  const milestoneGoals = goals.slice(Math.max(0, nextIndex - 2), Math.max(4, nextIndex + 2));
  return { weekKm, monthKm, lifetimeKm, estimatedRuns, partialRuns, count: runs.length, days,
    milestone: { nextGoal, remaining: Math.max(0, nextGoal - lifetimeKm), progress: Math.min(100, lifetimeKm / nextGoal * 100), goals: milestoneGoals } };
}
