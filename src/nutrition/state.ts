import { isValidDateKey, validTimestamp } from './validation';
import type { MealSlot, NutritionDayState, NutritionTargetSnapshot, NutritionTargets, TrainingTime } from './types';

export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'snack', 'dinner'];
export const TRAINING_TIMES: TrainingTime[] = ['unspecified', 'morning', 'midday', 'evening'];
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown, max: number) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;
const text = (value: unknown, max: number): value is string => typeof value === 'string' && Boolean(value.trim()) && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value);

export function emptyNutritionDay(): NutritionDayState { return { targetHistory: [], confirmedSlots: [], skippedSlots: [], completedAt: null }; }

export function normalizeTargetSnapshot(input: unknown): NutritionTargetSnapshot | null {
  if (!record(input) || !text(input.signature, 3000) || !validTimestamp(input.capturedAt)
    || !record(input.targets) || !record(input.body) || !record(input.training)) return null;
  const targets = input.targets;
  if (!['ready', 'needs_setup', 'blocked', 'unsupported'].includes(targets.status as string)
    || !['calories', 'protein', 'carbs', 'fat', 'bmr', 'tdee'].every(key => finite(targets[key], ['calories', 'bmr', 'tdee'].includes(key) ? 10000 : 2000))
    || !text(targets.message, 1000)
    || (targets.status === 'ready' && ['calories', 'protein', 'carbs', 'fat', 'bmr', 'tdee'].some(key => (targets[key] as number) <= 0))
    || (targets.status !== 'ready' && ['calories', 'protein', 'carbs', 'fat', 'bmr', 'tdee'].some(key => targets[key] !== 0))
    || !(input.objective === null || ['fat_loss', 'muscle_gain', 'maintain', 'performance'].includes(input.objective as string))
    || !(input.pattern === null || ['balanced', 'vegetarian', 'low_carb', 'keto'].includes(input.pattern as string))
    || !(input.activity === null || ['sedentary', 'light', 'active'].includes(input.activity as string))
    || !finite(input.body.age, 100) || !finite(input.body.height, 300) || !finite(input.body.weight, 500)
    || !['male', 'female', 'unspecified'].includes(input.body.sex as string)
    || !['strength', 'cardio', 'recovery'].includes(input.training.type as string)
    || !TRAINING_TIMES.includes(input.training.time as TrainingTime) || !text(input.training.title, 200)
    || !finite(input.training.plannedMinutes, 1440)) return null;
  return {
    signature: input.signature, capturedAt: input.capturedAt,
    targets: { ...Object.fromEntries(['calories', 'protein', 'carbs', 'fat', 'bmr', 'tdee'].map(key => [key, targets[key]])), status: targets.status, message: targets.message } as NutritionTargets,
    objective: input.objective as NutritionTargetSnapshot['objective'], pattern: input.pattern as NutritionTargetSnapshot['pattern'], activity: input.activity as NutritionTargetSnapshot['activity'],
    body: { age: input.body.age as number, height: input.body.height as number, weight: input.body.weight as number, sex: input.body.sex as NutritionTargetSnapshot['body']['sex'] },
    training: { type: input.training.type as NutritionTargetSnapshot['training']['type'], title: input.training.title, plannedMinutes: input.training.plannedMinutes as number, time: input.training.time as TrainingTime },
  };
}

export function normalizeNutritionDays(input: unknown): Record<string, NutritionDayState> {
  if (!record(input)) return {};
  const days: Record<string, NutritionDayState> = {};
  for (const [date, raw] of Object.entries(input).filter(([key]) => isValidDateKey(key)).sort(([a], [b]) => a.localeCompare(b)).slice(-1095)) {
    if (!record(raw)) continue;
    const candidates = Array.isArray(raw.targetHistory) ? raw.targetHistory.length > 64 ? [raw.targetHistory[0], ...raw.targetHistory.slice(-63)] : raw.targetHistory : [];
    const history = candidates
      .map(normalizeTargetSnapshot).filter((item): item is NutritionTargetSnapshot => Boolean(item))
      .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
    const confirmedSlots = MEAL_SLOTS.filter(slot => Array.isArray(raw.confirmedSlots) && raw.confirmedSlots.includes(slot));
    const completedAt = confirmedSlots.length === MEAL_SLOTS.length && validTimestamp(raw.completedAt) ? raw.completedAt : null;
    const skippedSlots = confirmedSlots.filter(slot => Array.isArray(raw.skippedSlots) && raw.skippedSlots.includes(slot));
    days[date] = { targetHistory: history, confirmedSlots, skippedSlots, completedAt };
  }
  return days;
}
