import type { Exercise, SessionExercise, SetLog, TrainingSession } from '../types';
import { getProgressionStatus } from './progression';

export type HistoryUnit = NonNullable<SetLog['unit']>;
export const historyUnitLabels: Record<HistoryUnit, string> = { reps: '次', seconds: '秒', steps: '步', meters: '米' };

export function localDayKey(date: Date): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

/** Explicit workout date wins, including old unpadded keys; never use UTC slicing. */
export function historySessionDate(session: TrainingSession): Date | null {
  if (session.trainingDate) {
    const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(session.trainingDate);
    if (!match) return null;
    const [year, month, day] = match.slice(1).map(Number);
    const date = new Date(year, month - 1, day, 12);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
  }
  const start = new Date(session.startedAt);
  return Number.isFinite(start.getTime()) ? new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12) : null;
}

export function setHistoryUnit(exercise: SessionExercise, set: SetLog): HistoryUnit {
  return set.unit || exercise.targetSnapshot?.unit || 'reps';
}

export function validCompletedSets(exercise: SessionExercise, unit?: HistoryUnit, now?: Date): SetLog[] {
  if (!Array.isArray(exercise.sets)) return [];
  return exercise.sets.filter(set => {
    const measured = setHistoryUnit(exercise, set);
    if (!Object.hasOwn(historyUnitLabels, measured) || (unit && measured !== unit)
      || !set.completed || !Number.isFinite(set.reps) || set.reps <= 0
      || (measured !== 'meters' && !Number.isInteger(set.reps))) return false;
    if (now && set.completedAt) {
      const timestamp = new Date(set.completedAt).getTime();
      if (!Number.isFinite(timestamp) || timestamp > now.getTime()) return false;
    }
    return true;
  });
}

export function completedSetValues(exercise: SessionExercise, unit?: HistoryUnit): number[] {
  return validCompletedSets(exercise, unit).map(set => set.reps);
}

/** Read-only validity and deduplication shared by every statistic on this page. */
export function validHistorySessions(sessions: readonly TrainingSession[], now = new Date()): TrainingSession[] {
  const unique = new Map<string, TrainingSession>();
  for (const session of sessions) {
    if (!session || typeof session.id !== 'string' || !session.id.trim()) continue;
    const previous = unique.get(session.id);
    const revisionAt = Date.parse(session.completedAt || session.startedAt);
    const previousAt = previous ? Date.parse(previous.completedAt || previous.startedAt) : NaN;
    if (!previous || (Number.isFinite(revisionAt) && (!Number.isFinite(previousAt) || revisionAt > previousAt))) unique.set(session.id, session);
  }
  return [...unique.values()].filter(session => {
    const started = Date.parse(session.startedAt);
    const day = historySessionDate(session);
    if (!Number.isFinite(started) || started > now.getTime() || !day || localDayKey(day) > localDayKey(now)) return false;
    if (session.completedAt && (!Number.isFinite(Date.parse(session.completedAt)) || Date.parse(session.completedAt) > now.getTime() || Date.parse(session.completedAt) < started)) return false;
    if (session.kind === 'running') return Number.isFinite(session.durationSeconds) && session.durationSeconds > 0;
    return Array.isArray(session.exercises) && session.exercises.some(exercise => validCompletedSets(exercise, undefined, now).length > 0);
  }).map(session => session.kind === 'running' ? session : ({
    ...session,
    exercises: session.exercises.map(exercise => ({
      ...exercise,
      sets: validCompletedSets(exercise, undefined, now).map(set => ({ ...set, unit: setHistoryUnit(exercise, set) })),
    })).filter(exercise => exercise.sets.length > 0),
  })).sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
}

export function sessionExerciseBest(exercise: SessionExercise, unit?: HistoryUnit): number {
  return Math.max(0, ...completedSetValues(exercise, unit));
}

