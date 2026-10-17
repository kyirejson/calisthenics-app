import AsyncStorage from '@react-native-async-storage/async-storage';
import { createWorkflowStore } from './workflows.mjs';
import { workflowEvidence, workflowVersionIssue } from './workflowEvidence.mjs';
import { phoneTransport } from './transport';
import { compactObservation } from './observations.mjs';
export const phoneWorkflows = createWorkflowStore(AsyncStorage);
export async function executeWorkflowTool(name: string, input: unknown, requestId: string, executionId: string, signal?: AbortSignal,
  onInterruptedResult?: (call: { name: string; args: Record<string, unknown>; result: unknown }) => void) {
  if (signal?.aborted) throw Error('请求已取消。');
  const args = (input || {}) as Record<string, unknown>;
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('流程参数应为对象。');
  const status = await phoneTransport.status();
  if (!status.ok || !status.enabled) return { ...status, ok: false, code: status.code || 'phone_consent_required' };
  if (name === 'read_phone_workflows')
    return { ok: true, externalData: true, workflows: await phoneWorkflows.list(typeof args.query === 'string' ? args.query : '', args.includeSteps === true) };
  if (!requestId || !executionId) throw Error('流程工具需绑定当前用户请求。');
  if (name === 'delete_phone_workflow') return { ok: true, removed: await phoneWorkflows.remove(args.id) };
  if (name === 'save_phone_workflow') {
    const receipts = await phoneTransport.receipts(requestId);
    if (signal?.aborted) throw Error('请求已取消。');
    const evidence = workflowEvidence(args, receipts, requestId, executionId);
    return { ok: true, workflow: await phoneWorkflows.save(args, evidence), verifiedBy: 'model_outcome_with_native_execution_evidence' };
  }
  if (name !== 'run_phone_workflow' || typeof args.id !== 'string' || typeof args.operationKey !== 'string' || !args.operationKey.trim())
    throw Error('执行流程需要真实流程编号和操作编号。');
  let workflow;
  try { workflow = await phoneWorkflows.get(args.id, args.parameters ?? {}); }
  catch (error) {
    if (error && typeof error === 'object' && 'code' in error)
      return { ok: false, code: error.code, message: error instanceof Error ? error.message : '流程暂不可用。', workflowId: args.id, cache: { hit: false, executed: false } };
    throw error;
  }
  const started = Date.now(), runId = JSON.stringify([requestId, args.operationKey]);
  const finish = async (result: Record<string, unknown>) => {
    try { await phoneWorkflows.recordRun(args.id, workflow.revision, runId, result); } catch { /* Cache bookkeeping must not disguise an executed phone action. */ }
    return { ...result, workflowId: args.id, workflowRevision: workflow.revision, cache: { hit: true, executed: result.status === 'sequence_executed', replayed: result.replayed === true } };
  };
  const packages = [...new Set(workflow.steps.map((step: { packageName: string }) => step.packageName))];
  for (const packageName of packages) {
    if (signal?.aborted) throw Error('请求已取消。');
    let current: unknown, offset = 0;
    do {
      const result = await phoneTransport.findApps(packageName as string, offset);
      if (!result.ok) return finish({ ...result, elapsedMs: Date.now() - started });
      const apps = result.apps as Array<{ packageName: string; appVersion?: unknown }> | undefined;
      current = apps?.find(app => app.packageName === packageName)?.appVersion;
      offset = typeof result.nextOffset === 'number' ? result.nextOffset : -1;
    } while (!current && offset >= 0);
    const issue = workflowVersionIssue(workflow.evidence.appVersions[packageName as string], current, packageName);
    if (issue) return finish({ ...issue, elapsedMs: Date.now() - started });
  }
  if (signal?.aborted) throw Error('请求已取消。');
  const cancel = () => { void phoneTransport.cancel(executionId).catch(() => {}); };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    if (signal?.aborted) { cancel(); throw Error('请求已取消。'); }
    const result = compactObservation(await phoneTransport.executeAndObserve(requestId, executionId,
      { type: 'sequence', operationKey: args.operationKey, steps: workflow.steps, appVersions: workflow.evidence.appVersions }));
    const completed = await finish(result);
    if (signal?.aborted) { onInterruptedResult?.({ name, args, result: completed }); throw Error('流程已取消；已执行步骤保留回执，请先核对当前页面。'); }
    return completed;
  } finally { signal?.removeEventListener('abort', cancel); }
}
