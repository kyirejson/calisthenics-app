const test = require('node:test'), assert = require('node:assert/strict');
require('./lib/register-typescript.cjs')();
const { createAgentConversation, CONVERSATION_KEY } = require('../src/agent/conversation.ts');
function harness() {
  const data = new Map();
  const storage = { getItem: async key => data.get(key) || null, setItem: async (key, value) => data.set(key, value), removeItem: async key => data.delete(key) };
  return { data, storage, conversation: createAgentConversation(storage) };
}
const begin = (conversation, id, source = 'text', content = id) => conversation.begin({ requestId: id, source, user: { content }, controller: new AbortController() });
test('voice and text share complete, uncapped context and persistent streamed messages', async () => {
  const { conversation: c, storage } = harness();
  const a = await begin(c, 'text', 'text', '今日早餐两个鸡蛋'); c.delta(a, '已记'); assert.equal(c.getSnapshot().turns[1].content, '已记'); c.complete(a, '已记录早餐。');
  const b = await begin(c, 'voice', 'voice', '再加一杯牛奶'); assert.deepEqual(c.messages(b).map(m => m.content), ['今日早餐两个鸡蛋', '已记录早餐。', '再加一杯牛奶']);
  c.complete(b, '已添加牛奶。'); await c.flush();
  const restored = createAgentConversation(storage); await restored.load(); assert.equal(restored.getSnapshot().turns.length, 4);
  assert.equal(restored.getSnapshot().turns[2].source, 'voice');
});
test('an ordinary interruption cancels generation immediately and blocks late text and completion', async () => {
  const { conversation: c } = harness(); const a = await begin(c, 'old', 'voice'); c.delta(a, '旧的回答');
  c.interrupt('old'); assert.equal(a.controller.signal.aborted, true);
  const b = await begin(c, 'new', 'voice'); c.delta(a, '不应显示的旧流'); assert.equal(c.complete(a, '不应播报'), false);
  assert.equal(c.getSnapshot().turns[1].content, '旧的回答'); assert.equal(c.getSnapshot().turns[1].status, 'interrupted'); assert.equal(c.valid(b), true);
});
test('completed tools survive a cancellation race and are provided to the next model turn, not replayed', async () => {
  const { conversation: c } = harness(); const a = await begin(c, 'old', 'voice'); c.interrupt('old');
  c.receipt(a, { name: 'write_meal_records', args: { operationKey: 'meals_1' }, result: { ok: true, entryIds: ['saved'] } });
  const b = await begin(c, 'new'); assert.match(c.messages(b)[1].content, /工具执行回执/); assert.match(c.messages(b)[1].content, /saved/);
});
test('tool rounds replace intermediate text instead of appending it to a final answer', async () => {
  const { conversation: c } = harness(); const a = await begin(c, 'a'); c.delta(a, '先核实'); c.tool(a, { name: 'read_music_playback', args: {} }); c.round(a);
  c.delta(a, '已播放。'); assert.equal(c.getSnapshot().turns[1].content, '已播放。'); assert.deepEqual(c.getSnapshot().turns[1].toolsUsed, ['核实播放状态']);
});
test('only actual spoken progress is retained, and an interrupted answer is marked as not fully heard', async () => {
  const { conversation: c } = harness(); const a = await begin(c, 'a', 'voice'); c.complete(a, '第一句。第二句。');
  c.voice({ phase: 'speaking', requestId: 'a', spokenEnd: 4 }); c.interrupt('a');
  const b = await begin(c, 'b', 'voice'); assert.match(c.messages(b)[1].content, /已朗读内容：第一句。/); assert.match(c.messages(b)[1].content, /余下内容未向用户播报/);
});
test('clear context aborts all in-flight writes and prevents stale results from restoring cleared content', async () => {
  const { conversation: c, data, storage } = harness(); const a = await begin(c, 'a'); c.delta(a, '旧内容');
  await c.clear(); c.delta(a, '旧流'); c.receipt(a, { name: 'x', args: {}, result: { ok: true } }); assert.equal(c.complete(a, '旧回答'), false); await c.flush();
  assert.equal(data.has(CONVERSATION_KEY), false); assert.equal(c.getSnapshot().turns.length, 0);
  const restored = createAgentConversation(storage); await restored.load(); assert.equal(restored.getSnapshot().turns.length, 0);
});
test('duplicate headless delivery is idempotent; a failed retry reuses its user identity', async () => {
  const { conversation: c } = harness(); const a = await begin(c, 'a'); c.complete(a, '完成'); assert.equal(await begin(c, 'a'), null);
  const b = await begin(c, 'b'); c.fail(b, '网络错误'); const retry = await begin(c, 'b'); assert.ok(retry); assert.equal(c.getSnapshot().turns.filter(t => t.requestId === 'b').length, 2);
});
test('normal later turns do not mark a finished spoken answer as interrupted', async () => {
  const { conversation: c } = harness(); const a = await begin(c, 'a', 'voice'); c.complete(a, '已完成'); c.voice({ phase: 'listening', requestId: 'a', spokenEnd: 3 });
  await begin(c, 'b'); assert.equal(c.getSnapshot().turns[1].status, 'complete');
});
test('a clear operation wins a delayed storage load', async () => {
  let release; const c = createAgentConversation({ getItem: () => new Promise(resolve => { release = resolve; }), setItem: async () => {}, removeItem: async () => {} });
  const load = c.load(); await c.clear(); release(JSON.stringify({ version: 1, turns: [] })); await load; assert.equal(c.getSnapshot().turns.length, 0);
});
test('concise style is a prompt only, preserving all tools and unrestricted model rounds', async () => {
  const { personalChat, personalTools } = await import('../src/integrations/personalTools.mjs');
  let count = 0, prompt = '', options;
  const answer = await personalChat({ responseMode: 'voice', date: '2026-10-14', messages: [{ role: 'user', content: '请详细解释' }],
    client: { generate: async (history, value) => { prompt = history[0].content; options = value; return ++count <= 12 ? { role: 'assistant', tool_calls: [{ id: String(count), function: { name: 'read_memory', arguments: '{}' } }] } : { content: '必要的完整解释'.repeat(100) }; } },
    execute: async () => ({ ok: true }),
  });
  assert.equal(count, 13); assert.equal(answer, '必要的完整解释'.repeat(100)); assert.equal(options.tools, personalTools); assert.equal(options.maxTokens, undefined);
  assert.match(prompt, /简洁、干练、自然/); assert.match(prompt, /当前是语音对话/); assert.match(prompt, /保留必要信息/);
});
