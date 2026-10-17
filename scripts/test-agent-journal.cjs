const test = require('node:test'), assert = require('node:assert/strict');
require('./lib/register-typescript.cjs')();
function storage() {
  const disk = new Map();
  return { disk, getItem: async key => disk.get(key) ?? null, setItem: async (key, value) => disk.set(key, Buffer.from(value).toString('utf8')),
    removeItem: async key => disk.delete(key), getAllKeys: async () => [...disk.keys()] };
}
const clone = value => JSON.parse(JSON.stringify(value));
const call = (id, name, args = '{}') => ({ id, type: 'function', function: { name, arguments: args } });
async function setup() {
  const { createPromptJournal } = await import('../src/agent/promptJournal.mjs');
  const disk = storage(); return { disk, journal: createPromptJournal(disk), createPromptJournal };
}
async function run(journal, id, text, generate, options = {}) {
  const { personalChat } = await import('../src/integrations/personalTools.mjs');
  const bound = await journal.bind(id, { content: text, attachments: options.attachments }, options.responseMode || 'text');
  const answer = await personalChat({ journal: bound, modelId: 'fixture-model', requestId: id, memory: '已有个人记忆', date: '2026-10-17', time: '12:00',
    client: { generate }, execute: async () => ({ ok: true }), ...options });
  return { answer, bound };
}
test('the next turn preserves raw multi-tool batches, intermediate prose, reasoning, argument bytes and tool result bytes', async () => {
  const { journal } = await setup(), first = [], second = []; let round = 0;
  const raw = { role: 'assistant', content: '先核实实际状态。', reasoning_content: 'fixture continuation metadata', tool_calls: [call('a', 'read_memory', '{ "z": 1, "a": 2 }'), call('b', 'read_today_meals')] };
  await run(journal, 'one', '先检查', async messages => { first.push(clone(messages)); return round++ ? { role: 'assistant', content: '检查完成。' } : raw; });
  await run(journal, 'two', '接着做', async messages => { second.push(clone(messages)); return { role: 'assistant', content: '继续。' }; }, { responseMode: 'voice', time: '13:00' });
  const recorded = second[0].find(message => message.tool_calls?.[0]?.id === 'a');
  assert.deepEqual(recorded, raw); assert.equal(recorded.tool_calls.length, 2);
  assert.deepEqual(second[0].slice(0, first[1].length), first[1]);
  assert.equal(second[0][first[1].length].content, '检查完成。');
  assert.equal(second[0].filter(message => message.content?.includes('personal_memory_snapshot')).length, 1);
});
test('typed and spoken requests share exactly the same instructions and complete tool declarations', async () => {
  const { journal } = await setup(), requests = [];
  for (const [index, responseMode] of ['text', 'voice'].entries()) await run(journal, String(index), '同一助手', async (messages, options) => {
    requests.push({ root: messages[0], tools: options.tools, context: JSON.parse(messages.filter(m => m.role === 'system' && m.content.includes('current_request_context')).at(-1).content) }); return '我在。';
  }, { responseMode });
  assert.deepEqual(requests[0].root, requests[1].root); assert.deepEqual(requests[0].tools, requests[1].tools);
  assert.equal(requests[0].context.responseMode, 'text'); assert.equal(requests[1].context.responseMode, 'voice');
});
test('only changed memory adds a new snapshot, and a different model has an explicit new epoch', async () => {
  const { journal } = await setup();
  for (const [id, memory, modelId] of [['a', '记忆一', 'm1'], ['b', '记忆一', 'm1'], ['c', '记忆二', 'm2']]) await run(journal, id, id, async () => '回答', { memory, modelId });
  assert.equal(journal.events().filter(event => event.type === 'memory_snapshot').length, 2);
  assert.equal(journal.events().filter(event => event.type === 'root').length, 2);
  assert.equal(journal.events().filter(event => event.type === 'root').at(-1).data.reason, 'model_protocol_or_instructions_changed');
});
test('a large attachment uses a stable readable reference, including astral Unicode across native UTF-8 chunk boundaries', async () => {
  const { journal } = await setup(), text = '中'.repeat(128 * 1024 - 1) + '😀' + '文'.repeat(150000);
  let sent;
  const { bound } = await run(journal, 'file', '看资料', async messages => { sent = clone(messages); return '可读取。'; }, { attachments: [{ id: 'f', name: '资料.md', kind: 'md', size: text.length * 3, text }] });
  assert.ok(!JSON.stringify(sent).includes('中'.repeat(100)));
  const ref = journal.events().find(event => event.type === 'user_input').data.attachments[0];
  assert.equal((await bound.readArtifact({ artifactId: ref.artifactId, full: true })).text, text);
  assert.equal((await bound.readArtifact({ artifactId: ref.artifactId, offset: 128 * 1024 - 5, limit: 20 })).text, text.slice(128 * 1024 - 5, 128 * 1024 + 15));
});
test('long reference results can be read in full without truncating live operation evidence', async () => {
  const { journal } = await setup(), bound = await journal.bind('x', { content: '资料' });
  const markdown = '# 原文\n'.repeat(10000), screen = { ok: true, snapshotId: 'live', nodes: [{ nodeId: 'n', text: markdown, bounds: [1, 2, 3, 4] }] };
  const result = await bound.contentResult('read_knowledge_note', { ok: true, markdown, path: '真实路径' });
  assert.equal((await bound.readArtifact({ artifactId: result.artifacts[0].artifactId, full: true })).text, markdown);
  assert.equal(await bound.contentResult('read_phone_screen', screen), screen);
});
test('committed messages and UI are restored even when the old UI-only storage does not exist', async () => {
  const { journal, disk } = await setup(); await run(journal, 'persist', '你好', async () => '完整回答。');
  const { createAgentConversation } = require('../src/agent/conversation.ts'); const c = createAgentConversation(disk); await c.load();
  assert.equal(c.getSnapshot().turns[1].content, '完整回答。');
  assert.equal(await c.begin({ requestId: 'persist', user: { content: '你好' }, source: 'voice', controller: new AbortController() }), null);
});
test('old UI records migrate once and never overwrite the raw journal after restart', async () => {
  const { disk } = await setup(), { createAgentConversation, CONVERSATION_KEY } = require('../src/agent/conversation.ts');
  disk.disk.set(CONVERSATION_KEY, JSON.stringify({ version: 1, turns: [
    { id: 'old:user', requestId: 'old', role: 'user', source: 'text', content: '原问题', status: 'complete' },
    { id: 'old:assistant', requestId: 'old', role: 'assistant', source: 'text', content: '原回答', status: 'complete' },
  ] }));
  const c = createAgentConversation(disk); await c.load(); assert.equal(c.messages().filter(m => m.role === 'user').length, 1);
  assert.equal(disk.disk.has(CONVERSATION_KEY), false);
  const restored = createAgentConversation(disk); await restored.load(); assert.deepEqual(restored.messages(), c.messages());
});
test('a failed journal head commit prevents model dispatch and preserves the previous committed prefix', async () => {
  const { journal, disk, createPromptJournal } = await setup(); await run(journal, 'one', '已经完成', async () => '完成');
  const before = clone(journal.messages()), original = disk.setItem; disk.setItem = async (key, value) => { if (key === 'uncover.agent.journal.v2') throw Error('disk full'); return original(key, value); };
  await assert.rejects(run(journal, 'two', '不得执行', async () => { throw Error('must not reach model'); }), /disk full/);
  disk.setItem = original; const restored = createPromptJournal(disk); await restored.load(); assert.deepEqual(restored.messages(), before);
});
test('cancellation closes started and undispatched tool calls differently and does not replay side effects', async () => {
  const { journal } = await setup(), controller = new AbortController(); let executed = 0;
  await assert.rejects(run(journal, 'cancel', '操作', async () => ({ role: 'assistant', tool_calls: [call('started', 'write_meal_records'), call('not-started', 'open_app')] }), {
    signal: controller.signal, execute: async () => { executed++; controller.abort(); throw Error('cancelled'); },
  }), /cancelled/);
  const rows = journal.messages().filter(message => message.role === 'tool');
  assert.equal(JSON.parse(rows[0].content).code, 'tool_outcome_unknown'); assert.equal(JSON.parse(rows[1].content).code, 'tool_not_started'); assert.equal(executed, 1);
  await run(journal, 'new', '刚才怎么样', async messages => { assert.ok(messages.some(message => message.tool_call_id === 'started')); return '需要核对。'; });
  assert.equal(executed, 1);
});
test('an actual late native receipt wins cancellation without pretending a failed effect', async () => {
  const { journal } = await setup(), controller = new AbortController();
  await assert.rejects(run(journal, 'receipt', '发消息', async () => ({ tool_calls: [call('send', 'phone_ui_action')] }), {
    signal: controller.signal, execute: async (name, args, _signal, interrupted) => { controller.abort(); await interrupted({ name, args, result: { ok: true, operationKey: 'actual-send', status: 'sent' } }); throw Error('cancelled'); },
  }));
  const result = journal.messages().find(message => message.tool_call_id === 'send'); assert.equal(JSON.parse(result.content).status, 'sent');
});
test('the next execution waits for the previous tool chain to close before admitting its user message', async () => {
  const { journal } = await setup(); let release, rounds = 0;
  const old = run(journal, 'old', '旧任务', async () => rounds++ ? '旧任务完成' : { tool_calls: [call('slow', 'read_memory')] }, { execute: () => new Promise(resolve => { release = resolve; }) });
  while (!release) await new Promise(resolve => setImmediate(resolve));
  let reached = false; const next = run(journal, 'next', '新任务', async () => { reached = true; return '新回答'; });
  await new Promise(resolve => setImmediate(resolve)); assert.equal(reached, false); release({ ok: true }); await Promise.all([old, next]);
  const messages = journal.messages(), resultIndex = messages.findIndex(message => message.tool_call_id === 'slow'), userIndex = messages.findIndex(message => message.content === '新任务'); assert.ok(resultIndex < userIndex);
});
test('clearing context invalidates old writers and removes only journal-owned content, preserving business data', async () => {
  const { journal, disk } = await setup(); disk.disk.set('running.records', 'keep');
  const { bound } = await run(journal, 'clear', '私密内容', async () => '回答', { attachments: [{ id: 'f', name: 'a.txt', kind: 'txt', size: 6, text: '私密附件' }] });
  await journal.clear(); await assert.rejects(bound.finish('迟到回答'), /清空/);
  assert.equal([...disk.disk.keys()].some(key => key.startsWith('uncover.agent.journal.v2')), false); assert.equal(disk.disk.get('running.records'), 'keep');
});
test('playback failure is a separate append-only fact and never changes the assistant answer', async () => {
  const { journal } = await setup(); await run(journal, 'spoken', '解释', async () => '第一句。第二句。');
  const before = clone(journal.messages()); await journal.delivery('spoken', { status: 'playback_failed', spokenEnd: 4, playbackError: '输出失败' });
  await run(journal, 'again', '没听清', async messages => { assert.deepEqual(messages.slice(0, before.length), before); assert.match(JSON.stringify(messages.slice(before.length)), /playback_failed/); return '重新解释。'; });
});
test('an explicit checkpoint retains the entire current tool chain and makes every archived message readable', async () => {
  const { journal } = await setup(); await run(journal, 'old', '过去的问题', async () => '过去的回答');
  let round = 0, seen;
  const { bound } = await run(journal, 'current', '当前问题', async messages => { seen = clone(messages); return round++ ? '继续当前任务。' : { tool_calls: [call('compact', 'compact_agent_context', '{"summary":"过去已回答，当前任务尚未完成。"}')] }; });
  assert.equal(seen[1].role, 'system'); assert.match(seen[1].content, /conversation_checkpoint/); assert.ok(seen.some(message => message.content === '当前问题'));
  assert.ok(seen.some(message => message.tool_call_id === 'compact'));
  const archiveId = journal.events().find(event => event.type === 'checkpoint').data.archiveId;
  assert.ok(JSON.stringify(bound.readArchive({ archiveId, full: true })).includes('过去的回答'));
});
test('transport preserves streamed reasoning and carries stable anonymous identity without exposing it as prompt text', async () => {
  const { createDeepseekClient } = await import('../src/integrations/deepseekClient.mjs'); let sent;
  const client = createDeepseekClient({ config: { deepseekKey: 'sk-fixture-key-123' }, fetchImpl: async (_url, init) => {
    sent = JSON.parse(init.body); return new Response([
      { choices: [{ delta: { reasoning_content: 'fixture ' } }] }, { choices: [{ delta: { reasoning_content: 'state' } }] },
      { choices: [{ delta: { content: '回答' }, finish_reason: 'stop' }] },
    ].map(chunk => 'data: ' + JSON.stringify(chunk)).join('\n\n')); } });
  const result = await client.generate([{ role: 'user', content: '问题' }], { tools: [], stream: true, requestMetadata: { userId: 'anonymous-fixture' } });
  assert.equal(result.reasoning_content, 'fixture state'); assert.equal(sent.user_id, 'anonymous-fixture'); assert.ok(!JSON.stringify(sent.messages).includes('anonymous-fixture'));
});
test('shape diagnostics distinguish appended history from schema and history changes without storing request text', async () => {
  const { createRequestShapeTracker } = await import('../src/agent/requestShape.mjs'), track = createRequestShapeTracker();
  const a = { role: 'user', content: 'PRIVATE_SECRET_TEXT' }, meta = { sessionId: 's', modelId: 'm', prefixEpoch: 'e' };
  assert.equal(track([a], [], meta).prefixRelation, 'first'); assert.equal(track([a, { role: 'assistant', content: '好' }], [], meta).prefixRelation, 'append_only');
  assert.equal(track([{ ...a, content: '变化' }], [], meta).prefixRelation, 'history_changed');
  assert.equal(track([a], [{ function: { name: 'new' } }], meta).prefixRelation, 'envelope_changed'); assert.ok(!JSON.stringify(track([a], [], meta)).includes('PRIVATE'));
});
test('capacity compaction uses real provider usage, skips ordinary turns, and keeps the current task and readable archive', async () => {
  const { journal } = await setup(), lanes = [];
  const client = { contextWindowTokens: 10000, generate: async (messages, options) => {
    lanes.push(options.requestMetadata?.lane);
    if (options.requestMetadata?.lane === 'checkpoint') return '此前用户询问训练，已经回答。没有待重做操作。';
    await options.onRequestUsage?.({ prompt_tokens: 8000, completion_tokens: 12 });
    return '已回答。';
  } };
  await run(journal, 'old', '之前的训练问题', client.generate, { client });
  assert.deepEqual(lanes, ['agent']);
  await run(journal, 'now', '现在的问题', client.generate, { client });
  assert.deepEqual(lanes, ['agent', 'checkpoint', 'agent']);
  assert.equal(journal.events().filter(event => event.type === 'checkpoint').length, 1);
  assert.ok(journal.messages().some(message => message.content === '现在的问题'));
  assert.ok(!journal.messages().some(message => message.content === '之前的训练问题'));
});
test('an actual context overflow gets one archive-based repair, never a repeated phone effect', async () => {
  const { journal } = await setup(); await run(journal, 'old', '已完成的旧任务', async () => '旧回答');
  let attempts = 0, summaries = 0, effects = 0;
  const client = { contextWindowTokens: 10000, generate: async (_messages, options) => {
    if (options.requestMetadata.lane === 'checkpoint') { summaries++; return '旧任务已经完成，当前新请求待处理。'; }
    if (attempts++ === 0) { const error = Error('context'); error.code = 'context_window_exceeded'; throw error; }
    return '新回答。';
  } };
  await run(journal, 'new', '新请求', client.generate, { client, execute: async () => { effects++; return { ok: true }; } });
  assert.equal(attempts, 2); assert.equal(summaries, 1); assert.equal(effects, 0);
});
test('failed or cancelled summarization keeps the original history and creates no incomplete checkpoint', async () => {
  const { journal } = await setup(); await run(journal, 'old', '完整旧记录', async () => '完整旧回答');
  const bound = await journal.bind('new', { content: '新问题' }); await bound.acquire();
  await bound.prepare({ system: 'fixture', tools: [], modelId: 'fixture-model', memory: '', context: {} });
  const before = clone(journal.messages());
  await assert.rejects(bound.autoCheckpoint({ contextWindowTokens: 10000, generate: async () => { throw Error('summary failed'); } }, { force: true }), /summary failed/);
  assert.deepEqual(journal.messages(), before); assert.equal(journal.events().some(event => event.type === 'checkpoint'), false); await bound.close();
});
test('unknown model IDs remain usable without guessing their capacity or automatically truncating history', async () => {
  const { deepseekContextCapacity } = await import('../src/agent/modelCapacity.mjs'); assert.equal(deepseekContextCapacity('future-model'), null);
  const { journal } = await setup(); await run(journal, 'a', '普通问题', async () => '正常回答');
  const bound = await journal.bind('b', { content: '继续' });
  assert.equal(await bound.autoCheckpoint({ generate: async () => { throw Error('must not call a guessed-capacity summarizer'); } }, { force: true }), null);
});
test('premature or malformed streams retain partial output instead of declaring a complete answer', async () => {
  const { createDeepseekClient } = await import('../src/integrations/deepseekClient.mjs');
  for (const tail of ['', '\ndata: {broken-json}']) {
    const partials = [], client = createDeepseekClient({ config: { deepseekKey: 'sk-fixture-key-123' }, fetchImpl: async () => new Response('data: ' + JSON.stringify({ choices: [{ delta: { content: '尚未说完' } }] }) + tail) });
    await assert.rejects(client.generate([], { stream: true, onPartial: async partial => partials.push(partial) }), /提前结束|损坏/);
    assert.equal(partials.length, 1); assert.equal(partials[0].content, '尚未说完');
  }
});
test('HTTP payload size errors are not falsely reported as a model token-context limit', async () => {
  const { createDeepseekClient } = await import('../src/integrations/deepseekClient.mjs');
  for (const [status, code, expected] of [[413, 'body_too_large', 'request_body_too_large'], [400, 'context_length_exceeded', 'context_window_exceeded']]) {
    const client = createDeepseekClient({ config: { deepseekKey: 'sk-fixture-key-123' }, fetchImpl: async () => Response.json({ error: { code } }, { status }) });
    await assert.rejects(client.generate([]), error => error.code === expected);
  }
});
test('frequent audible progress changes UI only and does not rewrite or append model messages', async () => {
  const { disk } = await setup(), { createAgentConversation } = require('../src/agent/conversation.ts'), c = createAgentConversation(disk);
  const handle = await c.begin({ requestId: 'progress', source: 'voice', user: { content: '回答' }, controller: new AbortController() });
  c.complete(handle, '完整的回答内容。'); await c.flush(); const before = clone(c.messages()), count = JSON.parse(disk.disk.get('uncover.agent.journal.v2')).count;
  for (let i = 0; i < 100; i++) c.voice({ phase: 'speaking', output: 'playing', requestId: 'progress', spokenEnd: Math.min(i, 8) });
  await c.flush(); assert.deepEqual(c.messages(), before); assert.equal(JSON.parse(disk.disk.get('uncover.agent.journal.v2')).count, count);
});
test('duplicate tool IDs are rejected before any member of the invalid batch is executed', async () => {
  const { journal } = await setup(); let effects = 0;
  await assert.rejects(run(journal, 'duplicate', '任务', async () => ({ tool_calls: [call('same', 'read_memory'), call('same', 'open_app')] }), { execute: async () => { effects++; } }), /重复或缺失/);
  assert.equal(effects, 0);
});
test('clear wins a delayed commit and invalidated work cannot bring private records back', async () => {
  const { journal, disk } = await setup(); const bound = await journal.bind('old', { content: '清空前私密文字' });
  let release; const original = disk.setItem;
  disk.setItem = async (key, value) => {
    if (key === 'uncover.agent.journal.v2') await new Promise(resolve => { release = resolve; });
    return original(key, value);
  };
  const late = bound.finish('迟到结果'); while (!release) await new Promise(resolve => setImmediate(resolve));
  const clear = journal.clear(); release(); await assert.rejects(late, /清空/); await clear;
  assert.equal([...disk.disk.keys()].some(key => key.startsWith('uncover.agent.journal.v2')), false);
});
test('cache alias accounting is consistent and detailed diagnostics are available without private text', async () => {
  const { usageSample, usageReport, pageUsageReport } = await import('../src/agent/usage.mjs');
  const value = usageSample({ prompt_tokens: 1000, completion_tokens: 20, prompt_tokens_details: { cached_tokens: 700 } }, {
    modelId: 'm', prefixEpoch: 'e', toolsDigest: 'abc', prefixRelation: 'history_changed', firstChangedMessage: 2, prompt: 'PRIVATE', userId: 'PRIVATE', stage: 'agent' });
  assert.equal(value.cacheReported, true); assert.equal(value.cacheMissTokens, 300);
  assert.equal(usageSample({ prompt_tokens: 100, prompt_cache_hit_tokens: 80, prompt_cache_miss_tokens: 50 }).cacheReported, false);
  const result = pageUsageReport(usageReport([value], []), { view: 'requests' }); assert.equal(result.rows[0].firstChangedMessage, 2); assert.equal(JSON.stringify(result).includes('PRIVATE'), false);
});

