const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const browserHarness = require('./lib/browser-running-harness.cjs');
const ts = require('typescript');
require('./lib/register-typescript.cjs')({ compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, extensions: ['.ts'] });
const model = require('../src/running/model.ts'), geometry = require('../src/running/mapGeometry.ts');
const point = (metres = 0, seconds = 0, patch = {}) => ({ latitude: metres / 111195.08, longitude: 0, accuracy: 5, timestamp: 1760000000000 + seconds * 1000, elapsedMs: seconds * 1000, segment: 0, ...patch });
test('real running fixes accumulate metres, current pace and kilometre markers', () => {
  const analysis = model.analyseRun(Array.from({ length: 120 }, (_, i) => point(i * 10, i * 3)));
  assert.ok(Math.abs(analysis.distanceM - 1190) < 0.1); assert.ok(Math.abs(analysis.currentPace - 300) < 0.1);
  assert.equal(analysis.splits.length, 1); assert.equal(analysis.splits[0].km, 1);
});
test('weak, invalid, duplicate, reversed and impossible GPS points never fabricate mileage', () => {
  const points = [point(), point(10, 3), point(10, 3), point(30, 2), point(10000, 4), point(20, 6), point(2000, 8, { accuracy: 120 }), point(3000, 9, { latitude: NaN }), point(5000, 12), point(5010, 15)];
  const analysis = model.analyseRun(points); assert.ok(Math.abs(analysis.distanceM - 30) < 0.1); assert.equal(analysis.segments.length, 2);
});
test('pauses and GPS interruptions split routes without straight-line catch-up', () => {
  const analysis = model.analyseRun([point(), point(10, 3), point(1000, 4, { segment: 1 }), point(1010, 7, { segment: 1 }), point(5000, 60, { segment: 1 }), point(5010, 63, { segment: 1 })]);
  assert.equal(analysis.segments.length, 3); assert.ok(Math.abs(analysis.distanceM - 30) < 0.1);
});
test('stationary GPS jitter does not produce a route or pace', () => {
  const points = Array.from({ length: 100 }, (_, i) => point(Math.sin(i) * 2, i));
  assert.equal(model.analyseRun(points).distanceM, 0); assert.equal(model.analyseRun(points).currentPace, null);
});

