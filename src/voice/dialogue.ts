import { isClearContextCommand } from '../features/chat/commands';
import type { AgentConversation, ToolReceipt, TurnHandle } from '../agent/conversation';
export type VoiceInput = { requestId: string; sessionId: string; text: string; wake?: boolean; taskId?: string };
type Dependencies = {
  prepare?(): Promise<void>;
  conversation: AgentConversation;
  active(id: string): Promise<boolean>; reply(id: string, text: string, standbyAfterReply?: boolean): Promise<void>; cancel(id: string): Promise<void>;
  standby(id: string): Promise<boolean>;
  turn(input: { journal: ReturnType<AgentConversation['journal']>; wakeDetected: boolean; requestId: string; controller: AbortController; usageTaskId?: string; sessionId?: string;
    endVoiceConversation(): Promise<void>;
    onTaskFinished(standby: boolean): void;
    onDelta(delta: string, accumulated: string): void; onRoundStart(): void;
    onToolCall(call: { name: string; args: Record<string, unknown> }): void; onToolResult(call: ToolReceipt): void }): Promise<string>;
  subscribeReset(callback: () => void): () => void;
  subscribeCancellation(id: string, callback: () => void): () => void;
};
/** Voice shares the existing chat context. Native session IDs own audio, not a second model history. */
export function createVoiceDialogue(dependencies: Dependencies) {
  const { conversation } = dependencies;
  const running = new Set<string>();
  return async (input: VoiceInput) => {
    if (!input || typeof input.requestId !== 'string' || typeof input.sessionId !== 'string' || typeof input.text !== 'string' || !input.text.trim() || running.has(input.requestId)) return;
    running.add(input.requestId);
    const controller = new AbortController();
    let handle: TurnHandle | null = null;
    let delivered = false;
    let returnToWake = false;
    let standbyAfterReply = false;
    const cancelled = () => { if (handle) conversation.interrupt(input.requestId); void dependencies.cancel(input.requestId).catch(() => {}); };
    controller.signal.addEventListener('abort', cancelled, { once: true });
    const unlisten = dependencies.subscribeReset(() => controller.abort());
    const unsubscribe = dependencies.subscribeCancellation(input.requestId, () => { if (!delivered) controller.abort(); });
    const deliver = async (text: string) => {
      // Generation finishes here; the native coordinator continues to own synthesis/playback.
      delivered = true;
      await dependencies.reply(input.requestId, text, standbyAfterReply);
    };
    try {
      await dependencies.prepare?.();
      await conversation.load();
      if (!(await dependencies.active(input.requestId)) || controller.signal.aborted) return;
      if (isClearContextCommand(input.text)) {
        await conversation.clear();
        if (await dependencies.active(input.requestId)) await deliver('上下文已清空，个人记忆和记录保留。');
        return;
      }
      handle = await conversation.begin({ requestId: input.requestId, source: 'voice', user: { content: input.text }, controller });
      if (!handle) return;
      const activeHandle = handle;
      const answer = await dependencies.turn({
        journal: conversation.journal(handle), wakeDetected: input.wake === true, requestId: input.requestId, controller,
        usageTaskId: input.taskId || input.requestId, sessionId: input.sessionId,
        endVoiceConversation: async () => {
          if (controller.signal.aborted || !(await dependencies.active(input.requestId)) || controller.signal.aborted) throw Error('本次语音请求已失效，不能结束新的对话。');
          returnToWake = true;
        },
        onTaskFinished: standby => { standbyAfterReply = standby; },
        onRoundStart: () => conversation.round(activeHandle), onDelta: (_delta, accumulated) => conversation.delta(activeHandle, accumulated),
        onToolCall: call => conversation.tool(activeHandle, call), onToolResult: call => conversation.receipt(activeHandle, call),
      });
      if (!controller.signal.aborted && await dependencies.active(input.requestId)) {
        if (returnToWake) {
          // Retire this native request only. A newer request/input wins the race;
          // no synthesized goodbye, global disable, context reset or business cancellation.
          delivered = true;
          await dependencies.standby(input.requestId);
          conversation.complete(handle, '');
        } else if (conversation.complete(handle, answer)) await deliver(answer);
        else controller.abort();
      } else controller.abort();
    } catch (error) {
      if (!controller.signal.aborted && await dependencies.active(input.requestId).catch(() => false)) {
        const message = error instanceof Error ? error.message : '对话暂时不可用，请稍后重试。';
        if (handle) conversation.fail(handle, message);
        await deliver(message);
      } else controller.abort();
    } finally {
      unsubscribe(); unlisten(); controller.signal.removeEventListener('abort', cancelled); running.delete(input.requestId);
    }
  };
}
