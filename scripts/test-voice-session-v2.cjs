const test = require('node:test'), assert = require('node:assert/strict');
require('./lib/register-typescript.cjs')();
const { createVoiceEventOrder } = require('../src/voice/eventOrder.ts');

test('native restarts reset local sequence but retired service events and duplicate snapshots stay rejected', () => {
  const accept = createVoiceEventOrder();
  const event = (serviceEpoch, sequence) => ({ kind: 'status', phase: 'listening', serviceEpoch, sequence });
  assert.equal(accept(event('first', 50)), true);
  assert.equal(accept(event('first', 49)), false);
  assert.equal(accept(event('second', 1)), true);
  assert.equal(accept(event('first', 100)), false);
  assert.equal(accept(event('second', 1)), false);
  assert.equal(accept(event(undefined, 0)), false);
  assert.equal(accept(event('second', 2)), true);
});
test('connection hydration and verification notifications cannot cancel the first voice request', async () => {
  const r = await import('../src/integrations/connectionRuntime.mjs');
  const state = { model: 'deepseek-flash', deepseekKey: 'sk-1234567890' };
  let changes = 0; const stop = r.subscribeConnectionChanges(() => changes++);
  try {
    r.installConnection(state); assert.equal(changes, 0);
    r.setModelConnectionVerified(r.getConnection(), true); assert.equal(changes, 0);
    r.installConnection(state); assert.equal(changes, 0);
    r.installConnection({ ...state, model: 'another-supported-model' }); assert.equal(changes, 1);
  } finally { stop(); }
});
