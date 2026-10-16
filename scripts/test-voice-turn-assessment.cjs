const test = require('node:test'), assert = require('node:assert/strict');
require('./lib/register-typescript.cjs')();
const { createVoiceTurnAssessor } = require('../src/voice/turnAssessment.ts');
const { createAgentConversation } = require('../src/agent/conversation.ts');
function harness(generate) {
  const calls = [], decisions = []; let active = true, cancel;
  const conversation = createAgentConversation({ getItem: async () => null, setItem: async () => {}, removeItem: async () => {} });
  const assess = createVoiceTurnAssessor({ conversation, active: async () => active, decide: async (...args) => decisions.push(args),
    subscribeCancellation: (_id, callback) => { cancel = callback; return () => { cancel = undefined; }; },
    generate: async (...args) => { calls.push(args); return generate(...args); } });
  return { calls, decisions, conversation, assess, stop: () => { active = false; cancel?.(); } };
}
test('slow speech can wait then submit accumulated text without creating partial user turns or running tools', async () => {
  const h = harness(async messages => { const input = JSON.parse(messages.at(-1).content); return { action: input.text === '帮我播放' ? 'wait' : 'respond', reason: '根据累计语义判断' }; });
  await h.assess({ kind: 'decision', requestId: 'p1', sessionId: 's', text: '帮我播放', silenceMs: 900 });
  await h.assess({ kind: 'decision', requestId: 'p2', sessionId: 's', text: '帮我播放 我喜欢的歌曲', silenceMs: 1300 });
  assert.deepEqual(h.decisions.map(x => x[1]), ['wait', 'respond']); assert.equal(h.conversation.getSnapshot().turns.length, 0);
  assert.equal('ownerVerified' in JSON.parse(h.calls[1][0].at(-1).content), false);
});
test('ignoring an unrelated owner remark is a model decision, not a keyword filter', async () => {
  const h = harness(async () => ({ action: 'ignore', reason: '主人在回复旁人' }));
  await h.assess({ kind: 'decision', requestId: 'p', sessionId: 's', text: '帮我播放这个问题我还没问你', silenceMs: 900 });
  assert.equal(h.decisions[0][1], 'ignore'); assert.match(h.calls[0][0].at(-1).content, /帮我播放/);
});
test('new speech revokes an old model decision before it can authorize a turn', async () => {
  let release; const h = harness(() => new Promise(resolve => { release = resolve; }));
  const pending = h.assess({ kind: 'decision', requestId: 'old', sessionId: 's', text: '早餐加两个鸡蛋' });
  await new Promise(resolve => setImmediate(resolve)); h.stop(); release({ action: 'respond', reason: '已完成' }); await pending;
  assert.equal(h.decisions.length, 0);
});
test('a malformed or failed decision preserves input and never falls through into execution', async () => {
  for (const result of [null, {}, { action: 'respond' }, { action: 'execute', reason: '绕过协议' }]) {
    const h = harness(async () => result); await h.assess({ kind: 'decision', requestId: 'p', sessionId: 's', text: '未说完' });
    assert.equal(h.decisions[0][1], 'error'); assert.equal(h.conversation.getSnapshot().turns.length, 0);
  }
});
test('duplicate concurrent headless delivery evaluates only once', async () => {
  let release; const h = harness(() => new Promise(resolve => { release = resolve; }));
  const input = { kind: 'decision', requestId: 'same', sessionId: 's', text: 'MAX', wake: true };
  const a = h.assess(input), b = h.assess(input); await new Promise(resolve => setImmediate(resolve)); release({ action: 'respond', reason: '主人呼唤' }); await Promise.all([a, b]);
  assert.equal(h.calls.length, 1); assert.equal(h.decisions.length, 1);
});
test('playback failure is delivery metadata, never a user interruption or assistant narration', async () => {
  const h = harness(async () => ({}));
  const a = await h.conversation.begin({ requestId: 'a', source: 'voice', user: { content: '解释一下' }, controller: new AbortController() });
  h.conversation.complete(a, '已经完成的回答。'); h.conversation.deliveryError('a', '引擎连接断开');
  const messages = h.conversation.messages(), state = JSON.parse(messages.find(m => m.role === 'system').content);
  assert.equal(state.turns[0].status, 'complete'); assert.equal(state.turns[0].playbackError, '引擎连接断开');
  assert.equal(messages.find(m => m.role === 'assistant').content, '已经完成的回答。');
});

test('an end-conversation intent reaches the formal Agent instead of being discarded as no-response speech', async () => {
  const h = harness(async messages => {
    assert.match(messages[0].content, /结束本次语音交流.*respond/);
    assert.match(messages[0].content, /你自己不执行退出/);
    assert.equal(JSON.parse(messages.at(-1).content).text, '你先退下，待会儿再叫你');
    return { action: 'respond', reason: '这是完整的结束交互请求，交给 Agent 决定工具操作' };
  });
  await h.assess({ kind: 'decision', requestId: 'leave', sessionId: 's', text: '你先退下，待会儿再叫你' });
  assert.equal(h.decisions[0][1], 'respond'); assert.equal(h.conversation.getSnapshot().turns.length, 0);
});