test('a late native outcome is durable immediately but reaches the model only after the current tool batch closes', async () => {
  const { journal, disk, createPromptJournal } = await setup();
  const old = await journal.bind('old', { content: '之前的发送' }); await old.acquire();
  await old.prepare({ system: 'fixture', tools: [], modelId: 'm', memory: '', context: {} });
  await old.model({ tool_calls: [call('send', 'phone_ui_action')] }); await old.started('send'); await old.close();
  const current = await journal.bind('new', { content: '现在的任务' }); await current.acquire();
  await current.prepare({ system: 'fixture', tools: [], modelId: 'm', memory: '', context: {} });
  await current.model({ tool_calls: [call('a', 'read_memory'), call('b', 'read_today_meals')] });
  const before = clone(journal.messages());
  await old.receipt({ id: 'send', name: 'phone_ui_action', args: {}, result: { ok: true, status: 'sent' } });
  await current.beforeRequest(); assert.deepEqual(journal.messages(), before);
  const restored = createPromptJournal(disk); await restored.load();
  const oldTurn = restored.uiTurns().find(turn => turn.id === 'old:assistant');
  assert.equal(oldTurn.receipts.length, 1); assert.equal(oldTurn.receipts[0].result.status, 'sent');
  assert.equal(restored.assessmentMessages().filter(message => message.content.includes('tool_outcome') && message.content.includes('phone_ui_action') && message.content.includes('"ok":true')).length, 1);
  await current.result('a', { ok: true }); await current.result('b', { ok: true }); await current.beforeRequest();
  const messages = journal.messages(), factIndex = messages.findIndex(message => message.content?.includes('execution_reconciliation'));
  assert.ok(factIndex > messages.findIndex(message => message.tool_call_id === 'b'));
  assert.equal(JSON.parse(messages.find(message => message.tool_call_id === 'send').content).code, 'tool_outcome_unknown');
  const after = clone(messages); await current.beforeRequest(); assert.deepEqual(journal.messages(), after); await current.close();
});