export function sessionExerciseTotal(exercise: SessionExercise, unit?: HistoryUnit): number {
  return completedSetValues(exercise, unit).reduce((sum, value) => sum + value, 0);
}

export type StaircaseStep = {
  level: number;
  step: number;
  name: string;
  exerciseId: string;
  isCompleted: boolean;
  isCurrent: boolean;
  hasRecord: boolean;
  firstRecordedDate: string | null;
  targetDisplay: string;
};

/** A route, not a fictional upgrade timeline. Checks require existing exam evidence. */
export function deriveSeriesStaircase(
  sessions: TrainingSession[],
  seriesKey: string,
  currentLevel: number,
  allSteps: Exercise[],
  focusLevel = currentLevel,
  now = new Date(),
): StaircaseStep[] {
  if (!allSteps.length) return [];
  const clampLevel = (value: number) => Math.max(1, Math.min(allSteps.length, Number.isFinite(value) ? Math.floor(value) : 1));
  const current = clampLevel(currentLevel);
  const focused = clampLevel(focusLevel);
  const start = Math.max(0, Math.min(focused - 2, allSteps.length - Math.min(3, allSteps.length)));
  const valid = validHistorySessions(sessions, now).filter(session => session.kind !== 'running');
  return allSteps.slice(start, start + 3).map((exercise, offset) => {
    const level = start + offset + 1;
    const first = valid.find(session => session.exercises.some(item => item.exerciseId === exercise.id && validCompletedSets(item, undefined, now).length));
    const evidence = getProgressionStatus(seriesKey, { levels: { [seriesKey]: level } }, valid);
    return {
      level, step: exercise.step || level, name: exercise.name, exerciseId: exercise.id,
      isCompleted: Boolean(evidence?.current.id === exercise.id && evidence.eligible),
      isCurrent: level === current, hasRecord: Boolean(first),
      firstRecordedDate: first ? localDayKey(historySessionDate(first)!) : null,
      targetDisplay: exercise.standards?.upgrade || '',
    };
  });
}

export type PerformancePoint = {
  id: string;
  sessionId: string;
  sessionIds: string[];
  dayKey: string;
  t: number;
  best: number;
  sets: number[];
  total: number;
  unit: HistoryUnit;
  formattedDate: string;
  feedback: { solid: number; hard: number; pain: number; unrated: number };
};

/** Daily aggregation: best is max, volume is sum, and unknown feedback stays unknown. */
export function derivePerformanceHistory(
  sessions: TrainingSession[], exerciseId: string, criteriaUnit: HistoryUnit = 'reps', now = new Date(),
) {
  const byDay = new Map<string, PerformancePoint>();
  for (const session of validHistorySessions(sessions, now)) {
    if (session.kind === 'running') continue;
    const values = session.exercises.filter(item => item.exerciseId === exerciseId)
      .flatMap(item => validCompletedSets(item, criteriaUnit, now).map(set => set.reps));
    if (!values.length) continue;
    const date = historySessionDate(session)!;
    const dayKey = localDayKey(date);
    let point = byDay.get(dayKey);
    if (!point) {
      point = {
        id: exerciseId + ':' + dayKey, sessionId: session.id, sessionIds: [], dayKey, t: date.getTime(),
        best: 0, sets: [], total: 0, unit: criteriaUnit,
        formattedDate: (date.getFullYear() === now.getFullYear() ? '' : date.getFullYear() + '/') + (date.getMonth() + 1) + '/' + date.getDate(),
        feedback: { solid: 0, hard: 0, pain: 0, unrated: 0 },
      };
      byDay.set(dayKey, point);
    }
    point.sessionId = session.id;
    point.sessionIds.push(session.id);
    point.sets.push(...values);
    point.best = Math.max(point.best, ...values);
    point.total += values.reduce((sum, value) => sum + value, 0);
    const quality = session.quality === 'solid' || session.quality === 'hard' || session.quality === 'pain' ? session.quality : 'unrated';
    point.feedback[quality] += 1;
  }
  const points = [...byDay.values()].sort((a, b) => a.t - b.t);
  const bestAllTime = Math.max(0, ...points.map(point => point.best));
  return { points, bestAllTime, latest: points.at(-1) || null, hasData: points.length > 0 };
}

