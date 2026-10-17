import type { ChatAttachment } from '../integrations/chatFileTypes';
import { createPromptJournal } from './promptJournal.mjs';
import { toolLabel } from './toolLabels';
import type { VoicePresentation } from '../voice/protocol';
import { hasVoiceOutput } from '../voice/protocol';
export type { VoicePresentation } from '../voice/protocol';

export type ToolReceipt = { id?: string; name: string; args: Record<string, unknown>; result: unknown };
export type ModelMessage = { role: string; content: unknown; reasoning_content?: string; tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>; tool_call_id?: string };
export type AgentTurn = {
  id: string; requestId: string; role: 'user' | 'assistant'; source: 'text' | 'voice'; content: string;
  status: 'complete' | 'generating' | 'interrupted' | 'failed' | 'silent'; attachments?: ChatAttachment[];
  toolsUsed?: string[]; receipts?: ToolReceipt[]; spokenEnd?: number; deliveryError?: string;
};
export type ConversationSnapshot = {
  turns: AgentTurn[]; generating: boolean; preview: { segmentId: string; text: string } | null;
  voice: VoicePresentation; error: string;
};
type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<unknown>; removeItem(key: string): Promise<unknown>; getAllKeys?(): Promise<readonly string[]> };
export type TurnHandle = { id: string; token: number; controller: AbortController };
export const CONVERSATION_KEY = 'uncover.agent.conversation.v1';