test('clearing a queued turn cannot strand the execution lease of the new conversation', { timeout: 2000 }, async () => {
  const { journal } = await setup(), owner = await journal.bind('owner', { content: '旧任务' }); await owner.acquire();
  const waiting = await journal.bind('waiting', { content: '待执行任务' });
  const invalidated = assert.rejects(waiting.acquire(), /清空/);
  await journal.clear();
  const next = await journal.bind('next', { content: '清空后的新任务' }); const acquiring = next.acquire();
  await owner.close(); await invalidated; await acquiring; await next.close();
  assert.equal(journal.events().filter(event => event.type === 'user_input').length, 1);
});

test('private file bodies avoid the shared native metadata quota and remain readable after restart', async () => {
  const { createFileJournalStorage } = await import('../src/agent/journalPersistence.mjs');
  const { createPromptJournal } = await import('../src/agent/promptJournal.mjs');
  const metadata = storage(), bodies = new Map();
  const limited = { ...metadata, setItem: async (key, value) => {
    if (value.length > 4096) throw Error('metadata must stay small'); return metadata.setItem(key, value);
  } };
  const files = { read: async key => bodies.get(key) ?? null, write: async (key, value) => bodies.set(key, value),
    remove: async key => bodies.delete(key), keys: async () => [...bodies.keys()] };
  const persistence = createFileJournalStorage(limited, files), journal = createPromptJournal(persistence);
  const text = '资料😀'.repeat(700000), bound = await journal.bind('large', { content: '保留全文', attachments: [{ name: 'large.md', kind: 'md', text }] });
  await bound.acquire(); await bound.prepare({ system: 'fixture', tools: [], memory: '', context: {} }); await bound.model('完整回复'); await bound.finish('完整回复'); await bound.close();
  assert.ok([...bodies.values()].reduce((bytes, value) => bytes + Buffer.byteLength(value), 0) > 6 * 1024 * 1024);
  assert.equal([...metadata.disk.keys()].some(key => key.startsWith('uncover.agent.journal.v2:')), false);
  const restored = createPromptJournal(persistence); await restored.load();
  const ref = restored.uiTurns()[0].attachments[0], reader = await restored.bind('read', { content: '读取原文' });
  assert.equal((await reader.readArtifact({ artifactId: ref.artifactId, full: true })).text, text);
  metadata.disk.set('running.records', 'keep'); await restored.clear(); assert.equal(bodies.size, 0); assert.equal(metadata.disk.get('running.records'), 'keep');
});