test('Android mileage survives wall-clock changes and still rejects repeated monotonic fixes', () => {
  const first = point(0, 0, { monotonicNanos: 1000000000 });
  const next = point(10, 3, { timestamp: first.timestamp - 3600000, monotonicNanos: 4000000000 });
  const duplicate = point(20, 6, { monotonicNanos: 4000000000 });
  assert.ok(Math.abs(model.analyseRun([first, next, duplicate]).distanceM - 10) < .01);
});
test('GPS freshness and precision validate edge cases', () => {
  for (const invalid of [null, point(0, 0, { latitude: 91 }), point(0, 0, { longitude: Infinity }), point(0, 0, { accuracy: -1 }), point(0, 0, { accuracy: 36 })]) assert.equal(model.usablePoint(invalid), false);
  assert.equal(model.usablePoint(point()), true);
});
test('run session is stable, has independent segments and does not invent calories or strength sets', () => {
  const snapshot = { ...model.emptyRun(), id: 'run-test', phase: 'finished', startedAt: 1760000000000, completedAt: 1760000120000, elapsedMs: 60000, samples: [point(), point(10, 3), point(1000, 4, { segment: 1 }), point(1010, 7, { segment: 1 })] };
  const first = model.toRunSession(snapshot), retry = model.toRunSession(snapshot);
  assert.deepEqual(first, retry); assert.equal(first.durationSeconds, 60); assert.equal(first.runSegments.length, 2);
  assert.equal(first.calories, undefined); assert.equal(first.totalReps, 0); assert.deepEqual(first.exercises, []);
  assert.throws(() => model.toRunSession({ ...snapshot, phase: 'running' }));
});
test('unmeasured distance retains no invented average pace and long clocks retain hours', () => {
  assert.equal(model.paceLabel(null), '—'); assert.equal(model.paceLabel(Infinity), '—'); assert.equal(model.paceLabel(359.9), '6′00″');
  assert.equal(model.runClock(0), '00:00'); assert.equal(model.runClock(3661000), '01:01:01');
});
test('map projection round-trips, clips polar latitude and wraps antimeridian tiles', () => {
  for (const c of [{ latitude: 39.91, longitude: 116.4 }, { latitude: -45, longitude: -179.9 }]) {
    const p = geometry.project(c, 16), restored = geometry.unproject(p.x, p.y, 16);
    assert.ok(Math.abs(restored.latitude - c.latitude) < 1e-8); assert.ok(Math.abs(restored.longitude - c.longitude) < 1e-8);
  }
  assert.ok(Number.isFinite(geometry.project({ latitude: 90, longitude: 0 }, 18).y));
  const tiles = geometry.mapTiles({ latitude: 0, longitude: -179.9999 }, 3, 390, 400);
  assert.ok(tiles.length <= 12); for (const tile of tiles) assert.match(tile.uri, /^https:\/\/tile\.openstreetmap\.org\/3\/[0-7]\/[0-7]\.png$/);
});
test('browser pause excludes time and movement, resumes with a separate segment and retains stable save ID', async () => {
  const h = browserHarness(), r = h.recorder;
  await r.preview(); h.fix(0); await r.start('same-id'); h.advance(3000); h.fix(10); await r.pause();
  const atPause = await r.snapshot(0); h.advance(60000); assert.equal((await r.snapshot(0)).elapsedMs, atPause.elapsedMs);
  await r.resume(); h.advance(3000); h.fix(1000); h.advance(3000); h.fix(1010); await r.finish();
  const saved = await r.snapshot(0); assert.equal(saved.id, 'same-id'); assert.equal(saved.elapsedMs, 9000);
  assert.ok(Math.abs(model.analyseRun(saved.samples).distanceM - 20) < 0.1); await r.acknowledge('different-id'); assert.equal((await r.snapshot(0)).id, 'same-id');
  await r.acknowledge('same-id'); assert.equal((await r.snapshot(0)).phase, 'idle'); assert.equal(h.disk.size, 0);
});
test('browser reload restores only checkpoint time, in a pause rather than guessing elapsed downtime', async () => {
  const h = browserHarness(JSON.stringify({ ...model.emptyRun(), id: 'restore', startedAt: 1000, phase: 'running', elapsedMs: 15000, samples: [point()] }));
  const snapshot = await h.recorder.snapshot(0); assert.equal(snapshot.phase, 'paused'); assert.equal(snapshot.elapsedMs, 15000); assert.equal(snapshot.interrupted, true);
  h.advance(60000); assert.equal((await h.recorder.snapshot(0)).elapsedMs, 15000);
});
test('corrupt draft is not overwritten and storage errors are exposed instead of dropping records', async () => {
  const broken = browserHarness('not-json'); await broken.recorder.snapshot(0); assert.match((await broken.recorder.snapshot(0)).error, /原文件/); await assert.rejects(broken.recorder.start('replacement'));
  assert.equal(broken.disk.get('uncover.running.web-journal.v2'), 'not-json');
  await assert.rejects(broken.recorder.preview(), /原文件/); await assert.rejects(broken.recorder.start('still-blocked'));
  const fail = browserHarness(null, () => true); await fail.recorder.preview(); fail.fix(0); await assert.rejects(fail.recorder.start('write-fail'), /disk full/); assert.equal((await fail.recorder.snapshot(0)).phase, 'paused');
});
test('idle checkpoints preserve standing time across browser reload without new GPS fixes', async () => {
  const h = browserHarness(); await h.recorder.preview(); h.fix(0); await h.recorder.start('standing'); h.advance(12000); await h.recorder.snapshot(0);
  const restored = browserHarness(h.disk.get('uncover.running.web-journal.v2')); assert.equal((await restored.recorder.snapshot(0)).elapsedMs, 12000);
});
test('saved route fits in the map including crossing the antimeridian', () => {
  const segments = [[{ latitude: 39.91, longitude: 116.4 }, { latitude: 39.92, longitude: 116.41 }]];
  const fit = geometry.fitRoute(segments, 390, 260); assert.ok(fit.zoom < 18);
  for (const point of segments.flat()) { const p = geometry.screenPoint(point, fit.center, fit.zoom, 390, 260); assert.ok(p.x >= 30 && p.x <= 360); assert.ok(p.y >= 50 && p.y <= 210); }
  const wrapped = geometry.fitRoute([[{ latitude: 0, longitude: 179.999 }, { latitude: 0, longitude: -179.999 }]], 390, 260); assert.ok(wrapped.zoom >= 16);
});
test('Android protects location startup and supports a permission-free workout stopwatch FGS', () => {
  const root = '../modules/uncover-running/android/src/main/';
  const service = fs.readFileSync(require.resolve(root + 'java/uncover/running/RunningService.kt'), 'utf8'), listener = fs.readFileSync(require.resolve(root + 'java/uncover/running/GpsListener.kt'), 'utf8');
  assert.match(service, /FOREGROUND_SERVICE_TYPE_LOCATION/); assert.match(service, /START_NOT_STICKY/); assert.match(service, /catch \(_: Exception\)/);
  assert.match(service, /if \(Build.VERSION.SDK_INT >= 26\) \{\s*notificationManager.createNotificationChannel/, 'Android 7 does not have notification channel APIs');
  for (const method of ['onLocationChanged', 'onProviderDisabled', 'onProviderEnabled', 'onStatusChanged']) assert.match(listener, new RegExp('override fun ' + method));
  const manifest = fs.readFileSync(require.resolve(root + 'AndroidManifest.xml'), 'utf8'); assert.match(manifest, /android:foregroundServiceType="location\|specialUse"/); assert.match(manifest, /android:exported="false"/);
  const bridge = fs.readFileSync(require.resolve(root + 'java/uncover/running/UncoverRunningModule.kt'), 'utf8');
  assert.match(bridge.split('AsyncFunction("pause")')[1].split('AsyncFunction("resume")')[0], /\n\s+Unit/, 'startService ComponentName cannot be serialized as an action result');
  const screen = fs.readFileSync(require.resolve('../src/screens/RunScreen.tsx'), 'utf8'), today = fs.readFileSync(require.resolve('../src/screens/TodayScreen.tsx'), 'utf8');
  assert.match(screen, /KeyboardAvoidingView/); assert.match(screen, /keyboardShouldPersistTaps="always"/);
  assert.match(today, /keyboardShouldPersistTaps="handled"/, 'The ancestor pager cannot consume the first save tap to dismiss the keyboard');
  assert.match(manifest, /PROPERTY_SPECIAL_USE_FGS_SUBTYPE/); assert.match(service, /FOREGROUND_SERVICE_TYPE_SPECIAL_USE/);
  assert.ok(!/play.services|FusedLocationProvider/.test(service), 'System GPS works without Google Play services');
  const cache = fs.readFileSync(require.resolve(root + 'java/uncover/running/TileCache.kt'), 'utf8'), map = fs.readFileSync(require.resolve(root + 'java/uncover/running/MapTilesView.kt'), 'utf8');
  assert.match(cache, /setRequestProperty\("User-Agent", "Uncover\//); assert.match(cache, /If-None-Match/); assert.match(cache, /expiresAt/);
  assert.match(map, /SupervisorJob\(\) \+ Dispatchers.IO/, 'Map requests cannot block GPS snapshots'); assert.match(map, /canvas.drawBitmap/); assert.ok(!cache.includes('no-cache'));
});
test('unlocated runs save time without zero-distance fiction and partial routes have no average pace', () => {
  const blank = { ...model.emptyRun(), id: 'timer', phase: 'finished', startedAt: 1000000, completedAt: 1060000, elapsedMs: 60000 };
  const saved = model.toRunSession(blank);
  assert.equal(saved.distanceKm, undefined); assert.equal(saved.distanceSource, 'unmeasured'); assert.equal(saved.durationSeconds, 60); assert.deepEqual(saved.route, []);
  assert.equal(model.runRecordMeasurement(saved).pace, null);
  const partial = model.toRunSession({ ...blank, samples: [point(0, 40), point(10, 43)] });
  assert.equal(partial.runDistancePartial, true); assert.equal(model.runRecordMeasurement(partial).pace, null);
});
test('source handovers break routes instead of adding a position jump', () => {
  const samples = [point(0, 0, { provider: 'gps' }), point(10, 3, { provider: 'gps' }), point(1000, 6, { provider: 'fused' }), point(1010, 9, { provider: 'fused' })];
  assert.ok(Math.abs(model.analyseRun(samples).distanceM - 20) < .1); assert.equal(model.analyseRun(samples).segments.length, 2);
  assert.equal(model.usablePoint(point(0, 0, { provider: 'fused', ageMs: 15001 })), false);
});
test('browser no-fix start, permission loss, pause, resume and time-only save all remain usable', async () => {
  const h = browserHarness(), r = h.recorder;
  await r.start('without-fix'); h.deny(); h.advance(10000); await r.pause(); h.advance(20000); await r.resume(); h.advance(10000); await r.finish();
  const snapshot = await r.snapshot(0);
  assert.equal(snapshot.elapsedMs, 20000); assert.equal(snapshot.phase, 'finished'); assert.equal(snapshot.samples.length, 0); assert.equal(snapshot.error, '');
  assert.equal(model.toRunSession(snapshot).distanceKm, undefined);
});
test('indoor runs never subscribe to GPS, preserve manual distance on reload and reject invalid inputs', async () => {
  const h = browserHarness(), r = h.recorder;
  await r.start('indoor', 'indoor'); assert.equal(h.clears, 0); h.advance(600000);
  await assert.rejects(r.finish(NaN)); assert.equal((await r.snapshot(0)).phase, 'running');
  await r.finish(2.5); const snapshot = await r.snapshot(0), saved = model.toRunSession(snapshot);
  assert.equal(saved.workoutName, '室内跑'); assert.equal(saved.distanceKm, 2.5); assert.equal(saved.distanceSource, 'manual'); assert.deepEqual(saved.route, []);
  assert.equal(model.runRecordMeasurement(saved).pace, 240);
  const restored = await browserHarness(h.disk.get('uncover.running.web-journal.v2')).recorder.snapshot(0);
  assert.equal(restored.manualDistanceKm, 2.5); assert.equal(restored.mode, 'indoor');
  await r.finish(); assert.equal((await r.snapshot(0)).manualDistanceKm, 2.5);
});
