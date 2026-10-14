import { isClearContextCommand } from '../features/chat/commands';
export type VoiceInput = { requestId: string; sessionId: string; text: string };
type Message = { role: string; content: string };
type Dependencies = {
  active(id: string): Promise<boolean>; reply(id: string, text: string): Promise<void>;
  turn(input: { messages: Message[]; requestId: string; controller: AbortController }): Promise<string>;
  subscribeReset(callback: () => void): () => void;
};
/** Conversation ownership only. Transcripts and tool/intent decisions belong to the model. */
export function createVoiceDialogue(dependencies: Dependencies) {
  let messages: Message[] = [], session = '', current: AbortController | null = null;
  return async (input: VoiceInput) => {
    if (!input || typeof input.requestId !== 'string' || typeof input.sessionId !== 'string' || typeof input.text !== 'string' || !input.text.trim()) return;
    current?.abort();
    const controller = new AbortController(); current = controller;
    const unlisten = dependencies.subscribeReset(() => controller.abort());
    const timer = setInterval(() => { void dependencies.active(input.requestId).then(active => { if (!active) controller.abort(); }).catch(() => controller.abort()); }, 500);
    try {
      if (!(await dependencies.active(input.requestId))) return;
      if (session !== input.sessionId) { messages = []; session = input.sessionId; }
      if (isClearContextCommand(input.text)) { messages = []; await dependencies.reply(input.requestId, '对话上下文已清空，个人记忆和记录保留。'); return; }
      const next = [...messages, { role: 'user', content: input.text }];
      const answer = await dependencies.turn({ messages: next, requestId: input.requestId, controller });
      if (!controller.signal.aborted && await dependencies.active(input.requestId)) {
        messages = [...next, { role: 'assistant', content: answer }];
        await dependencies.reply(input.requestId, answer);
      }
    } catch (error) {
      if (!controller.signal.aborted && await dependencies.active(input.requestId).catch(() => false)) await dependencies.reply(input.requestId, error instanceof Error ? error.message : '对话暂时不可用，请稍后重试。');
    } finally { clearInterval(timer); unlisten(); if (current === controller) current = null; }
  };
}
