import type { AgentFood, IntakeEntry, MealOperationReceipt, Nutrients } from './types';

export const nutrientKeys = ['calories', 'protein', 'carbs', 'fat', 'fiber'] as const;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export const mealOperationId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,199}$/.test(value);

export function normalizeAgentFood(input: unknown): AgentFood | null {
  if (!record(input) || !(input.amount === null || typeof input.amount === 'string' && input.amount.trim().length > 0 && input.amount.length <= 200)
    || typeof input.estimated !== 'boolean' || !record(input.values)) return null;
  const values = input.values;
  if (!nutrientKeys.every(key => values[key] === null || typeof values[key] === 'number' && Number.isFinite(values[key]) && (values[key] as number) >= 0)) return null;
  return { amount: typeof input.amount === 'string' ? input.amount.trim() : null, estimated: input.estimated,
    values: Object.fromEntries(nutrientKeys.map(key => [key, values[key]])) as AgentFood['values'] };
}

export function agentNutrientSnapshot(food: AgentFood): Nutrients {
  return Object.fromEntries(nutrientKeys.map(key => [key, food.values[key] ?? 0])) as Nutrients;
}

export function nutrientKnown(entry: IntakeEntry, key: keyof Nutrients): boolean {
  return entry.source !== 'agent' || !!entry.agentFood && entry.agentFood.values[key] !== null;
}

export function hasUnknownNutrition(entry: IntakeEntry): boolean {
  return entry.source === 'agent' && nutrientKeys.some(key => !nutrientKnown(entry, key));
}

export function normalizeMealReceipts(input: unknown): MealOperationReceipt[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  return input.flatMap(row => {
    if (!record(row) || !mealOperationId(row.id) || !mealOperationId(row.requestId) || seen.has(row.id)
      || !Array.isArray(row.entryIds) || !row.entryIds.every(mealOperationId)) return [];
    seen.add(row.id);
    return [{ id: row.id, requestId: row.requestId, entryIds: [...row.entryIds] as string[] }];
  });
}
