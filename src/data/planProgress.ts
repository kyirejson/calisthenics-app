import type { Profile, TrainingSession } from '../types';
import { getPlanDay, getWeekSchedule, type PlanDay } from './trainingPlans';

export type ScheduledDay = PlanDay & { date: Date };

export function localDateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export function getDisplayedSchedule(profile: Profile, now = new Date()): ScheduledDay[] {
  if (profile.planId !== 'rebirth_7') return getWeekSchedule(profile, now);
  if (getPlanDay(profile, now).phase === 'starter') {
    return getWeekSchedule(profile, new Date(profile.planStartedAt));
  }
  const monday = new Date(now);
  const weekday = monday.getDay();
  monday.setDate(monday.getDate() - (weekday === 0 ? 6 : weekday - 1));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return { date, ...getPlanDay(profile, date).day };
  });
}

export function getDayTrainingState(day: ScheduledDay, sessions: TrainingSession[]) {
  if (day.type === 'recovery') return { complete: false, partial: false, session: undefined };
  const matching = sessions.filter((session) => {
    if (localDateKey(new Date(session.completedAt)) !== localDateKey(day.date)) return false;
    if (day.type === 'cardio') return session.kind === 'running';
    return session.kind !== 'running' && session.workoutId === day.workoutId;
  });
  const completed = matching.find((session) => session.completion !== 'partial');
  return {
    complete: Boolean(completed),
    partial: !completed && matching.some((session) => session.completion === 'partial'),
    session: completed || matching[0],
  };
}
