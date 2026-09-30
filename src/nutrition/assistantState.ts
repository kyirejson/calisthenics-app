export const ASSISTANT_REPLY_LIMIT = 50;
export type AssistantFactKind = 'like' | 'avoid' | 'need' | 'allergy';
export type AssistantFact = { id: string; kind: AssistantFactKind; text: string; createdAt: string };
export type AssistantConversation = { id: string; question: string; answer: string; createdAt: string };
export type AssistantState = { version: 1; consentAt: string | null; facts: AssistantFact[]; conversations: AssistantConversation[] };
export type AssistantIntent = { type: 'remember'; kind: AssistantFactKind; text: string } | {
  type: 'log_intake'; slot: 'breakfast' | 'lunch' | 'snack' | 'dinner' | null;
  items: { name: string; state: 'raw' | 'cooked' | 'unknown'; quantity: number | null; unit: 'g' | 'ml' | 'piece' | 'bowl' | 'serving' | 'package' | null }[];
};
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max: number): v is string => typeof v === 'string' && !!v.trim() && Array.from(v).length <= max && !/[\u0000-\u001f]/u.test(v);
const timestamp = (v: unknown): v is string => typeof v === 'string' && v.length <= 30 && Number.isFinite(Date.parse(v));
export function shortAssistantReply(value: string): string { const chars = Array.from(value.trim()); return chars.length <= ASSISTANT_REPLY_LIMIT ? chars.join('') : '这次回答过长，请重试；没有改动记录。'; }
export function emptyAssistantState(): AssistantState { return { version: 1, consentAt: null, facts: [], conversations: [] }; }
export function normalizeAssistantIntent(input: unknown): AssistantIntent | null {
  if (!record(input)) return null;
  if (input.type === 'remember' && Object.keys(input).every(k => ['type', 'kind', 'text'].includes(k)) && ['like', 'avoid', 'need', 'allergy'].includes(input.kind as string) && text(input.text, 80)) return { type: 'remember', kind: input.kind as AssistantFactKind, text: input.text.trim() };
  if (input.type !== 'log_intake' || Object.keys(input).some(k => !['type', 'slot', 'items'].includes(k)) || !(input.slot === null || ['breakfast', 'lunch', 'snack', 'dinner'].includes(input.slot as string)) || !Array.isArray(input.items) || !input.items.length || input.items.length > 8) return null;
  const items: Extract<AssistantIntent, { type: 'log_intake' }>['items'] = [];
  for (const row of input.items) {
    if (!record(row) || Object.keys(row).some(k => !['name', 'state', 'quantity', 'unit'].includes(k)) || !text(row.name, 80) || !['raw', 'cooked', 'unknown'].includes(row.state as string) || !(row.unit === null || ['g', 'ml', 'piece', 'bowl', 'serving', 'package'].includes(row.unit as string)) || !(row.quantity === null || typeof row.quantity === 'number' && Number.isFinite(row.quantity) && row.quantity > 0 && row.quantity <= 2000)) return null;
    items.push({ name: row.name.trim(), state: row.state as typeof items[number]['state'], quantity: row.quantity as number | null, unit: row.unit as typeof items[number]['unit'] });
  }
  return { type: 'log_intake', slot: input.slot as Extract<AssistantIntent, { type: 'log_intake' }>['slot'], items };
}
export function normalizeAssistantState(input: unknown): AssistantState {
  const result = emptyAssistantState(); if (!record(input) || input.version !== 1) return result;
  if (timestamp(input.consentAt)) result.consentAt = input.consentAt;
  if (Array.isArray(input.facts)) for (const row of input.facts.slice(-40)) {
    if (record(row) && text(row.id, 100) && text(row.text, 80) && timestamp(row.createdAt) && ['like', 'avoid', 'need', 'allergy'].includes(row.kind as string) && !result.facts.some(f => f.id === row.id)) result.facts.push({ id: row.id, text: row.text.trim(), kind: row.kind as AssistantFactKind, createdAt: row.createdAt });
  }
  if (Array.isArray(input.conversations)) for (const row of input.conversations.slice(-30)) {
    if (record(row) && text(row.id, 100) && typeof row.question === 'string' && row.question.trim().length <= 1000 && row.question.trim() && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(row.question) && typeof row.answer === 'string' && row.answer.trim() && timestamp(row.createdAt) && !result.conversations.some(t => t.id === row.id)) result.conversations.push({ id: row.id, question: row.question.trim(), answer: shortAssistantReply(row.answer), createdAt: row.createdAt });
  }
  return result;
}
export function withAssistantFact(state: AssistantState, fact: AssistantFact): AssistantState {
  const normalized = normalizeAssistantState({ ...state, facts: [fact] }).facts[0];
  if (!normalized) throw new Error('记忆内容无效。');
  const facts = state.facts.filter(f => !(f.kind === fact.kind && f.text === fact.text) && f.id !== fact.id);
  if (facts.length >= 40) throw new Error('记忆已满，请先删除不再需要的内容。');
  return { ...state, facts: [...facts, normalized] };
}
