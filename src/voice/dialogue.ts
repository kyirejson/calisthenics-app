import { isClearContextCommand } from '../features/chat/commands';
import type { AgentConversation, ModelMessage, ToolReceipt, TurnHandle } from '../agent/conversation';
export type VoiceInput = { requestId: string; sessionId: string; text: string; wake?: boolean };
type Dependencies = {
  conversation: AgentConversation;
  active(id: string): Promise<boolean>; reply(id: string, text: string): Promise<void>; cancel(id: string): Promise<void>;
  turn(input: { messages: ModelMessage[]; requestId: string; controller: AbortController;
    onDelta(delta: string, accumulated: string): void; onRoundStart(): void;
    onToolCall(call: { name: string; args: Record<string, unknown> }): void; onToolResult(call: ToolReceipt): void }): Promise<string>;
  subscribeReset(callback: () => void): () => void;
};
/** Voice shares the existing chat context. Native session IDs own audio, not a second model history. */
export function createVoiceDialogue(dependencies: Dependencies) {
  const { conversation } = dependencies;
  const running = new Set<string>();
  return async (input: VoiceInput) => {
    if (!input || typeof input.requestId !== 'string' || typeof input.sessionId !== 'string' || typeof input.text !== 'string' || !input.text.trim() || running.has(input.requestId)) return;
    running.add(input.requestId);
    const controller = new AbortController();
    let delivered = false;
    const cancelled = () => { conversation.interrupt(input.requestId); void dependencies.cancel(input.requestId).catch(() => {}); };
    controller.signal.addEventListener('abort', cancelled, { once: true });
    const unlisten = dependencies.subscribeReset(() => controller.abort());
    const timer = setInterval(() => { void dependencies.active(input.requestId).then(active => { if (!delivered && !active) controller.abort(); }).catch(() => { if (!delivered) controller.abort(); }); }, 500);
    const deliver = async (text: string) => {
      // Native transfers ownership from processing to playback/listening here.
      // A previously issued active() poll may resolve false after this transfer;
      // that is completion, not cancellation of the newly playing answer.
      delivered = true; clearInterval(timer);
      await dependencies.reply(input.requestId, text);
    };
    let handle: TurnHandle | null = null;
    try {
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
        messages: [...(input.wake ? [{ role: 'system', content: JSON.stringify({ type: 'voice_input_state', ownerVerified: true, wakeDetected: true }) }] : []), ...conversation.messages(handle)], requestId: input.requestId, controller,
        onRoundStart: () => conversation.round(activeHandle), onDelta: (_delta, accumulated) => conversation.delta(activeHandle, accumulated),
        onToolCall: call => conversation.tool(activeHandle, call), onToolResult: call => conversation.receipt(activeHandle, call),
      });
      if (!controller.signal.aborted && await dependencies.active(input.requestId) && conversation.complete(handle, answer)) {
        await deliver(answer);
      } else controller.abort();
    } catch (error) {
      if (!controller.signal.aborted && await dependencies.active(input.requestId).catch(() => false)) {
        const message = error instanceof Error ? error.message : '对话暂时不可用，请稍后重试。';
        if (handle) conversation.fail(handle, message);
        await deliver(message);
      } else controller.abort();
    } finally {
      clearInterval(timer); unlisten(); controller.signal.removeEventListener('abort', cancelled); running.delete(input.requestId);
    }
  };
}