export type ReviewedTrainingStreak = { days: number | null; status: 'empty' | 'unreviewed' | 'pain' | 'reported' };

/** Counts explicitly reviewed strength-training DAYS, never unobserved calendar days. */
export function computeReviewedTrainingStreak(sessions: TrainingSession[], now = new Date()): ReviewedTrainingStreak {
  const days = groupHistoryByDay(validHistorySessions(sessions, now).filter(session => session.kind !== 'running'), now);
  if (!days.length) return { days: null, status: 'empty' };
  if (days[0].sessions.some(session => session.quality === 'pain')) return { days: 0, status: 'pain' };
  if (days[0].sessions.some(session => session.quality !== 'solid' && session.quality !== 'hard')) return { days: null, status: 'unreviewed' };
  let count = 0;
  for (const day of days) {
    if (!day.sessions.every(session => session.quality === 'solid' || session.quality === 'hard')) break;
    count += 1;
  }
  return { days: count, status: 'reported' };
}

export type DayGroup = { key: string; date: Date; sessions: TrainingSession[] };
export function groupHistoryByDay(sessions: TrainingSession[], now = new Date()): DayGroup[] {
  const groups = new Map<string, DayGroup>();
  for (const session of validHistorySessions(sessions, now)) {
    const date = historySessionDate(session)!;
    const key = localDayKey(date);
    if (!groups.has(key)) groups.set(key, { key, date, sessions: [] });
    groups.get(key)!.sessions.push(session);
  }
  return [...groups.values()].sort((a, b) => b.date.getTime() - a.date.getTime());
}

