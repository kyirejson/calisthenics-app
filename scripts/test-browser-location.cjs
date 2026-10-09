const { test } = require('node:test');
const assert = require('node:assert/strict');
const harness = require('./lib/browser-running-harness.cjs');
const { mapPosition, locationStatus } = require('../src/running/locationStatus.ts');
const { analyseRun } = require('../src/running/model.ts');

test('browser coarse/cached fixes preview the map even without a precise fix, never mileage', async () => {
  const h = harness(); await h.recorder.start('coarse');
  h.approximate(0, 44); h.advance(3000); h.approximate(10, 20);
  const snapshot = await h.recorder.snapshot(0);
  assert.ok(mapPosition(snapshot)); assert.equal(snapshot.preview, null);
  assert.match(locationStatus(snapshot).title, /地图已定位/);
  assert.match(locationStatus(snapshot).detail, /浏览器大致位置/);
  assert.equal(snapshot.samples.length, 0); assert.equal(analyseRun(snapshot.samples).distanceM, 0);
});
test('a precise timeout preserves a received map preview and reports the actual browser error', async () => {
  const h = harness(); await h.recorder.preview(); h.approximate(10, 80); h.failure(3, 'Timeout expired');
  const snapshot = await h.recorder.snapshot(0), status = locationStatus(snapshot);
  assert.ok(mapPosition(snapshot)); assert.match(status.title, /地图已定位/);
  assert.match(status.detail, /浏览器错误 3.*Timeout expired/);
  assert.doesNotMatch(status.detail, /未授权|35 米/);
});
test('both provider failures retain raw error codes and messages, and no invented coordinates', async () => {
  const h = harness(); await h.recorder.preview();
  h.approximateFailure(2, 'Network location provider unavailable'); h.failure(3, 'Timeout expired');
  const snapshot = await h.recorder.snapshot(0);
  assert.equal(mapPosition(snapshot), null);
  assert.match(snapshot.locationError, /浏览器错误 2.*Network location provider unavailable/);
  assert.match(snapshot.locationError, /浏览器错误 3.*Timeout expired/);
  h.deny(); assert.match((await h.recorder.snapshot(0)).locationError, /访问被拒绝.*浏览器错误 1/);
});
test('retry displays an identical timestamp again; duplicate fixes do not duplicate mileage', async () => {
  const h = harness(); await h.recorder.start('retry'); h.fix(0);
  await h.recorder.preview(); h.fix(0);
  assert.ok(mapPosition(await h.recorder.snapshot(0)));
  assert.equal((await h.recorder.snapshot(0)).samples.length, 1);
  h.advance(3000); h.fix(10); assert.ok(analyseRun((await h.recorder.snapshot(0)).samples).distanceM > 9);
});
test('old cached fixes remain map-only and late coarse callbacks cannot replace a precise position', async () => {
  const h = harness(); await h.recorder.start('fresh'); h.approximate(0, 70, 30000);
  let snapshot = await h.recorder.snapshot(0);
  assert.match(locationStatus(snapshot).title, /最近位置/); assert.equal(snapshot.samples.length, 0);
  h.fix(10, 3, 5); h.approximate(10000, 100); h.fix(20000, 3, 5, 30000);
  snapshot = await h.recorder.snapshot(0);
  assert.ok(mapPosition(snapshot).latitude < .001); assert.ok(snapshot.preview.latitude < .001);
  assert.equal(snapshot.samples.length, 1);
});
test('canceled one-shot callbacks cannot restore discarded coordinates or errors', async () => {
  const h = harness(); await h.recorder.preview(); await h.recorder.stopPreview();
  h.approximate(1000); h.approximateFailure(2, 'late failure'); h.fix(2000);
  const snapshot = await h.recorder.snapshot(0);
  assert.equal(mapPosition(snapshot), null); assert.equal(snapshot.locationError, '');
});
test('invalid and too-old browser positions are rejected with a reason, not silently ignored', async () => {
  const h = harness(); await h.recorder.preview(); h.fix(0, null, NaN);
  assert.match((await h.recorder.snapshot(0)).locationError, /无效/);
  h.approximate(0, 40, 120001); assert.equal(mapPosition(await h.recorder.snapshot(0)), null);
  assert.match((await h.recorder.snapshot(0)).locationError, /两分钟/);
});
