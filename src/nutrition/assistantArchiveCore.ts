import { normalizeAssistantState, type AssistantConversation } from './assistantState';
import { memoryTokens, memoryTimeRange } from './personalKnowledge';
import type { Goal } from '../types';

export const ASSISTANT_PAGE_SIZE = 30;
export type ArchiveQuery = { before?: string; limit?: number; question?: string; topic?: Goal; now?: Date };
export interface AssistantArchive {
  migrate(turns: AssistantConversation[]): Promise<void>;
  put(turn: AssistantConversation): Promise<void>;
  list(query?: ArchiveQuery): Promise<AssistantConversation[]>;
  forget(text: string): Promise<void>;
  clear(): Promise<void>;
  exportAll(): Promise<AssistantConversation[]>;
}
export function validatedTurn(turn: AssistantConversation): AssistantConversation {
  const normalized = normalizeAssistantState({ version: 1, conversations: [turn] }).conversations[0];
  if (!normalized) throw new Error('对话归档内容无效。');
  return normalized;
}
export function archiveCursor(turn: Pick<AssistantConversation, 'createdAt' | 'id'>) { return turn.createdAt + '|' + turn.id; }
export function archiveSearchTokens(question: string) {
  return memoryTokens(question.replace(/上次|之前|以前|记得|记忆|刚才|我的|我曾经|你还|是否|什么|哪些|了吗|吗|呢|\s/gu, '')).slice(0, 32);
}
export function rankArchive(rows: AssistantConversation[], query: ArchiveQuery = {}): AssistantConversation[] {
  const tokens = new Set(archiveSearchTokens(query.question || '')), range = memoryTimeRange(query.question || '', query.now);
  return rows.filter(t => (!query.topic || !t.topic || t.topic === query.topic) && (!query.before || archiveCursor(t) < query.before)
    && (!range || t.createdAt >= range.start && t.createdAt < range.end))
    .map(t => ({ t, score: memoryTokens(t.question).filter(token => tokens.has(token)).length }))
    .filter(r => !tokens.size || r.score > 0 || !!range)
    .sort((a, b) => query.question && !range ? b.score - a.score || archiveCursor(b.t).localeCompare(archiveCursor(a.t)) : archiveCursor(b.t).localeCompare(archiveCursor(a.t)))
    .slice(0, Math.max(1, Math.min(query.limit || ASSISTANT_PAGE_SIZE, 100))).map(r => r.t);
}