function weekMonday(date: Date): Date {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

/** At least one valid session per week; an unfinished current week is not a break. */
export function computeWeekStreak(sessions: TrainingSession[], now = new Date()): number {
  const weeks = new Set(validHistorySessions(sessions, now).map(session => localDayKey(weekMonday(historySessionDate(session)!))));
  let streak = 0;
  const cursor = weekMonday(now);
  for (let i = 0; i < 5200; i++) {
    if (weeks.has(localDayKey(cursor))) streak += 1;
    else if (i !== 0) break;
    cursor.setDate(cursor.getDate() - 7);
  }
  return streak;
}

export function summarizeHistoryDuration(sessions: readonly TrainingSession[]): { seconds: number; unmeasuredCount: number } {
  let seconds = 0, unmeasuredCount = 0;
  for (const session of sessions) {
    if (Number.isFinite(session.durationSeconds) && session.durationSeconds > 0) seconds += session.durationSeconds;
    else unmeasuredCount += 1;
  }
  return { seconds, unmeasuredCount };
}

export type MonthStats = { count: number; minutes: number; seconds: number; unmeasuredCount: number; activeDays: number; prevCount: number; deltaPercent: number | null };
export function computeMonthStats(sessions: TrainingSession[], now = new Date()): MonthStats {
  const currentMonth = now.getMonth();
  const previous = new Date(now.getFullYear(), currentMonth - 1, 1);
  const previousLastDay = new Date(now.getFullYear(), currentMonth, 0).getDate();
  let count = 0, prevCount = 0;
  const current: TrainingSession[] = [];
  const activeDays = new Set<string>();
  for (const session of validHistorySessions(sessions, now)) {
    const date = historySessionDate(session)!;
    if (date.getFullYear() === now.getFullYear() && date.getMonth() === currentMonth) {
      count += 1;
      current.push(session);
      activeDays.add(localDayKey(date));
    } else if (date.getFullYear() === previous.getFullYear() && date.getMonth() === previous.getMonth()
      && date.getDate() <= Math.min(now.getDate(), previousLastDay)) prevCount += 1;
  }
  const { seconds, unmeasuredCount } = summarizeHistoryDuration(current);
  return { count, minutes: Math.round(seconds / 60), seconds, unmeasuredCount, activeDays: activeDays.size, prevCount,
    deltaPercent: prevCount ? Math.round((count - prevCount) / prevCount * 100) : null };
}

export type CalendarCell = { key: string; day: number; state: 'complete' | 'partial' | null; isToday: boolean } | null;
export function buildMonthGrid(year: number, month: number, sessions: TrainingSession[], now = new Date()): CalendarCell[] {
  const byDay = new Map<string, 'complete' | 'partial'>();
  for (const session of validHistorySessions(sessions, now)) {
    const key = localDayKey(historySessionDate(session)!);
    byDay.set(key, byDay.get(key) === 'complete' || session.completion === 'complete' ? 'complete' : 'partial');
  }
  const first = new Date(year, month, 1, 12);
  const weekday = (first.getDay() + 6) % 7;
  const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells: CalendarCell[] = Array.from({ length: weekday }, () => null);
  for (let day = 1; day <= count; day++) {
    const key = localDayKey(new Date(first.getFullYear(), first.getMonth(), day, 12));
    cells.push({ key, day, state: byDay.get(key) || null, isToday: key === localDayKey(now) });
  }
  while (cells.length % 7) cells.push(null);
  return cells;
}

export type SessionComparisonRow = {
  exercise: SessionExercise; best: number; prevBest: number | null; delta: number | null; unit: HistoryUnit;
};

/** Compare only the same action AND measured unit; skip empty earlier records. */
export function compareWithPrevious(session: TrainingSession, sessions: TrainingSession[], now = new Date()): SessionComparisonRow[] {
  const earlier = validHistorySessions(sessions, now).filter(item => item.id !== session.id && Date.parse(item.startedAt) < Date.parse(session.startedAt)).reverse();
  const measured = new Map<string, { exercise: SessionExercise; unit: HistoryUnit }>();
  for (const exercise of session.exercises || []) {
    const units = [...new Set(validCompletedSets(exercise, undefined, now).map(set => setHistoryUnit(exercise, set)))];
    for (const unit of units) {
      const key = exercise.exerciseId + ':' + unit;
      const current = measured.get(key);
      const sets = validCompletedSets(exercise, unit, now);
      if (current) current.exercise.sets.push(...sets);
      else measured.set(key, { exercise: { ...exercise, sets }, unit });
    }
  }
  return [...measured.values()].map(({ exercise, unit }) => {
    // Equipment repetitions without matched device/load are not evidence of strength gains.
    if (exercise.exerciseId.startsWith('equipment_')) return { exercise, best: sessionExerciseBest(exercise, unit), prevBest: null, delta: null, unit };
    let prevBest: number | null = null;
    for (const previous of earlier) {
      const values = (previous.exercises || []).filter(item => item.exerciseId === exercise.exerciseId)
        .flatMap(item => validCompletedSets(item, unit, now).map(set => set.reps));
      if (values.length) { prevBest = Math.max(...values); break; }
    }
    const best = sessionExerciseBest(exercise, unit);
    return { exercise, best, prevBest, delta: prevBest === null ? null : best - prevBest, unit };
  });
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  if (seconds === 0) return '0 秒';
  const whole = Math.floor(seconds);
  if (whole < 1) return '<1 秒';
  if (whole < 60) return whole + ' 秒';
  const minutes = Math.floor(whole / 60), remaining = whole % 60;
  return minutes < 60 ? minutes + ' 分' + (remaining ? remaining + ' 秒' : '钟')
    : Math.floor(minutes / 60) + ' 小时' + (minutes % 60 ? ' ' + minutes % 60 + ' 分钟' : '');
}
