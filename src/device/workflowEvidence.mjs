// Evidence is taken from native receipts, never from model-supplied claims or screen text.
import { workflowError } from './workflows.mjs';
export function workflowEvidence(input, receipts, requestId, executionId) {
  const keys = input.evidenceOperationKeys;
  if (!Array.isArray(keys) || !keys.length || keys.some(key => typeof key !== 'string' || !key.trim()) || new Set(keys).size !== keys.length)
    throw workflowError('workflow_evidence_required', '请提供本次已成功执行的 operationKey 列表，以关联实际回执。');
  const appVersions = {}, operations = [];
  for (const key of keys) {
    const entry = receipts.find(row => row.requestId === requestId && row.operationKey === key);
    if (!entry || typeof entry.executionId !== 'string' || entry.result?.ok !== true || entry.observation?.ok !== true ||
      !entry.commandHash || !entry.observation.snapshotId)
      throw workflowError('workflow_evidence_required', '指定步骤缺少本次成功执行及随后真实页面的回执，未保存为已验证流程。');
    const observed = entry.observation;
    if (observed.appVersion?.available === true && typeof observed.appVersion.versionCode === 'string')
      appVersions[observed.packageName] = observed.appVersion;
    operations.push({ operationKey: key, executionId: entry.executionId, commandHash: entry.commandHash, observedAt: observed.at, snapshotId: observed.snapshotId, packageName: observed.packageName });
  }
  for (const step of input.steps || []) {
    if (!step.packageName?.includes('{{') && !appVersions[step.packageName])
      throw workflowError('workflow_evidence_required', '流程包含尚未关联真实页面版本的应用，请补充相应成功步骤的回执。');
  }
  return { origin: 'native_receipts', requestId, verificationExecutionId: executionId, verifiedAt: Date.now(), operations, appVersions };
}
export function workflowVersionIssue(expected, actual, packageName) {
  if (!expected?.available || !actual?.available || typeof expected.versionCode !== 'string' || typeof actual.versionCode !== 'string')
    return { ok: false, code: 'workflow_version_unknown', packageName, message: '无法核实缓存对应的应用版本；可继续用原有工具读屏操作并重新保存流程。' };
  if (expected.versionCode !== actual.versionCode || expected.lastUpdateTime !== actual.lastUpdateTime)
    return { ok: false, code: 'workflow_app_changed', packageName, message: '应用已更新或重新安装，旧流程需由模型重新观察核实；未执行旧流程。' };
  return null;
}
