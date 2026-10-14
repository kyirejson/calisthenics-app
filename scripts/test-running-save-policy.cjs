const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
require('./lib/register-typescript.cjs')();
const { hasRecordedRunDistance } = require('../src/running/model.ts');
const { persistFinishedRun } = require('../src/running/saveRun.ts');
const finished = patch => ({ id: 'run-policy', phase: 'finished', mode: 'outdoor', startedAt: 1800000000000, completedAt: 1800000060000, elapsedMs: 60000, samples: [], sampleCount: 0, preview: null, error: '', ...patch });

test('save eligibility rejects missing/zero distance without imposing a minimum running length', () => {
  for (const km of [undefined, null, NaN, Infinity, -1, 0, 1001]) assert.equal(hasRecordedRunDistance(km), false);
  for (const km of [.001, 2.5, 1000]) assert.equal(hasRecordedRunDistance(km), true);
});
test('distance-free outdoor/indoor runs finish cleanly without adding any history', async () => {
  for (const snapshot of [finished({}), finished({ mode: 'indoor' }), finished({ mode: 'indoor', manualDistanceKm: 0 })]) {
    const events = [];
    const record = await persistFinishedRun(snapshot, async () => events.push('save'), async id => events.push('ack:' + id));
    assert.equal(record, null); assert.deepEqual(events, ['ack:run-policy']);
  }
});
test('positive entered distance is persisted before acknowledging and retains its stable ID', async () => {
  const events = [];
  const record = await persistFinishedRun(finished({ mode: 'indoor', manualDistanceKm: 2.5 }), async session => events.push(['save', session.id, session.distanceKm]), async id => events.push(['ack', id]));
  assert.equal(record.distanceSource, 'manual'); assert.deepEqual(events, [['save', 'run-policy', 2.5], ['ack', 'run-policy']]);
});
test('failed history writes retain the finished draft; acknowledgement failure can retry without saving zero-distance history', async () => {
  let acknowledgements = 0;
  await assert.rejects(persistFinishedRun(finished({ manualDistanceKm: 1 }), async () => { throw Error('disk full'); }, async () => { acknowledgements++; }), /disk full/);
  assert.equal(acknowledgements, 0);
  let historyWrites = 0;
  await assert.rejects(persistFinishedRun(finished({}), async () => { historyWrites++; }, async () => { throw Error('remove failed'); }), /remove failed/);
  await persistFinishedRun(finished({}), async () => { historyWrites++; }, async () => { acknowledgements++; });
  assert.equal(historyWrites, 0); assert.equal(acknowledgements, 1);
});
test('live workouts cannot be acknowledged and the obsolete timer-only statistics line is gone', async () => {
  let touched = false;
  await assert.rejects(persistFinishedRun(finished({ phase: 'running' }), async () => { touched = true; }, async () => { touched = true; }), /尚未结束/);
  assert.equal(touched, false);
  const card = fs.readFileSync(require.resolve('../src/running/RunningMileageCard.tsx'), 'utf8');
  assert.doesNotMatch(card, /unknownRuns|次仅计时未计里程/);
});
