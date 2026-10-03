import type { DailyWorkoutEdits, Goal, Profile } from '../types';
import { dailyWorkoutKey, trainingDateKey } from '../data/sessionRecords';
export type TrainingOverlay = { version: 1; scope: string; days: Record<string, { workoutId: string | null; title: string; type: 'strength' | 'cardio' | 'recovery'; pairedDate?: string; sourceDate?: string; groupId?: string }>; courses: Record<string, { replacements: Record<string, string>; sets: Record<string, number>; scale?: number }> };
const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const id = (x: unknown): x is string => typeof x === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(x);
export function overlayDate(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
const dateKey = (x: string) => /^\d{4}-\d{2}-\d{2}$/.test(x) && overlayDate(new Date(x + 'T12:00:00')) === x;
export function trainingScope(profile: Profile) { return JSON.stringify([profile.goal, profile.planId, profile.planStartedAt, profile.frequency, profile.levels, profile.planLevels, profile.experience, profile.sessionMinutes, profile.trainingRestSeconds, profile.equipmentSplit, profile.equipmentTrainingDays, profile.equipmentAvailableGear, profile.equipmentPriority, profile.equipmentMovementOverrides]); }
export function normalizeTrainingOverlay(raw: unknown): TrainingOverlay | null {
  if (!object(raw) || raw.version !== 1 || typeof raw.scope !== 'string' || raw.scope.length > 20000 || !object(raw.days) || !object(raw.courses) || Object.keys(raw.days).length > 90 || Object.keys(raw.courses).length > 180) return null;
  const result: TrainingOverlay = { version: 1, scope: raw.scope, days: {}, courses: {} };
  for (const [date, d] of Object.entries(raw.days)) {
    if (!dateKey(date) || !object(d) || !(d.workoutId === null || id(d.workoutId)) || typeof d.title !== 'string' || !d.title || d.title.length > 160 || !['strength', 'cardio', 'recovery'].includes(String(d.type))) return null;
    if (d.pairedDate !== undefined && (typeof d.pairedDate !== 'string' || !dateKey(d.pairedDate) || d.pairedDate === date)) return null;
    if (d.sourceDate !== undefined && (typeof d.sourceDate !== 'string' || !dateKey(d.sourceDate) || typeof d.groupId !== 'string' || !dateKey(d.groupId) || d.pairedDate !== undefined)) return null;
    if (d.groupId !== undefined && d.sourceDate === undefined) return null;
    result.days[date] = { workoutId: d.workoutId, title: d.title, type: d.type as 'strength' | 'cardio' | 'recovery', ...(d.pairedDate ? { pairedDate: d.pairedDate as string } : {}), ...(d.sourceDate ? { sourceDate: d.sourceDate as string, groupId: d.groupId as string } : {}) };
  }
  for (const [date, day] of Object.entries(result.days)) if (day.pairedDate && result.days[day.pairedDate]?.pairedDate !== date) return null;
  for (const group of new Set(Object.values(result.days).map(d => d.groupId).filter(Boolean))) {
    const members = Object.entries(result.days).filter(([, d]) => d.groupId === group);
    const sources = new Set(members.map(([, d]) => d.sourceDate));
    if (members.length < 2 || sources.size !== members.length || !members.some(([date]) => date === group) || members.some(([date]) => !sources.has(date))) return null;
  }
  for (const [key, row] of Object.entries(raw.courses)) {
    const [date, workout] = key.split(':');
    if (!dateKey(date) || !id(workout) || key !== date + ':' + workout || !object(row) || !object(row.replacements) || !object(row.sets) || Object.keys(row.replacements).length > 80 || Object.keys(row.sets).length > 80 || row.scale !== undefined && (typeof row.scale !== 'number' || row.scale < .25 || row.scale > 1)) return null;
    const replacements: Record<string, string> = {}, sets: Record<string, number> = {};
    for (const [from, to] of Object.entries(row.replacements)) { if (!id(from) || !id(to)) return null; replacements[from] = to; }
    for (const [exercise, n] of Object.entries(row.sets)) { if (!id(exercise) || !Number.isInteger(n) || Number(n) < 1 || Number(n) > 30) return null; sets[exercise] = Number(n); }
    result.courses[key] = { replacements, sets, ...(row.scale === undefined ? {} : { scale: row.scale as number }) };
  }
  return result;
}
/** A read-only view over the saved base profile. Overlay and tool receipt commit
 * together in one journal write; base templates, historical sessions and topic plans are unchanged. */
export function effectiveTrainingProfile(profile: Profile | null, state: { trainingOverlays?: Partial<Record<Goal, TrainingOverlay>> }): Profile | null {
  if (!profile) return null;
  const overlay = state.trainingOverlays?.[profile.goal];
  return overlay && overlay.scope === trainingScope(profile) ? { ...profile, agentTrainingOverlay: overlay } : profile;
}
/** Writes resolve back to the owning date; raw additions never move in storage. */
export function baseDailyEditDate(profile: Profile | null, date: string): string {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(date);
  if (!match) return date;
  const at = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  const day = profile?.agentTrainingOverlay?.days[overlayDate(at)];
  const paired = day?.sourceDate || day?.pairedDate;
  return paired ? trainingDateKey(new Date(paired + 'T12:00:00')) : trainingDateKey(at);
}
export function effectiveDailyEdits(edits: DailyWorkoutEdits, profile: Profile | null): DailyWorkoutEdits {
  if (!profile?.agentTrainingOverlay || !Object.keys(profile.agentTrainingOverlay.days).length) return edits;
  const result: DailyWorkoutEdits = {};
  for (const edit of Object.values(edits)) {
    const source = baseDailyEditDate(null, edit.date);
    const destination = Object.entries(profile.agentTrainingOverlay.days).find(([, day]) => {
      const owner = day.sourceDate || day.pairedDate;
      return owner && trainingDateKey(new Date(owner + 'T12:00:00')) === source;
    });
    const date = destination ? trainingDateKey(new Date(destination[0] + 'T12:00:00')) : source;
    result[dailyWorkoutKey(date, edit.workoutId)] = { ...edit, date };
  }
  return result;
}
export function applyCourseOverlay<T extends { id: string; targetSets: number }>(items: T[], profile: Profile, workoutId: string, date: Date, resolve: (id: string) => Partial<T> | undefined): T[] {
  const edit = profile.agentTrainingOverlay?.courses[overlayDate(date) + ':' + workoutId];
  if (!edit) return items;
  return items.map(item => {
    const target = edit.replacements[item.id], replacement = target ? resolve(target) : undefined;
    const count = edit.sets[item.id] ?? (target ? edit.sets[target] : undefined) ?? item.targetSets;
    const preserved = item as T & { defaultPrescription?: { rirTarget?: number } };
    const resolved = replacement as Partial<T> & { defaultPrescription?: { rirTarget?: number } } | undefined;
    return { ...item, ...(replacement || {}), ...(resolved?.defaultPrescription ? { defaultPrescription: { ...resolved.defaultPrescription, ...(preserved.defaultPrescription?.rirTarget === undefined ? {} : { rirTarget: preserved.defaultPrescription.rirTarget }) } } : {}), targetSets: Math.max(1, Math.round(count * (edit.scale ?? 1))) };
  });
}
