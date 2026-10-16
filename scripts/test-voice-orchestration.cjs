const test = require('node:test'), assert = require('node:assert/strict');
require('./lib/register-typescript.cjs')();
const { voicePresentation } = require('../src/voice/presentation.ts');
const { createVoiceCancellationBus } = require('../src/voice/lifecycle.ts');
const { createVoiceEventOrder } = require('../src/voice/eventOrder.ts');
const { createAgentConversation } = require('../src/agent/conversation.ts');
const conversation = () => createAgentConversation({ getItem: async () => null, setItem: async () => {}, removeItem: async () => {} });

test('only audible playback is presented as speaking; preparation and buffering remain distinct', () => {
  for (const phase of ['starting', 'wake', 'listening', 'assessing', 'processing', 'synthesizing', 'buffering', 'blocked', 'stopped'])
    assert.equal(voicePresentation({ phase }).speaking, false, phase);
  assert.equal(voicePresentation({ phase: 'speaking', output: 'playing' }).speaking, true);
  assert.equal(voicePresentation({ phase: 'synthesizing' }).label, '正在准备语音');
  assert.equal(voicePresentation({ phase: 'buffering' }).label, '正在准备后续语音');
});
test('pending sound cannot create a second listening indicator while the assistant is playing', () => {
  const suspected = voicePresentation({ phase: 'speaking', input: 'candidate', output: 'playing', held: false });
  assert.equal(suspected.showTranscript, false); assert.equal(suspected.label, '正在回答');
  const confirmed = voicePresentation({ phase: 'listening', input: 'hearing', output: 'playing', held: true });
  assert.equal(confirmed.showTranscript, true); assert.equal(confirmed.speaking, false);
  assert.equal(confirmed.outputBusy, true); // A held reply can still be stopped by the user.
});
test('all snapshots, not just transcript events, clear ignored drafts and preserve waiting drafts', () => {
  const c = conversation();
  c.voice({ phase: 'listening', segmentId: 'draft', text: '我还想', held: true });
  c.voice({ phase: 'assessing', segmentId: 'draft', text: '我还想', held: true });
  assert.equal(c.getSnapshot().preview.text, '我还想');
  c.voice({ phase: 'listening', segmentId: 'draft', text: '我还想', held: true });
  assert.equal(c.getSnapshot().preview.text, '我还想');
  c.voice({ phase: 'speaking', segmentId: 'draft', text: '', held: false });
  assert.equal(c.getSnapshot().preview, null);
});
test('stop while preparing or reversibly held marks the right answer interrupted, not completed', async () => {
  for (const state of [{ phase: 'synthesizing', output: 'synthesizing' }, { phase: 'listening', output: 'playing', held: true }]) {
    const c = conversation();
    const handle = await c.begin({ requestId: 'answer', source: 'voice', user: { content: '问题' }, controller: new AbortController() });
    c.complete(handle, '完整文字保留。'); c.voice({ ...state, requestId: 'answer' }); c.interrupt();
    assert.equal(c.getSnapshot().turns[1].status, 'interrupted'); assert.equal(c.getSnapshot().turns[1].content, '完整文字保留。');
  }
});
test('native cancellation is scoped: old turns and revoked assessments never cancel a replacement', () => {
  const bus = createVoiceCancellationBus(), cancelled = [];
  bus.subscribe('old', 'turn', () => cancelled.push('old'));
  const stop = bus.subscribe('new', 'turn', () => cancelled.push('new'));
  bus.subscribe('probe', 'decision', () => cancelled.push('probe'));
  bus.publish({ kind: 'interrupt', phase: 'listening', sequence: 1, requestId: 'old' });
  bus.publish({ kind: 'decision_cancelled', phase: 'speaking', sequence: 2, requestId: 'new', decisionId: 'probe' });
  assert.deepEqual(cancelled, ['old', 'probe']);
  stop(); bus.publish({ kind: 'status', phase: 'stopped', sequence: 3 });
  assert.deepEqual(cancelled, ['old', 'probe']);
});
test('duplicate and retired native service events are rejected before cancellation is dispatched', () => {
  const accept = createVoiceEventOrder(), bus = createVoiceCancellationBus(); let cancelled = 0;
  bus.subscribe('new', 'turn', () => cancelled++);
  const receive = event => { if (accept(event)) bus.publish(event); };
  receive({ kind: 'status', phase: 'listening', serviceEpoch: 'old', sequence: 20 });
  receive({ kind: 'status', phase: 'listening', serviceEpoch: 'new', sequence: 1 });
  receive({ kind: 'status', phase: 'stopped', serviceEpoch: 'old', sequence: 21 });
  assert.equal(cancelled, 0);
  receive({ kind: 'interrupt', phase: 'listening', serviceEpoch: 'new', sequence: 2, requestId: 'new' });
  receive({ kind: 'interrupt', phase: 'listening', serviceEpoch: 'new', sequence: 2, requestId: 'new' });
  assert.equal(cancelled, 1);
});
