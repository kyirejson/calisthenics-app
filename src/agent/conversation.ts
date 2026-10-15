import type { ChatAttachment } from '../integrations/chatFileTypes';
import { attachmentMessage } from '../integrations/chatAttachments.mjs';
import { toolLabel } from './toolLabels';

export type ToolReceipt = { id?: string; name: string; args: Record<string, unknown>; result: unknown };
export type ModelMessage = { role: string; content: unknown; tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>; tool_call_id?: string };
export type AgentTurn = {
  id: string; requestId: string; role: 'user' | 'assistant'; source: 'text' | 'voice'; content: string;
  status: 'complete' | 'generating' | 'interrupted' | 'failed' | 'silent'; attachments?: ChatAttachment[];
  toolsUsed?: string[]; receipts?: ToolReceipt[]; spokenEnd?: number; deliveryError?: string;
};
export type VoicePresentation = {
  phase: string; requestId?: string; segmentId?: string; text?: string; spokenEnd?: number;
  speechStart?: number; speechEnd?: number; error?: string;
};
export type ConversationSnapshot = {
  turns: AgentTurn[]; generating: boolean; preview: { segmentId: string; text: string } | null;
  voice: VoicePresentation; error: string;
};
type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<unknown>; removeItem(key: string): Promise<unknown> };
export type TurnHandle = { id: string; token: number; controller: AbortController };
export const CONVERSATION_KEY = 'uncover.agent.conversation.v1';

