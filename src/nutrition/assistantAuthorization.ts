import { assistantAuthorization, type AssistantFact, type AssistantState, type AssistantPreferencePatch } from './assistantState';
import type { IntakeInput } from './journal';
import type { MealAdjustmentDraft } from './adjustments';
import type { NutritionJournal } from './types';
import type { DailyWorkoutEdits, Profile, TrainingSession } from '../types';

export type AssistantOperation = { id: string; policyVersion: number; confirmed: boolean; basis: string } & (
  { kind: 'open_music'; playlist: string } | { kind: 'training_adjustment'; draft: import('../agent/trainingActions').TrainingDraft } | { kind: 'remember'; fact: AssistantFact } | { kind: 'log_intake'; input: IntakeInput } | { kind: 'meal'; draft: MealAdjustmentDraft } | { kind: 'set_preferences'; patch: AssistantPreferencePatch } | { kind: 'meal_status'; date: string; slot: import('./types').MealSlot; status: 'not_eaten' | 'unrecorded' }
);
export function assistantDataBasis(journal: NutritionJournal, profile: Profile | null, sessions: TrainingSession[], edits: DailyWorkoutEdits) {
  const mealStates = Object.entries(journal.days).filter(([, day]) => day.confirmedSlots.length || day.skippedSlots?.length || day.completedAt)
    .sort(([a], [b]) => a.localeCompare(b)).map(([date, day]) => [date, day.confirmedSlots, day.skippedSlots || [], day.completedAt]);
  return JSON.stringify([profile, sessions, edits, journal.preferences, journal.entries, journal.customFoods, journal.mealOverrides, mealStates, journal.assistant.facts, journal.assistant.personalProfiles, journal.assistant.trainingOverlays, journal.assistant.agentPreferences, journal.assistant.consentAt, journal.assistant.consentScope]);
}
export function authorizeAssistantOperation(state: AssistantState, operation: AssistantOperation, basis: string): 'replay' | 'execute' {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(operation.id)) throw new Error('助手操作编号无效。');
  const payload = assistantOperationPayload(operation), receipt = state.receipts?.[operation.id];
  if (receipt) { if (receipt.kind !== operation.kind || receipt.payload !== payload && receipt.payload !== '<forgotten>') throw new Error('同一助手操作不能改变内容后重放。'); return 'replay'; }
  const authorization = assistantAuthorization(state);
  if (operation.policyVersion !== authorization.policyVersion) throw new Error('执行权限已变化，请重新发送请求。');
  if (authorization.mode === 'request_confirmation' && operation.confirmed !== true) throw new Error('请先确认此助手操作。');
  if (operation.basis !== basis) throw new Error('记录或档案已变化，请重新生成草案。');
  return 'execute';
}
export function assistantOperationPayload(operation: AssistantOperation) { return JSON.stringify(operation.kind === 'open_music' ? operation.playlist : operation.kind === 'remember' ? operation.fact : operation.kind === 'log_intake' ? operation.input : operation.kind === 'set_preferences' ? operation.patch : operation.kind === 'meal_status' ? { date: operation.date, slot: operation.slot, status: operation.status } : operation.draft); }