test('an interrupted clear removes the commit pointer before bodies, so deleted content is not replayed', async () => {
  const { journal, disk, createPromptJournal } = await setup(); await run(journal, 'private', '要清空的内容', async () => '回答');
  const remove = disk.removeItem; let failed = false;
  disk.removeItem = async key => { if (key !== 'uncover.agent.journal.v2' && !failed) { failed = true; throw Error('interrupted deletion'); } return remove(key); };
  await assert.rejects(journal.clear(), /interrupted deletion/);
  const restored = createPromptJournal(disk); await restored.load(); assert.equal(restored.messages().length, 0);
  disk.removeItem = remove; await restored.clear(); assert.equal([...disk.disk.keys()].some(key => key.startsWith('uncover.agent.journal.v2')), false);
});

test('missing IndexedDB reports a real storage error rather than silently reverting to quota-limited history', async () => {
  const { createIndexedJournalStorage } = await import('../src/agent/journalPersistence.mjs');
  const metadata = storage(), persistence = createIndexedJournalStorage(metadata, null);
  metadata.disk.set('legacy', 'old history'); assert.equal(await persistence.getItem('legacy'), 'old history');
  await assert.rejects(persistence.getItem('uncover.agent.journal.v2'), /IndexedDB/);
});

test('stream diagnostics distinguish first reasoning, first tool and first visible text without inventing missing timing', async () => {
  const { createDeepseekClient } = await import('../src/integrations/deepseekClient.mjs'); let sample;
  const client = createDeepseekClient({ config: { deepseekKey: 'sk-fixture-key-123' }, onUsage: value => { sample = value; }, fetchImpl: async () => new Response(new ReadableStream({
    async start(controller) {
      const send = chunk => controller.enqueue(new TextEncoder().encode('data: ' + JSON.stringify(chunk) + '\n\n'));
      send({ choices: [{ delta: { reasoning_content: 'fixture reasoning' } }] });
      await new Promise(resolve => setTimeout(resolve, 5));
      send({ choices: [{ delta: { tool_calls: [{ index: 0, ...call('a', 'read_memory') }] } }] });
      await new Promise(resolve => setTimeout(resolve, 5));
      send({ choices: [{ delta: { content: '检查' }, finish_reason: 'tool_calls' }] }); controller.close();
    },
  })) });
  await client.generate([], { tools: [], stream: true });
  assert.ok(sample.firstTokenMs >= 0); assert.ok(sample.firstToolMs > sample.firstTokenMs); assert.ok(sample.firstVisibleMs > sample.firstToolMs);
  const { usageSample } = await import('../src/agent/usage.mjs'); assert.equal(usageSample(null).firstTokenMs, null);
});

