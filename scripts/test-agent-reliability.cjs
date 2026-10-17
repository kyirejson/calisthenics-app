const test = require('node:test'), assert = require('node:assert/strict');
require('./lib/register-typescript.cjs')();
const verifiedEvidence = () => ({ origin: 'native_receipts', requestId: 'fixture-request', verifiedAt: 100,
  operations: [{ operationKey: 'fixture-operation', commandHash: 'fixture-hash' }],
  appVersions: { 'org.example.app': { available: true, versionCode: '1', lastUpdateTime: 100 } } });
test('date, memory, clock, delivery and operation state follow the stable system and dialogue prefix', async () => {
  const { personalChat } = await import('../src/integrations/personalTools.mjs');
  const prefixes = [], histories = [];
  for (const date of ['2026-10-16', '2026-10-17']) await personalChat({ date, time: date.endsWith('17') ? '11:32' : '11:30', memory: 'memory-' + date, messages: [{ role: 'user', content: '继续' }],
    phoneReceipts: [{ operationKey: date }], client: { generate: async history => { prefixes.push(history[0].content); histories.push([...history]); return '完成。'; } }, execute: async () => ({ ok: true }),
  });
  assert.equal(prefixes[0], prefixes[1]); assert.ok(!prefixes[0].includes('2026-10-16'));
  assert.equal(histories[0][1].content, histories[1][1].content);
  assert.equal(histories[0][1].role, 'user'); assert.notEqual(histories[0][2].content, histories[1][2].content);
  assert.match(histories[0].at(-1).content, /request_execution_state/);
});
test('compact observations keep all text, coordinates, references and action IDs while dropping duplicate/default fields', async () => {
  const { compactObservation } = await import('../src/device/observations.mjs');
  const screen = { ok: true, snapshotId: 's', packageName: 'p', bounds: [0, 0, 1080, 2000], nodes: Array.from({ length: 100 }, (_, index) => ({
    nodeId: `n${index}`, text: `内容${index}`, label: `内容${index}`, description: '', resourceId: 'p:id/real', className: 'android.widget.TextView', clickable: false, editable: false,
    scrollable: false, enabled: true, selected: false, focused: false, focusable: false, showingHint: false, actions: [{ id: 16, label: null }], bounds: [0, index, 30, index + 1],
  })) };
  const result = compactObservation(screen);
  assert.equal(result.nodes.length, 100); assert.deepEqual(result.bounds, screen.bounds); assert.equal(result.snapshotId, 's');
  for (let i = 0; i < 100; i++) { assert.equal(result.nodes[i].text, screen.nodes[i].text); assert.equal(result.nodes[i].nodeId, `n${i}`); assert.equal(result.nodes[i].actions[0].id, 16); }
  assert.ok(JSON.stringify(result).length < JSON.stringify(screen).length * .65);
  assert.equal(screen.nodes[0].label, '内容0');
});
test('usage totals and ranking use real provider counters and keep unknown cache rates unknown', async () => {
  const { usageSample, rankUsage } = await import('../src/agent/usage.mjs');
  const rows = [usageSample({ prompt_tokens: 5000, completion_tokens: 200, prompt_cache_hit_tokens: 4000, prompt_cache_miss_tokens: 1000 }, { category: 'phone', elapsedMs: 100 }),
    usageSample({ prompt_tokens: 100, completion_tokens: 20 }, { category: 'reminder' }), usageSample(null, { category: 'assessment' })];
  const ranked = rankUsage(rows); assert.equal(ranked[0].name, 'phone'); assert.equal(ranked[0].cacheHitRate, .8);
  assert.equal(ranked[1].cacheHitRate, null); assert.equal(ranked[2].measured, 0);
  assert.equal(JSON.stringify(rows).includes('apiKey'), false);
});
test('streaming usage-only frames without choices are observed and never become answer text', async () => {
  const { createDeepseekClient } = await import('../src/integrations/deepseekClient.mjs');
  let body; const samples = [];
  const client = createDeepseekClient({ config: { deepseekKey: 'sk-isolated-fixture' }, onUsage: row => samples.push(row), fetchImpl: async (_url, init) => {
    body = JSON.parse(init.body);
    return new Response(['data: ' + JSON.stringify({ choices: [{ delta: { content: '已完成。' }, finish_reason: 'stop' }] }),
      'data: ' + JSON.stringify({ choices: [], usage: { prompt_tokens: 1000, completion_tokens: 10, prompt_cache_hit_tokens: 800, prompt_cache_miss_tokens: 200 } }), 'data: [DONE]'].join('\n\n'));
  } });
  assert.equal(await client.generate([{ role: 'user', content: '测试' }], { stream: true, usageCategory: 'phone' }), '已完成。');
  assert.equal(body.stream_options.include_usage, true); assert.equal(samples.length, 1); assert.equal(samples[0].cacheHitTokens, 800); assert.equal(samples[0].category, 'phone');
});
test('saved workflow steps take literal model parameters and never execute arbitrary code or frozen user content', async () => {
  const { createWorkflowStore } = await import('../src/device/workflows.mjs'); const disk = new Map();
  const store = createWorkflowStore({ getItem: async k => disk.get(k), setItem: async (k, v) => disk.set(k, v), removeItem: async k => disk.delete(k) });
  const flow = { id: 'model-chosen-flow', name: '已核实流程', description: '常用输入操作', verifiedOutcome: '测试界面实际显示输入文字', parameters: ['body'], steps: [{ type: 'ui', packageName: 'org.example.app', selector: { resourceId: 'org.example.app:id/input' }, action: 'set_text', text: '{{body}}' }] };
  await store.save(flow, verifiedEvidence()); assert.equal((await store.list())[0].steps, undefined); assert.equal((await store.list())[0].stepCount, 1);
  const text = 'literal $() `x` \\n "hello"'; const resolved = await store.get(flow.id, { body: text }); assert.equal(resolved.steps[0].text, text);
  await assert.rejects(store.get(flow.id, {}), /参数/); await assert.rejects(store.save({ ...flow, steps: [{ type: 'shell', packageName: 'x' }] }), /步骤/);
  await store.clear(); assert.deepEqual(await store.list(), []);
});
test('concurrent workflow saves preserve both entries instead of losing one', async () => {
  const { createWorkflowStore } = await import('../src/device/workflows.mjs'); let raw;
  const store = createWorkflowStore({ getItem: async () => raw, setItem: async (_k, v) => { raw = v; }, removeItem: async () => { raw = undefined; } });
  const item = { name: '流程', description: '描述', verifiedOutcome: '已核实', steps: [{ type: 'open', packageName: 'org.example.app' }] };
  await Promise.all([store.save({ ...item, id: 'one' }, verifiedEvidence()), store.save({ ...item, id: 'two' }, verifiedEvidence())]); assert.equal((await store.list()).length, 2);
});
test('reminder tools preserve model date, recurrence and content without keyword parsing or permission changes', async () => {
  const { executeReminderTool } = require('../src/reminders/agentRuntime.ts'); const calls = [];
  const transport = { list: async () => ({ ok: true, reminders: [] }), write: async (request, args) => { calls.push({ request, args }); return { ok: true, id: 'real-id' }; }, cancel: async id => ({ ok: true, id }) };
  const args = { title: '开始学英语', at: '2026-10-18T11:30:00+08:00', timeZone: 'Asia/Shanghai', repeatDays: [1, 3, 5], operationKey: 'remind-one' };
  assert.equal((await executeReminderTool('write_reminder', args, transport, 'request')).id, 'real-id'); assert.deepEqual(calls[0], { request: 'request', args });
  const aborted = new AbortController(); aborted.abort(); await assert.rejects(executeReminderTool('write_reminder', args, transport, 'request', aborted.signal), /取消/); assert.equal(calls.length, 1);
});
test('workflow evidence binds successful native operations and versions, not model success prose', async () => {
  const { workflowEvidence, workflowVersionIssue } = await import('../src/device/workflowEvidence.mjs');
  const input = { evidenceOperationKeys: ['send'], steps: [{ type: 'ui', packageName: 'org.example.app' }] };
  const receipt = { requestId: 'r', executionId: 'attempt-1', operationKey: 'send', commandHash: 'actual-command-hash', result: { ok: true },
    observation: { ok: true, at: 100, snapshotId: 'screen', packageName: 'org.example.app', appVersion: { available: true, versionCode: '1', lastUpdateTime: 100 } } };
  assert.throws(() => workflowEvidence(input, [], 'r', 'attempt-1'), /回执/);
  assert.throws(() => workflowEvidence(input, [{ ...receipt, result: { ok: false } }], 'r', 'attempt-1'), /回执/);
  const evidence = workflowEvidence(input, [receipt], 'r', 'attempt-2');
  assert.equal(evidence.operations[0].executionId, 'attempt-1'); assert.equal(evidence.verificationExecutionId, 'attempt-2');
  assert.equal(workflowVersionIssue(evidence.appVersions['org.example.app'], receipt.observation.appVersion, 'org.example.app'), null);
  assert.equal(workflowVersionIssue(receipt.observation.appVersion, { available: true, versionCode: '2', lastUpdateTime: 200 }, 'org.example.app').code, 'workflow_app_changed');
  assert.equal(workflowVersionIssue(undefined, receipt.observation.appVersion, 'org.example.app').code, 'workflow_version_unknown');
});
test('legacy workflows require review and late or repeated runs cannot invalidate a newly verified revision', async () => {
  const { createWorkflowStore, workflowStorageKey } = await import('../src/device/workflows.mjs'); const disk = new Map();
  const store = createWorkflowStore({ getItem: async k => disk.get(k), setItem: async (k, v) => disk.set(k, v), removeItem: async k => disk.delete(k) });
  const flow = { id: 'f', name: '流程', description: '描述', verifiedOutcome: '真实结果', steps: [{ type: 'open', packageName: 'org.example.app' }] };
  disk.set(workflowStorageKey, JSON.stringify([flow])); assert.equal((await store.list())[0].status, 'needs_review');
  await assert.rejects(store.get('f'), /失效|证据/); await assert.rejects(store.save(flow), /回执|版本/);
  const first = await store.save(flow, verifiedEvidence());
  await store.recordRun('f', first.revision, 'r1', { ok: false, code: 'workflow_page_changed', elapsedMs: 100 });
  await store.recordRun('f', first.revision, 'r1', { ok: false, code: 'workflow_page_changed', elapsedMs: 100 });
  assert.equal((await store.list())[0].statistics.attempts, 1); assert.equal((await store.list())[0].status, 'needs_review');
  await store.remove('f'); const next = await store.save(flow, verifiedEvidence()); assert.notEqual(first.revision, next.revision);
  await store.recordRun('f', first.revision, 'late', { ok: false, code: 'workflow_app_changed' });
  assert.equal((await store.list())[0].status, 'ready'); assert.equal((await store.list())[0].statistics.attempts, 0);
});
test('whole-task usage joins semantic probes, agent requests and local execution without persisting private payloads', async () => {
  const { usageSample, taskEvent, toolSample, usageReport, pageUsageReport } = await import('../src/agent/usage.mjs');
  const context = { taskId: 'task', requestId: 'turn', source: 'voice', stage: 'agent', prompt: 'private prompt', parameters: { text: 'private message' } };
  const models = [usageSample({ prompt_tokens: 100, completion_tokens: 20 }, { ...context, stage: 'voice_turn_assessment', startedAt: 100, elapsedMs: 10 }),
    usageSample({ prompt_tokens: 200, completion_tokens: 30, prompt_cache_hit_tokens: 150, prompt_cache_miss_tokens: 50 }, { ...context, startedAt: 120, elapsedMs: 20 })];
  const events = [{ ...taskEvent('task_start', context), at: 90 },
    { ...toolSample('run_phone_workflow', { ok: true, cache: { hit: true, executed: true }, screen: { timings: { ocrMs: 50 } }, trace: [{ waitMs: 10, timings: { ocrMs: 50, actionMs: 5 } }], text: 'private message' }, context, 80), at: 180 },
    { ...taskEvent('task_end', context, 'completed'), at: 200 }];
  const report = usageReport(models, events), task = report.taskRanking[0];
  assert.equal(task.totalTokens, 350); assert.equal(task.assessmentRequests, 1); assert.equal(task.workflowHits, 1);
  assert.equal(task.ocrMs, 50); assert.equal(task.observedSpanMs, 110); assert.equal(task.cacheHitRate, .75);
  assert.equal(JSON.stringify({ models, events }).includes('private'), false);
  const page = pageUsageReport(report, { view: 'tasks', limit: 1 }); assert.equal(page.rows.length, 1); assert.equal(page.nextOffset, null);
});
test('a model-selected phone conclusion ends generation immediately with a short result and standby-after-playback intent', async () => {
  const { personalChat } = await import('../src/integrations/personalTools.mjs'); let count = 0, standby;
  const result = await personalChat({ messages: [{ role: 'user', content: '播放音乐' }], responseMode: 'voice', execute: async () => { throw Error('terminal tool must be handled by coordinator'); }, onTaskFinished: value => { standby = value; },
    client: { generate: async () => { count++; return { tool_calls: [{ id: 'end', function: { name: 'finish_phone_task', arguments: JSON.stringify({ outcome: 'completed', summary: '已播放。', standby: true }) } }] }; } },
  });
  assert.equal(result, '已播放。'); assert.equal(count, 1); assert.equal(standby, true);
});
test('a mixed tool batch cannot announce completion before the other results are available', async () => {
  const { personalChat } = await import('../src/integrations/personalTools.mjs'); let count = 0; const receipts = [];
  const result = await personalChat({ messages: [], execute: async () => ({ ok: false, code: 'actual_failure' }), onToolResult: row => receipts.push(row), client: { generate: async () => ++count === 1 ? { tool_calls: [
    { id: 'conclusion', function: { name: 'finish_phone_task', arguments: JSON.stringify({ outcome: 'completed', summary: '错误的提前完成', standby: true }) } },
    { id: 'operation', function: { name: 'open_app', arguments: '{}' } },
  ] } : { content: '应用未能打开。' } } });
  assert.equal(count, 2); assert.equal(receipts[0].result.finished, false); assert.equal(result, '应用未能打开。');
});
