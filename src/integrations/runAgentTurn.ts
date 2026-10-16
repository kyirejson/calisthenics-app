import type { AppRepository } from '../store/repository';
import { createDeepseekClient } from './deepseekClient.mjs';
import { currentConnection, loadConnection } from './credentials';
import { personalChat } from './personalTools.mjs';
import { executePersonalTool } from './personalData';
import { readOrInitializeMemory } from '../memory/operations';
import { profileMarkdown } from '../memory/profileMemory';
import { localWeightDate } from '../domain/weight/weightTrend';
import { phoneCommandTypes } from '../device/modelTools.mjs';

export async function runAgentTurn({ repository, messages, requestId, executionId, controller, onToolCall, onToolResult, onDelta, onRoundStart, endVoiceConversation, responseMode = 'text', restoreUi = true }:
  { repository: AppRepository; messages: Array<{ role: string; content: unknown }>; requestId: string; executionId: string; controller: AbortController;
    onToolCall?: (call: { name: string; args: Record<string, unknown> }) => void;
    onToolResult?: (call: { name: string; args: Record<string, unknown>; result: unknown }) => void;
    onDelta?: (delta: string, accumulated: string) => void; onRoundStart?: () => void;
    endVoiceConversation?: () => Promise<void>; responseMode?: 'text' | 'voice'; restoreUi?: boolean }) {
  let unsubscribeMusic = () => {};
  let unsubscribePhone = () => {};
  let preservePhoneUi = false;
  const { musicTransport } = await import('../music/transport');
  const { phoneTransport } = await import('../device/transport');
  try {
    await repository.load();
    await loadConnection();
    if (controller.signal.aborted) throw Error('请求已取消，请重试。');
    unsubscribeMusic = musicTransport.onCancelled(executionId, () => controller.abort());
    unsubscribePhone = phoneTransport.onCancelled(executionId, () => controller.abort());
    const musicReceipts = await musicTransport.receipts(requestId).catch(e => [{ ok: false, error: e instanceof Error ? e.message : '音乐操作回执读取失败。' }]);
    const phoneReceipts = await phoneTransport.receipts(requestId).catch(e => [{ ok: false, error: e instanceof Error ? e.message : '手机操作回执读取失败。' }]);
    const profile = repository.getSnapshot().profile;
    return await personalChat({
      client: createDeepseekClient({ config: currentConnection() }), messages,
      memory: await readOrInitializeMemory(profile ? profileMarkdown(profile) : null),
      date: localWeightDate(new Date()), time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      mealReceipts: repository.getSnapshot().nutritionJournal.mealOperationReceipts?.filter(row => row.requestId === requestId)
        .map(row => ({ operationKey: row.id.slice(requestId.length + 1), entryIds: row.entryIds })) ?? [],
      musicReceipts, phoneReceipts, signal: controller.signal,
      execute: (name: string, input: unknown, signal?: AbortSignal) => {
        if (Object.hasOwn(phoneCommandTypes, name)) preservePhoneUi = true;
        return executePersonalTool(name, input, repository.getSnapshot(), signal,
          { requestId, executionId, apply: repository.getSnapshot().applyMealOperations, updateSettings: repository.getSnapshot().updateSettings, onInterruptedToolResult: onToolResult });
      },
      onToolCall, onToolResult, onDelta, onRoundStart, endVoiceConversation, responseMode,
    });
  } finally {
    try {
      if (controller.signal.aborted) await phoneTransport.cancel(executionId);
      await phoneTransport.finish(executionId);
    } catch { /* Keep the requested app visible; a revoked permission cannot strand the Agent. */ }
    try {
      if (controller.signal.aborted) await musicTransport.cancel(executionId);
      if (restoreUi && !preservePhoneUi) await musicTransport.returnToApp(requestId, executionId);
      else await musicTransport.finishWithoutUi(requestId, executionId);
    } catch { /* A revoked music permission cannot strand either text or voice requests. */ }
    unsubscribeMusic(); unsubscribePhone();
  }
}
