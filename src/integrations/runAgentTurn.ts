import type { AppRepository } from '../store/repository';
import { createDeepseekClient } from './deepseekClient.mjs';
import { currentConnection, loadConnection } from './credentials';
import { personalChat } from './personalTools.mjs';
import { executePersonalTool } from './personalData';
import { readOrInitializeMemory } from '../memory/operations';
import { profileMarkdown } from '../memory/profileMemory';
import { localWeightDate } from '../domain/weight/weightTrend';
import { phoneCommandTypes } from '../device/modelTools.mjs';
import { taskEvent, toolSample } from '../agent/usage.mjs';
import type { AgentConversation } from '../agent/conversation';

export async function runAgentTurn({ repository, messages, journal, wakeDetected = false, requestId, executionId, controller, onToolCall, onToolResult, onDelta, onRoundStart, endVoiceConversation, onTaskFinished, responseMode = 'text', restoreUi = true, usageTaskId, sessionId }:
  { repository: AppRepository; messages?: Array<{ role: string; content: unknown }>; journal?: ReturnType<AgentConversation['journal']>; wakeDetected?: boolean; requestId: string; executionId: string; controller: AbortController;
    onToolCall?: (call: { name: string; args: Record<string, unknown> }) => void;
    onToolResult?: (call: { name: string; args: Record<string, unknown>; result: unknown }) => void;
    onDelta?: (delta: string, accumulated: string) => void; onRoundStart?: () => void;
    endVoiceConversation?: () => Promise<void>; onTaskFinished?: (standby: boolean) => void; responseMode?: 'text' | 'voice'; restoreUi?: boolean;
    usageTaskId?: string; sessionId?: string }) {
  let unsubscribeMusic = () => {}, unsubscribePhone = () => {};
  let preservePhoneUi = false, answered = false, outcome: string | undefined;
  const metrics = await import('../agent/usageRuntime').then(module => module.createAgentUsageRecorder()).catch(() => null);
  const context = { taskId: usageTaskId || requestId, requestId, executionId, sessionId, source: responseMode, stage: 'agent' };
  metrics?.recordAgentEvent(taskEvent('task_start', context));
  const { musicTransport } = await import('../music/transport');
  const { phoneTransport } = await import('../device/transport');
  try {
    await repository.load();
    await loadConnection();
    if (controller.signal.aborted) throw Error('请求已取消，请重试。');
    unsubscribeMusic = musicTransport.onCancelled(executionId, () => controller.abort());
    unsubscribePhone = phoneTransport.onCancelled(executionId, () => controller.abort());
    const [musicReceipts, phoneReceipts] = await Promise.all([
      musicTransport.receipts(requestId).catch(e => [{ ok: false, error: e instanceof Error ? e.message : '音乐操作回执读取失败。' }]),
      phoneTransport.receipts(requestId).catch(e => [{ ok: false, error: e instanceof Error ? e.message : '手机操作回执读取失败。' }]),
    ]);
    const profile = repository.getSnapshot().profile;
    const answer = await personalChat({
      client: createDeepseekClient({ config: currentConnection(), usageContext: context, onUsage: sample => metrics?.recordAgentUsage(sample) }), messages, journal, requestId, modelId: currentConnection().model, wakeDetected,
      memory: await readOrInitializeMemory(profile ? profileMarkdown(profile) : null),
      date: localWeightDate(new Date()), time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      mealReceipts: repository.getSnapshot().nutritionJournal.mealOperationReceipts?.filter(row => row.requestId === requestId)
        .map(row => ({ operationKey: row.id.slice(requestId.length + 1), entryIds: row.entryIds })) ?? [],
      musicReceipts, phoneReceipts, signal: controller.signal,
      execute: (name: string, input: unknown, signal?: AbortSignal, interrupted?: (call: { name: string; args: Record<string, unknown>; result: unknown }) => Promise<void>) => {
        if (Object.hasOwn(phoneCommandTypes, name) || name === 'run_phone_workflow') preservePhoneUi = true;
        return executePersonalTool(name, input, repository.getSnapshot(), signal,
          { requestId, executionId, apply: repository.getSnapshot().applyMealOperations, updateSettings: repository.getSnapshot().updateSettings,
            onInterruptedToolResult: interrupted ? call => { void interrupted(call).catch(() => {}); } : onToolResult });
      },
      onToolMetric: ({ name, result, elapsedMs }: { name: string; result: unknown; elapsedMs: number }) => {
        const row = toolSample(name, result, { ...context, ...(controller.signal.aborted ? { status: 'cancelled' } : {}) }, elapsedMs);
        if (row.outcome) outcome = row.outcome;
        metrics?.recordAgentEvent(row);
      },
      onToolCall, onToolResult, onDelta, onRoundStart, endVoiceConversation, onTaskFinished, responseMode,
    });
    answered = true; return answer;
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
    metrics?.recordAgentEvent(taskEvent('task_end', context, controller.signal.aborted ? 'cancelled' : answered ? outcome || 'answered' : 'failed'));
  }
}