test('the rhythm assessor sees a terminal tool summary once without fabricating a business-model reply', async () => {
  const { journal } = await setup();
  await run(journal, 'terminal', '播放音乐', async () => ({ tool_calls: [call('done', 'finish_phone_task', JSON.stringify({ outcome: 'blocked', summary: '音乐软件尚未登录。', standby: false }))] }));
  assert.equal(journal.assessmentMessages().filter(message => message.role === 'assistant' && message.content === '音乐软件尚未登录。').length, 1);
  assert.equal(journal.messages().some(message => message.role === 'assistant' && message.content === '音乐软件尚未登录。'), false);
  await run(journal, 'normal', '一般问答', async () => '普通回答。');
  assert.equal(journal.assessmentMessages().filter(message => message.role === 'assistant' && message.content === '普通回答。').length, 1);
});

test('clear invalidates a legacy import that already prepared its old user message', async () => {
  const { journal } = await setup(); await journal.load();
  const migrating = journal.migrate([
    { requestId: 'legacy', role: 'user', content: '旧私密问题', source: 'text' },
    { requestId: 'legacy', role: 'assistant', content: '旧回答', status: 'complete' },
  ]);
  await Promise.resolve(); const clearing = journal.clear();
  await Promise.all([clearing, assert.rejects(migrating, /清空/)]); assert.equal(journal.messages().length, 0);
});

