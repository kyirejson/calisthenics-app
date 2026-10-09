const { test } = require('node:test');
const assert = require('node:assert/strict');
const browserHarness = require('./lib/browser-running-harness.cjs');
const { MotionGate } = require('../src/running/motionGate.ts');
const model = require('../src/running/model.ts');

test('auto pause requires continuous stationary speed and fresh moving evidence to resume', () => {
  const gate = new MotionGate();
  for (let s = 0; s < 8; s++) assert.equal(gate.update(s * 1000, .2, 5, false), null);
  assert.equal(gate.update(8000, .2, 5, false), 'pause');
  for (let s = 9; s < 12; s++) assert.equal(gate.update(s * 1000, 2, 5, true), null);
  assert.equal(gate.update(12000, 2, 5, true), 'resume');
  for (const invalid of [null, undefined, NaN, -1, 13]) {
    const bad = new MotionGate(); for (let s = 0; s < 20; s++) assert.equal(bad.update(s * 1000, invalid, 5, false), null);
  }
  const weak = new MotionGate(); for (let s = 0; s < 20; s++) assert.equal(weak.update(s * 1000, 0, 44, false), null);
  const gap = new MotionGate(); for (let s = 0; s < 8; s++) assert.equal(gap.update(s * 1000, .2, 5, false), null);
  assert.equal(gap.update(20000, .2, 5, false), null);
});

test('browser auto pause keeps listening, checkpoints, excludes pause time and splits the route', async () => {
  const h = browserHarness(), r = h.recorder;
  await r.configure({ ...model.defaultRunOptions(), autoPause: true });
  await r.start('auto'); h.fix(0, 3); h.advance(3000); h.fix(10, 3);
  for (let i = 0; i <= 8; i++) { h.advance(1000); h.fix(10, 0); }
  const paused = await r.snapshot(0); assert.equal(paused.phase, 'paused'); assert.equal(paused.autoPaused, true);
  await r.stopPreview(); assert.equal(h.clears, 0, 'Automatic pause retains the active GPS subscription');
  h.advance(60000); assert.equal((await r.snapshot(0)).elapsedMs, paused.elapsedMs);
  for (let i = 0; i <= 3; i++) { h.advance(1000); h.fix(1000 + i * 3, 3); }
  assert.equal((await r.snapshot(0)).phase, 'running');
  h.advance(3000); h.fix(1019, 3); await r.finish();
  const finished = await r.snapshot(0), analysis = model.analyseRun(finished.samples);
  assert.ok(analysis.distanceM >= 19 && analysis.distanceM <= 21, 'No straight-line kilometre bridge during pause');
  assert.equal(finished.elapsedMs, paused.elapsedMs + 3000);
});

test('manual pause disables automatic recovery and browser recovery never silently resumes an old run', async () => {
  const h = browserHarness(), r = h.recorder;
  await r.configure({ ...model.defaultRunOptions(), autoPause: true }); await r.start('manual');
  for (let i = 0; i <= 8; i++) { h.advance(1000); h.fix(0, 0); }
  assert.equal((await r.snapshot(0)).autoPaused, true);
  await r.pause(); assert.equal((await r.snapshot(0)).autoPaused, false); assert.equal(h.clears, 1);
  h.advance(10000); h.fix(1000, 3); assert.equal((await r.snapshot(0)).phase, 'paused');
  await r.resume(); assert.equal((await r.snapshot(0)).phase, 'running');
  for (let i = 0; i <= 8; i++) { h.advance(1000); h.fix(1000, 0); }
  await r.snapshot(0); await Promise.resolve();
  const restored = browserHarness(h.disk.get('uncover.running.web-journal.v2'));
  const snapshot = await restored.recorder.snapshot(0); assert.equal(snapshot.phase, 'paused'); assert.equal(snapshot.autoPaused, false); assert.equal(snapshot.interrupted, true);
});

test('indoor distance and pace carry explicit step provenance, no fabricated GPS, manual override and partial recovery', () => {
  const snapshot = { ...model.emptyRun(), id: 'steps', startedAt: 1000000, completedAt: 1600000, phase: 'finished', mode: 'indoor', elapsedMs: 600000, options: { ...model.defaultRunOptions(), stepTracking: true, stepLengthM: 1 }, stepCount: 2000, stepDistanceM: 2000 };
  const session = model.toRunSession(snapshot); assert.equal(session.distanceKm, 2); assert.equal(session.distanceSource, 'steps'); assert.equal(model.runRecordMeasurement(session).pace, 300);
  assert.equal(session.runStepCount, 2000); assert.match(model.runRecordMeasurement(session).label, /估算距离/); assert.deepEqual(session.route, []); assert.deepEqual(session.runSplits, []);
  assert.equal(model.toRunSession({ ...snapshot, manualDistanceKm: 2.5 }).distanceSource, 'manual');
  assert.equal(model.runMeasurement({ ...snapshot, stepPartial: true }).averagePace, null);
  assert.equal(model.runMeasurement({ ...snapshot, options: { ...snapshot.options, stepTracking: false } }).distanceKm, undefined);
  assert.equal(model.runMeasurement({ ...snapshot, options: model.defaultRunOptions() }).distanceKm, undefined);
  for (const patch of [{ stepCount: -1 }, { stepCount: 1.5 }, { stepDistanceM: 999 }, { options: { ...snapshot.options, stepLengthM: 5 } }]) assert.equal(model.runMeasurement({ ...snapshot, ...patch }).distanceKm, undefined, 'Corrupt sensor metadata cannot invent distance');
});

test('running options persist, reject invalid calibration, unsupported browser steps and changes during running', async () => {
  const h = browserHarness(), r = h.recorder;
  await r.configure({ ...model.defaultRunOptions(), autoPause: true }); assert.equal((await r.snapshot(0)).options.autoPause, true);
  await assert.rejects(r.configure({ ...model.defaultRunOptions(), stepLengthM: .1 }), /0.3/);
  await assert.rejects(r.configure({ ...model.defaultRunOptions(), stepTracking: true }), /浏览器/);
  await r.start('lock'); await assert.rejects(r.configure(model.defaultRunOptions()), /先结束/);
  assert.equal((await r.snapshot(0)).options.autoPause, true);
  await r.clear(); assert.equal(h.disk.size, 0);
});