/** One context and one write queue for typed UI and headless voice. No intent routing or history cap. */
export function createAgentConversation(storage: Storage) {
  const journal = createPromptJournal(storage);
  const journals = new Map<string, Awaited<ReturnType<typeof journal.bind>>>();
  let snapshot: ConversationSnapshot = { turns: [], generating: false, preview: null, voice: { phase: 'stopped' }, error: '' };
  let current: TurnHandle | null = null, epoch = 0, loaded = false, loading: Promise<void> | null = null;
  let writes: Promise<unknown> = Promise.resolve();
  let beginnings: Promise<unknown> = Promise.resolve();
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
  const record = (operation: () => Promise<unknown>) => { const token = journal.generation(); void enqueue(async () => { if (token === journal.generation()) await operation(); }).catch(() => {}); };
  const valid = (handle: TurnHandle) => current === handle && !handle.controller.signal.aborted;
  const update = (id: string, change: (turn: AgentTurn) => AgentTurn) => publish({ turns: snapshot.turns.map(turn => turn.id === `${id}:assistant` ? change(turn) : turn) });
  const interrupt = (id?: string) => {
    const activeId = current?.id;
    if (current && (!id || id === activeId)) { const old = current; current = null; old.controller.abort(); }
    const target = id || activeId || (hasVoiceOutput(snapshot.voice) ? snapshot.voice.requestId : undefined);
    if (target && snapshot.turns.some(turn => turn.id === `${target}:assistant`)) {
      update(target, turn => ({ ...turn, status: 'interrupted' }));
      const turn = snapshot.turns.find(turn => turn.id === `${target}:assistant`)!;
      record(() => journal.delivery(target, { status: 'interrupted', spokenEnd: turn.spokenEnd ?? 0 }));
    }
    publish({ generating: current !== null });
  };
  const load = async () => {
    if (loaded) return;
    if (!loading) {
      const token = epoch;
      loading = (async () => {
        const raw = await storage.getItem(CONVERSATION_KEY);
        if (epoch !== token || loaded) return;
        let legacyTurns: AgentTurn[] = [];
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved.version !== 1 || !Array.isArray(saved.turns) || saved.turns.some((turn: AgentTurn) =>
            typeof turn.id !== 'string' || typeof turn.requestId !== 'string' || typeof turn.content !== 'string' ||
            !['user', 'assistant'].includes(turn.role) || !['text', 'voice'].includes(turn.source))) throw Error('对话存档格式无效，未覆盖现有对话。');
          legacyTurns = saved.turns;
        }
        await journal.load();
        if (epoch !== token || loaded) return;
        await journal.migrate(legacyTurns);
        if (epoch !== token || loaded) return;
        const restored = journal.uiTurns() as AgentTurn[];
        publish({ turns: restored.map(turn => ({ ...turn, toolsUsed: [...new Set((turn.receipts || []).map(receipt => toolLabel(receipt.name, receipt.args)))] })) });
        if (raw && legacyTurns.length && journal.events().length) await storage.removeItem(CONVERSATION_KEY);
        loaded = true;
      })().catch(error => { if (epoch !== token) return; publish({ error: error instanceof Error ? error.message : '无法读取对话。' }); throw error; }).finally(() => { loading = null; });
    }
    await loading;
  };
  const api = {
    getSnapshot: () => snapshot,
    subscribe: (callback: () => void) => { listeners.add(callback); return () => { listeners.delete(callback); }; },
    load, interrupt, valid,
    async begin(input: { requestId: string; source: 'text' | 'voice'; user: { content: string; attachments?: ChatAttachment[] }; controller: AbortController }) {
      const generation = journal.generation();
      const job = beginnings.then(async () => {
        await load();
        if (input.controller.signal.aborted || generation !== journal.generation()) return null;
        // Duplicate headless delivery must not regenerate an answer or replay an operation.
        if (journal.finished(input.requestId) || snapshot.turns.some(turn => turn.requestId === input.requestId && turn.role === 'assistant' && ['complete', 'silent'].includes(turn.status))) return null;
        interrupt();
        await writes;
        if (input.controller.signal.aborted || generation !== journal.generation()) return null;
        const turnJournal = await journal.bind(input.requestId, input.user, input.source);
        if (input.controller.signal.aborted || generation !== journal.generation()) return null;
        journals.set(input.requestId, turnJournal);
        const handle: TurnHandle = { id: input.requestId, controller: input.controller, token: ++epoch };
        current = handle;
        const previous = snapshot.turns.find(turn => turn.id === `${input.requestId}:assistant`);
        const savedInput = journal.events().find(event => event.type === 'user_input' && event.requestId === input.requestId);
        const user: AgentTurn = { ...input.user, attachments: savedInput?.data.attachments?.map((file: ChatAttachment) => ({ ...file, text: '' })), id: `${input.requestId}:user`, requestId: input.requestId, role: 'user', source: input.source, status: 'complete' };
        const assistant: AgentTurn = { id: `${input.requestId}:assistant`, requestId: input.requestId, role: 'assistant', source: input.source, content: '', status: 'generating', receipts: previous?.receipts, toolsUsed: previous?.toolsUsed };
        publish({ turns: [...snapshot.turns.filter(turn => turn.requestId !== input.requestId), user, assistant], generating: true, preview: null, error: '' });
        return handle;
      });
      beginnings = job.catch(() => {});
      return job;
    },
    assessmentMessages: (): ModelMessage[] => journal.assessmentMessages(),
    assessmentEpoch: journal.assessmentEpoch,
    identity: journal.identity,
    journal(handle: TurnHandle) {
      const result = journals.get(handle.id);
      if (!result) throw Error('本轮模型日志尚未建立。');
      return result;
    },
    messages(handle?: TurnHandle): ModelMessage[] {
      // Inspection only. Production requests use the bound journal, never UI receipts.
      const messages: ModelMessage[] = journal.messages();
      if (handle) {
        const all = journal.events();
        const user = all.find(event => event.type === 'user_input' && event.requestId === handle.id);
        if (user && !all.some(event => event.type === 'message' && event.requestId === handle.id && event.data.message.role === 'user')) messages.push(user.data.message);
      }
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
      update(handle.id, turn => ({ ...turn, receipts: [...(turn.receipts || []).filter(row => !call.id || row.id !== call.id), call] }));
      record(async () => {
        const bound = journals.get(handle.id);
        if (bound && (!call.id || !bound.resultFor(call.id))) await bound.receipt(call);
      });
    },
    deliveryError(id: string, error: string) {
      update(id, turn => ({ ...turn, deliveryError: error }));
      if (snapshot.turns.some(turn => turn.id === `${id}:assistant`)) record(() => journal.delivery(id, { status: 'playback_failed', playbackError: error }));
      publish({ error });
    },
    complete(handle: TurnHandle, answer: string) {
      if (!valid(handle)) return false;
      update(handle.id, turn => ({ ...turn, content: answer, status: answer.trim() ? 'complete' : 'silent' }));
      record(() => journal.directComplete(handle.id, answer));
      current = null; publish({ generating: false }); return true;
    },
    fail(handle: TurnHandle, error: string) {
      if (!valid(handle)) return;
      update(handle.id, turn => ({ ...turn, content: error, status: 'failed' }));
      record(() => journal.delivery(handle.id, { status: 'generation_failed', error }));
      current = null; publish({ generating: false, error });
    },
    voice(value: VoicePresentation) {
      const preview = value.text !== undefined && value.segmentId !== undefined
        ? value.text && value.segmentId ? { segmentId: value.segmentId, text: value.text } : null
        : value.phase === 'wake' || value.phase === 'stopped' || value.phase === 'blocked' ? null : snapshot.preview;
      publish({ voice: value, preview });
      if (value.requestId && value.spokenEnd !== undefined) {
        update(value.requestId, turn => ({ ...turn, spokenEnd: Math.max(turn.spokenEnd || 0, Math.min(turn.content.length, value.spokenEnd!)) }));
        // Progress is UI state. Commit one delivery event at a semantic boundary, not every PCM callback.
        if (!hasVoiceOutput(value)) {
          record(() => journal.delivery(value.requestId!, { status: 'playback_finished', spokenEnd: value.spokenEnd }));
        }
      }
    },
    async clear() {
      ++epoch; loaded = true;
      const previous = current; current = null; previous?.controller.abort();
      publish({ turns: [], generating: false, preview: null, error: '', voice: { ...snapshot.voice, error: undefined } });
      journals.clear();
      const cleared = journal.clear();
      await enqueue(() => storage.removeItem(CONVERSATION_KEY));
      await cleared;
    },
    flush: async () => { await writes; await journal.flush(); },
  };
  return api;
}
export type AgentConversation = ReturnType<typeof createAgentConversation>;
