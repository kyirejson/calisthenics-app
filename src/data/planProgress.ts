import type { Profile, TrainingSession } from '../types';
import { getPlanDay, type PlanDay } from './trainingPlans';
import { sessionDateKey } from './sessionRecords';

export type ScheduledDay = PlanDay & { date: Date };
export type CalendarMonth = {
  key: string;
  title: string;
  year: number;
  month: number;
  plannedCount: number;
  cells: Array<{ number: number; day?: ScheduledDay } | null>;
};

export function localDateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export function getDisplayedSchedule(profile: Profile, now = new Date(), days = 7): ScheduledDay[] {
  const first = new Date(now);
  first.setHours(12, 0, 0, 0);
  const count = Math.max(1, Math.min(365, Math.round(days)));
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(first);
    date.setDate(first.getDate() + index);
    return { date, ...getPlanDay(profile, date).day };
  });
}

export function getCalendarMonths(schedule: ScheduledDay[]): CalendarMonth[] {
  const byDate = new Map(schedule.map((day) => [localDateKey(day.date), day]));
  const months = new Map<string, { year: number; month: number; days: ScheduledDay[] }>();
  schedule.forEach((day) => {
    const year = day.date.getFullYear();
    const month = day.date.getMonth();
    const key = `${year}-${month}`;
    if (!months.has(key)) months.set(key, { year, month, days: [] });
    months.get(key)!.days.push(day);
  });
  return [...months].map(([key, entry]) => {
    const { year, month } = entry;
    const leading = Array.from({ length: new Date(year, month, 1).getDay() }, () => null);
    const numberOfDays = new Date(year, month + 1, 0).getDate();
    const cells = Array.from({ length: numberOfDays }, (_, index) => {
      const date = new Date(year, month, index + 1, 12);
      return { number: index + 1, day: byDate.get(localDateKey(date)) };
    });
    return {
      key, title: `${year}年${month + 1}月`, year, month,
      plannedCount: entry.days.filter((day) => day.type !== 'recovery' || Boolean(day.workoutId)).length,
      cells: [...leading, ...cells],
    };
  });
}

export function getDayTrainingState(day: ScheduledDay, sessions: TrainingSession[], requiredExerciseIds: string[] = []) {
  if (day.type === 'recovery' && !day.workoutId) return { complete: false, partial: false, session: undefined };
  const matching = sessions.filter((session) => {
    if (sessionDateKey(session) !== localDateKey(day.date)) return false;
    if (day.type === 'cardio') return session.kind === 'running';
    return session.kind !== 'running' && session.workoutId === day.workoutId;
  });
  const completed = matching.find((session) => session.completion !== 'partial'
    && requiredExerciseIds.every((id) => session.exercises.some((exercise) => exercise.exerciseId === id && exercise.sets.some((set) => set.completed && set.reps > 0)))
    && (day.type !== 'cardio' || session.durationSeconds >= (day.targetMinutes || 0) * 60));
  return {
    complete: Boolean(completed),
    partial: !completed && matching.length > 0,
    session: completed || matching[0],
  };
}