/** One context and one write queue for typed UI and headless voice. No intent routing or history cap. */
export function createAgentConversation(storage: Storage) {
  let snapshot: ConversationSnapshot = { turns: [], generating: false, preview: null, voice: { phase: 'stopped' }, error: '' };
  let current: TurnHandle | null = null, epoch = 0, loaded = false, loading: Promise<void> | null = null;
  let writes: Promise<unknown> = Promise.resolve();
  const listeners = new Set<() => void>();
  const publish = (next: Partial<ConversationSnapshot>) => {
    snapshot = { ...snapshot, ...next };
    listeners.forEach(callback => callback());
  };
  const enqueue = (operation: () => Promise<unknown>) => {
    const job = writes.then(operation, operation);
    writes = job.catch(error => publish({ error: `对话保存失败：${error instanceof Error ? error.message : String(error)}` }));
    return job;
  };
  const persist = () => {
    const data = JSON.stringify({ version: 1, turns: snapshot.turns });
    void enqueue(() => storage.setItem(CONVERSATION_KEY, data)).catch(() => {});
  };
  const valid = (handle: TurnHandle) => current === handle && !handle.controller.signal.aborted;
  const update = (id: string, change: (turn: AgentTurn) => AgentTurn) => publish({ turns: snapshot.turns.map(turn => turn.id === `${id}:assistant` ? change(turn) : turn) });
  const interrupt = (id?: string) => {
    const activeId = current?.id;
    if (current && (!id || id === activeId)) { const old = current; current = null; old.controller.abort(); }
    const target = id || activeId || (snapshot.voice.phase === 'speaking' ? snapshot.voice.requestId : undefined);
    if (target) update(target, turn => ({ ...turn, status: 'interrupted' }));
    publish({ generating: current !== null });
    persist();
  };
  const load = async () => {
    if (loaded) return;
    if (!loading) {
      const token = epoch;
      loading = (async () => {
        const raw = await storage.getItem(CONVERSATION_KEY);
        if (epoch !== token || loaded) return;
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved.version !== 1 || !Array.isArray(saved.turns) || saved.turns.some((turn: AgentTurn) =>
            typeof turn.id !== 'string' || typeof turn.requestId !== 'string' || typeof turn.content !== 'string' ||
            !['user', 'assistant'].includes(turn.role) || !['text', 'voice'].includes(turn.source))) throw Error('对话存档格式无效，未覆盖现有对话。');
          publish({ turns: saved.turns.map((turn: AgentTurn) => turn.status === 'generating' ? { ...turn, status: 'interrupted' } : turn) });
        }
        loaded = true;
      })().catch(error => { publish({ error: error instanceof Error ? error.message : '无法读取对话。' }); throw error; }).finally(() => { loading = null; });
    }
    await loading;
  };
  const api = {
    getSnapshot: () => snapshot,
    subscribe: (callback: () => void) => { listeners.add(callback); return () => { listeners.delete(callback); }; },
    load, interrupt, valid,
    async begin(input: { requestId: string; source: 'text' | 'voice'; user: { content: string; attachments?: ChatAttachment[] }; controller: AbortController }) {
      await load();
      if (input.controller.signal.aborted) return null;
      // Duplicate headless delivery must not regenerate an answer or replay an operation.
      if (snapshot.turns.some(turn => turn.requestId === input.requestId && turn.role === 'assistant' && ['complete', 'silent'].includes(turn.status))) return null;
      interrupt();
      const handle: TurnHandle = { id: input.requestId, controller: input.controller, token: ++epoch };
      current = handle;
      const previous = snapshot.turns.find(turn => turn.id === `${input.requestId}:assistant`);
      const user: AgentTurn = { ...input.user, id: `${input.requestId}:user`, requestId: input.requestId, role: 'user', source: input.source, status: 'complete' };
      const assistant: AgentTurn = { id: `${input.requestId}:assistant`, requestId: input.requestId, role: 'assistant', source: input.source, content: '', status: 'generating', receipts: previous?.receipts, toolsUsed: previous?.toolsUsed };
      publish({ turns: [...snapshot.turns.filter(turn => turn.requestId !== input.requestId), user, assistant], generating: true, preview: null, error: '' });
      persist();
      return handle;
    },
    messages(handle?: TurnHandle): ModelMessage[] {
      const messages: ModelMessage[] = [], delivery = [];
      for (const turn of snapshot.turns.filter(turn => turn.id !== `${handle?.id}:assistant`)) {
        if (turn.role === 'user') { messages.push(attachmentMessage(turn)); continue; }
        // Restore actual executions as paired tool messages, never as words the assistant said.
        // Legacy receipts did not store call IDs; their stable local IDs survive retries/reloads.
        for (const [index, receipt] of (turn.receipts || []).entries()) {
          const id = receipt.id || `receipt_${turn.requestId.replace(/[^a-zA-Z0-9_-]/g, '_')}_${index}`;
          messages.push({ role: 'assistant', content: null, tool_calls: [{ id, type: 'function', function: { name: receipt.name, arguments: JSON.stringify(receipt.args) } }] });
          messages.push({ role: 'tool', tool_call_id: id, content: JSON.stringify(receipt.result) });
        }
        if (turn.content) messages.push({ role: 'assistant', content: turn.content });
        if (turn.source === 'voice' || turn.status !== 'complete') delivery.push({
          requestId: turn.requestId, status: turn.status, source: turn.source,
          ...(turn.source === 'voice' ? { spokenText: turn.content.slice(0, turn.spokenEnd ?? 0) } : {}),
          ...(turn.deliveryError ? { playbackError: turn.deliveryError } : {}),
        });
      }
      // Protocol state is distinct from both user instructions and user-visible answer text.
      if (delivery.length) messages.unshift({ role: 'system', content: JSON.stringify({ type: 'conversation_delivery_state', turns: delivery }) });
      return messages;
    },
    round(handle: TurnHandle) { if (valid(handle)) update(handle.id, turn => ({ ...turn, content: '' })); },
    delta(handle: TurnHandle, accumulated: string) { if (valid(handle)) update(handle.id, turn => ({ ...turn, content: accumulated })); },
    tool(handle: TurnHandle, call: { name: string; args: Record<string, unknown> }) {
      if (!valid(handle)) return;
      const label = toolLabel(call.name, call.args);
      update(handle.id, turn => ({ ...turn, toolsUsed: [...new Set([...(turn.toolsUsed || []), label])] }));
    },
    receipt(handle: TurnHandle, call: ToolReceipt) {
      // A completed effect stays recorded even if cancellation races its return. Never attach it to a different turn.
      if (!snapshot.turns.some(turn => turn.id === `${handle.id}:assistant`)) return;
      update(handle.id, turn => ({ ...turn, receipts: [...(turn.receipts || []), call] })); persist();
    },
    deliveryError(id: string, error: string) {
      update(id, turn => ({ ...turn, deliveryError: error }));
      publish({ error }); persist();
    },
    complete(handle: TurnHandle, answer: string) {
      if (!valid(handle)) return false;
      update(handle.id, turn => ({ ...turn, content: answer, status: answer.trim() ? 'complete' : 'silent' }));
      current = null; publish({ generating: false }); persist(); return true;
    },
    fail(handle: TurnHandle, error: string) {
      if (!valid(handle)) return;
      update(handle.id, turn => ({ ...turn, content: error, status: 'failed' }));
      current = null; publish({ generating: false, error }); persist();
    },
    preview(segmentId: string, text: string) { publish({ preview: text ? { segmentId, text } : null }); },
    voice(value: VoicePresentation) {
      publish({ voice: value, ...(value.phase === 'wake' || value.phase === 'stopped' ? { preview: null } : {}) });
      if (value.requestId && value.spokenEnd !== undefined) {
        update(value.requestId, turn => ({ ...turn, spokenEnd: Math.max(turn.spokenEnd || 0, Math.min(turn.content.length, value.spokenEnd!)) }));
        persist();
      }
    },
    async clear() {
      ++epoch; loaded = true;
      const previous = current; current = null; previous?.controller.abort();
      publish({ turns: [], generating: false, preview: null, error: '', voice: { ...snapshot.voice, error: undefined } });
      await enqueue(() => storage.removeItem(CONVERSATION_KEY));
    },
    flush: async () => { await writes; },
  };
  return api;
}
export type AgentConversation = ReturnType<typeof createAgentConversation>;
