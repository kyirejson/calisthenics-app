import { normalizeAgentFood, agentNutrientSnapshot, mealOperationId, nutrientKeys } from './agentFood';
import { normalizeIntakeEntry, sumNutrients } from './engine';
import { invalidateMealLogging, withMealStatus } from './timeline';
import { isValidDateKey } from './validation';
import type { IntakeEntry, MealSlot, NutritionJournal } from './types';

export type MealWriteResult = { ok: true; replayed: boolean; entryIds: string[]; entries: IntakeEntry[] };
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const slots: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

/** Atomic data operations only. Meaning, meal classification and nutritional inference belong to the model. */
export function applyMealOperations(current: NutritionJournal, input: unknown, requestId: string, now = new Date().toISOString()): { journal: NutritionJournal; result: MealWriteResult } {
  if (!object(input) || !mealOperationId(requestId) || !mealOperationId(input.operationKey)) throw Error('饮食操作缺少有效编号。');
  const transactionId = `${requestId}:${input.operationKey}`;
  if (!mealOperationId(transactionId)) throw Error('饮食操作编号过长。');
  const receipt = current.mealOperationReceipts?.find(row => row.id === transactionId);
  if (receipt) return { journal: current, result: { ok: true, replayed: true, entryIds: receipt.entryIds,
    entries: current.entries.filter(row => receipt.entryIds.includes(row.id)) } };
  if (!Array.isArray(input.operations) || !input.operations.length || input.operations.length > 100) throw Error('请提交有效饮食操作列表（最多 100 项）。');
  let next = current;
  const touched: string[] = [];
  for (const [index, operation] of input.operations.entries()) {
    if (!object(operation)) throw Error('饮食操作格式无效。');
    if (operation.action === 'set_meal_status') {
      if (!isValidDateKey(operation.date) || !slots.includes(operation.slot as MealSlot)
        || !['not_eaten', 'unrecorded'].includes(operation.status as string)) throw Error('餐次状态格式无效。');
      next = withMealStatus(next, operation.date, operation.slot as MealSlot, operation.status as 'not_eaten' | 'unrecorded', now);
      continue;
    }
    const existing = typeof operation.entryId === 'string' ? next.entries.find(row => row.id === operation.entryId) : undefined;
    if (operation.action === 'delete' || operation.action === 'update') {
      if (!existing) throw Error('记录不存在，请重新读取饮食记录后操作。');
      next = invalidateMealLogging(next, existing.date, existing.slot);
    } else if (operation.action !== 'add') throw Error('未知饮食操作。');
    if (operation.action === 'delete') {
      next = { ...next, entries: next.entries.filter(row => row.id !== existing!.id) };
      touched.push(existing!.id);
      continue;
    }
    if (!isValidDateKey(operation.date) || !slots.includes(operation.slot as MealSlot)
      || typeof operation.name !== 'string' || !operation.name.trim() || operation.name.length > 200) throw Error('食物、日期或餐次格式无效。');
    if (operation.nutrients !== undefined && operation.nutrients !== null && !object(operation.nutrients)) throw Error('营养数据必须为对象或 null。');
    // Omitted nutritional values remain unknown; never ask for invented zeros to satisfy the API.
    const values = Object.fromEntries(nutrientKeys.map(key => [key, object(operation.nutrients) ? operation.nutrients[key] ?? null : null]));
    const food = normalizeAgentFood({ amount: operation.amount ?? null, values, estimated: operation.estimated });
    if (!food) throw Error('份量或营养数据格式无效；未知值请使用 null。');
    const id = existing?.id ?? `meal-${transactionId}-${index}`;
    const candidate = normalizeIntakeEntry({ id, date: operation.date, slot: operation.slot, name: operation.name, portions: [],
      source: 'agent', agentFood: food, nutrients: agentNutrientSnapshot(food), foodDataVersion: 'agent-reported-v1',
      photos: existing?.photos, createdAt: existing?.createdAt ?? now,
      updatedAt: existing && existing.updatedAt > now ? existing.updatedAt : now });
    if (!candidate) throw Error('记录无法保存，请核对数据格式。');
    next = invalidateMealLogging(next, candidate.date, candidate.slot);
    next = { ...next, entries: [candidate, ...next.entries.filter(row => row.id !== candidate.id)] };
    touched.push(id);
  }
  sumNutrients(next.entries.map(entry => entry.nutrients));
  // Receipts contain identifiers only: deleting a food does not retain its name, amounts or nutrition.
  next = { ...next, mealOperationReceipts: [...(next.mealOperationReceipts ?? []), { id: transactionId, requestId, entryIds: touched }] };
  return { journal: next, result: { ok: true, replayed: false, entryIds: touched, entries: next.entries.filter(row => touched.includes(row.id)) } };
}