test('a pending conversation begin cannot recreate history after clear during initial load', async () => {
  const { createAgentConversation, CONVERSATION_KEY } = require('../src/agent/conversation.ts'), disk = storage();
  const getItem = disk.getItem; let release;
  disk.getItem = key => key === CONVERSATION_KEY ? new Promise(resolve => { release = resolve; }) : getItem(key);
  const c = createAgentConversation(disk), beginning = c.begin({ requestId: 'old', source: 'text', user: { content: '清空前正在打开' }, controller: new AbortController() });
  while (!release) await new Promise(resolve => setImmediate(resolve));
  await c.clear(); release(null); assert.equal(await beginning, null); await c.flush(); assert.equal(c.getSnapshot().turns.length, 0);
});

test('concurrent text and voice admission leaves exactly one current controller and interrupts the earlier turn', async () => {
  const { createAgentConversation } = require('../src/agent/conversation.ts'), disk = storage(), c = createAgentConversation(disk);
  const one = new AbortController(), two = new AbortController();
  const [a, b] = await Promise.all([
    c.begin({ requestId: 'text', source: 'text', user: { content: '文字问题' }, controller: one }),
    c.begin({ requestId: 'voice', source: 'voice', user: { content: '语音问题' }, controller: two }),
  ]);
  assert.equal(one.signal.aborted, true); assert.equal(c.valid(a), false); assert.equal(c.valid(b), true); assert.equal(two.signal.aborted, false);
});
