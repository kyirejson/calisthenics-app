const KEY = 'uncover.phone.workflows.v1';
const sources = ['auto', 'accessibility', 'ocr'];
const actions = ['click', 'tap', 'long_click', 'set_text', 'submit', 'scroll_forward', 'scroll_backward'];
export const workflowError = (code, message) => Object.assign(Error(message), { code });
function object(value) { if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('流程参数应为对象。'); return value; }
function state(row) {
  return row.evidence?.origin === 'native_receipts' && Array.isArray(row.evidence.operations) && row.evidence.operations.length && Object.keys(row.evidence.appVersions || {}).length
    ? row.status || 'ready' : 'needs_review';
}
function validate(args) {
  if (typeof args.id !== 'string' || !args.id.trim() || typeof args.name !== 'string' || !args.name.trim() || typeof args.description !== 'string' ||
    !Array.isArray(args.steps) || !args.steps.length || typeof args.verifiedOutcome !== 'string' || !args.verifiedOutcome.trim())
    throw Error('流程需包含编号、名称、说明、实际已核实的结果及步骤。');
  if (args.parameters !== undefined && (!Array.isArray(args.parameters) || args.parameters.some(key => typeof key !== 'string' || !/^[a-zA-Z0-9_]+$/.test(key)) || new Set(args.parameters).size !== args.parameters.length))
    throw Error('流程参数名需为不重复的字母、数字或下划线。');
  for (const step of args.steps) {
    if (!['open', 'ui', 'observe'].includes(step?.type) || typeof step.packageName !== 'string' || !step.packageName.trim())
      throw Error('流程步骤需要真实包名和受支持的操作类型。');
    if (step.source !== undefined && !sources.includes(step.source)) throw Error('未知流程定位来源。');
    if (step.timeoutMs !== undefined && (!Number.isSafeInteger(step.timeoutMs) || step.timeoutMs <= 0)) throw Error('页面等待时间应为正整数毫秒。');
    if (step.expectedText !== undefined && (!Array.isArray(step.expectedText) || step.expectedText.some(text => typeof text !== 'string'))) throw Error('页面条件应为文字数组。');
    if (step.type === 'ui') {
      const selector = object(step.selector);
      if (!Object.keys(selector).length || !actions.includes(step.action)) throw Error('控件步骤需包含实际定位条件和动作。');
      for (const [key, value] of Object.entries(selector)) {
        if (!['resourceId', 'text', 'description', 'label', 'className', 'editable', 'clickable'].includes(key) ||
          (['editable', 'clickable'].includes(key) ? typeof value !== 'boolean' : typeof value !== 'string')) throw Error('控件定位字段或类型无效。');
      }
      if (step.action === 'set_text' && typeof step.text !== 'string') throw Error('填写步骤需要文字。');
      if (step.source === 'ocr' && (!['click', 'tap', 'long_click'].includes(step.action) || Object.keys(selector).length !== 1 || typeof selector.text !== 'string'))
        throw Error('OCR 步骤用实际整行文字定位点击或长按；输入文字需要真实可编辑控件。');
    }
  }
}
export function createWorkflowStore(storage) {
  let writes = Promise.resolve();
  const parse = raw => { const rows = JSON.parse(raw || '[]'); if (!Array.isArray(rows)) throw Error('流程缓存格式无效。'); return rows; };
  const read = async () => { await writes; return parse(await storage.getItem(KEY)); };
  const change = operation => {
    const job = writes.then(async () => {
      const rows = parse(await storage.getItem(KEY)); const result = operation(rows);
      await storage.setItem(KEY, JSON.stringify(rows)); return result;
    });
    writes = job.catch(() => {}); return job;
  };
  return {
    async list(query = '', includeSteps = false) {
      const term = String(query).toLocaleLowerCase();
      return (await read()).filter(row => !term || `${row.name} ${row.description}`.toLocaleLowerCase().includes(term)).map(row => {
        const { steps, evidence, recentRuns, ...summary } = row;
        return { ...summary, status: state(row), stepCount: steps.length,
          ...(state(row) === 'needs_review' && !row.reviewReason ? { reviewReason: 'missing_verified_evidence' } : {}),
          ...(evidence ? { evidence: includeSteps ? evidence : { verifiedAt: evidence.verifiedAt, appVersions: evidence.appVersions, operationCount: evidence.operations.length } } : {}),
          ...(includeSteps ? { steps } : {}) };
      });
    },
    async save(input, evidence) {
      const args = object(input); validate(args);
      if (evidence?.origin !== 'native_receipts' || !Array.isArray(evidence.operations) || !evidence.operations.length || !Object.keys(evidence.appVersions || {}).length)
        throw workflowError('workflow_evidence_required', '流程需要本次真实执行回执与应用版本，不能仅凭描述标记为已验证。');
      return change(rows => {
        const previous = rows.find(row => row.id === args.id);
        const row = { id: args.id, name: args.name, description: args.description, verifiedOutcome: args.verifiedOutcome,
          parameters: args.parameters || [], steps: args.steps, evidence, status: 'ready', revision: 'flow-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2),
          statistics: previous?.statistics || { attempts: 0, executedRuns: 0, failedRuns: 0, totalElapsedMs: 0 }, recentRuns: [], updatedAt: Date.now() };
        const index = rows.findIndex(item => item.id === row.id); if (index < 0) rows.push(row); else rows[index] = row;
        return { id: row.id, status: row.status, revision: row.revision, stepCount: row.steps.length, verifiedAt: evidence.verifiedAt };
      });
    },
    async get(id, parameters = {}) {
      const row = (await read()).find(item => item.id === id);
      if (!row) throw workflowError('workflow_not_found', '未找到保存的流程，请自行读屏规划。');
      if (state(row) !== 'ready') throw workflowError('workflow_needs_review', '该流程缺少真实验证证据或已失效；可读取旧步骤参考，自行操作核实后重新保存。');
      const values = object(parameters);
      for (const name of row.parameters) if (typeof values[name] !== 'string') throw Error(`缺少流程参数 ${name}，应由模型根据当前用户请求提供。`);
      function fill(value) {
        if (typeof value === 'string') return value.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => {
          if (typeof values[key] !== 'string') throw Error(`缺少流程参数 ${key}。`); return values[key];
        });
        if (Array.isArray(value)) return value.map(fill);
        if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, fill(item)]));
        return value;
      }
      return { ...row, steps: fill(row.steps) };
    },
    async recordRun(id, revision, runId, result) {
      return change(rows => {
        const row = rows.find(item => item.id === id);
        if (!row || row.revision !== revision || row.recentRuns?.includes(runId)) return;
        row.recentRuns = [...(row.recentRuns || []).slice(-31), runId];
        const stats = row.statistics || { attempts: 0, executedRuns: 0, failedRuns: 0, totalElapsedMs: 0 };
        stats.attempts++; stats[result.ok ? 'executedRuns' : 'failedRuns']++;
        stats.totalElapsedMs += Number.isFinite(result.elapsedMs) ? Math.max(0, result.elapsedMs) : 0;
        row.statistics = stats;
        row.lastRun = { at: Date.now(), ok: result.ok === true, code: result.code || null, replayed: result.replayed === true };
        if (['workflow_app_changed', 'workflow_version_unknown', 'workflow_page_changed', 'workflow_ambiguous_target', 'workflow_step_failed',
          'workflow_ocr_unavailable', 'stale_visual_text', 'stale_screen', 'stale_node', 'wrong_app'].includes(result.code)) {
          row.status = 'needs_review'; row.reviewReason = result.code;
        }
      });
    },
    async remove(id) {
      if (typeof id !== 'string' || !id.trim()) throw Error('需要流程编号。');
      return change(rows => { const index = rows.findIndex(row => row.id === id); if (index < 0) return false; rows.splice(index, 1); return true; });
    },
    async clear() { const job = writes.then(() => storage.removeItem(KEY)); writes = job.catch(() => {}); await job; },
  };
}
export const workflowStorageKey = KEY;
