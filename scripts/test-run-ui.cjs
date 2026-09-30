const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file);
const { normalizeRunningGoal, resolveRunningGoal, runningGoalProgress } = require('../src/data/runGoals.ts');
const { fitTrackViewport, validGeoPoint, worldX, worldY, wrappedWorldX, MAP_MAX_ZOOM, MAP_MIN_ZOOM } = require('../src/utils/mapViewport.ts');
const { downsampleTrack, haversine } = require('../src/utils/geo.ts');

test('a custom goal is independent of the course and its value is normalized', () => {
  assert.deepEqual(normalizeRunningGoal({ kind: 'distance', value: 3.456 }), { kind: 'distance', value: 3.46 });
  assert.deepEqual(resolveRunningGoal({ kind: 'distance', value: 5 }, 30), { kind: 'distance', value: 5 });
  assert.deepEqual(resolveRunningGoal(undefined, 30), { kind: 'duration', value: 30 });
  assert.equal(resolveRunningGoal(undefined, undefined), null, 'No default distance is passed off as a prescription');
  assert.equal(resolveRunningGoal(undefined, NaN), null);
});
test('goal bounds reject empty, coerced, non-finite and corrupted values', () => {
  for (const input of [null, [], {}, { kind: 'distance', value: '5' }, { kind: 'duration', value: .5 },
    { kind: 'distance', value: .49 }, { kind: 'distance', value: 51 }, { kind: 'duration', value: 241 },
    { kind: 'duration', value: 2.5 }, { kind: 'distance', value: NaN }, { kind: 'distance', value: Infinity },
    { kind: 'other', value: 3 }]) assert.equal(normalizeRunningGoal(input), null);
  assert.deepEqual(normalizeRunningGoal({ kind: 'distance', value: .5 }), { kind: 'distance', value: .5 });
  assert.deepEqual(normalizeRunningGoal({ kind: 'duration', value: 240 }), { kind: 'duration', value: 240 });
});
test('progress uses precise GPS distance or active time, without rounded display values', () => {
  assert.equal(runningGoalProgress({ kind: 'distance', value: 5 }, 1234, 9), 24.68);
  assert.equal(runningGoalProgress({ kind: 'duration', value: 30 }, 99999, 900), 50);
  assert.equal(runningGoalProgress({ kind: 'distance', value: 5 }, 10000, 0), 100);
  assert.equal(runningGoalProgress({ kind: 'duration', value: 30 }, 0, -5), 0);
  assert.equal(runningGoalProgress({ kind: 'distance', value: 0 }, 100, 0), 0);
  assert.equal(runningGoalProgress(null, 5000, 600), 0);
  assert.equal(runningGoalProgress({ kind: 'distance', value: 5 }, Infinity, 600), 0);
});
test('invalid positions cannot fabricate a map location', () => {
  for (const input of [null, undefined, { latitude: NaN, longitude: 1 }, { latitude: 1, longitude: Infinity },
    { latitude: 91, longitude: 0 }, { latitude: 0, longitude: -181 }]) assert.equal(validGeoPoint(input), false);
  assert.equal(validGeoPoint({ latitude: 0, longitude: 0 }), true);
  assert.deepEqual(fitTrackViewport([], null, 408, 296), { center: null, zoom: MAP_MAX_ZOOM });
  assert.deepEqual(fitTrackViewport([{ latitude: NaN, longitude: 1 }], null, 408, 296), { center: null, zoom: MAP_MAX_ZOOM });
});
test('a single real position is centered at the detailed zoom', () => {
  const point = { latitude: 31.2304, longitude: 121.4737 };
  assert.deepEqual(fitTrackViewport([], point, 408, 296), { center: point, zoom: MAP_MAX_ZOOM });
  for (const width of [0, -1, NaN, Infinity]) {
    const fitted = fitTrackViewport([point, { latitude: 31.24, longitude: 121.48 }], null, width, 200);
    assert.equal(fitted.zoom, MAP_MAX_ZOOM);
    assert.ok(validGeoPoint(fitted.center));
  }
});
function assertFitted(points, width, height) {
  const fitted = fitTrackViewport(points, null, width, height);
  assert.ok(validGeoPoint(fitted.center));
  assert.ok(fitted.zoom >= MAP_MIN_ZOOM && fitted.zoom <= MAP_MAX_ZOOM);
  const cx = worldX(fitted.center.longitude, fitted.zoom), cy = worldY(fitted.center.latitude, fitted.zoom);
  for (const point of points) {
    assert.ok(Math.abs(wrappedWorldX(point.longitude, fitted.zoom, cx) - cx) < width / 2 - 7, 'Longitude fits inside the map');
    assert.ok(Math.abs(worldY(point.latitude, fitted.zoom) - cy) < height / 2 - 7, 'Latitude fits inside the map');
  }
  return fitted;
}
test('the full route fits mobile and desktop widths rather than cropping the start', () => {
  const points = [{ latitude: 31.2304, longitude: 121.4737 }, { latitude: 31.251, longitude: 121.495 }, { latitude: 31.21, longitude: 121.53 }];
  for (const width of [288, 358, 408]) assertFitted(points, width, width / 1.38);
  const fit = fitTrackViewport(points, points.at(-1), 408, 296);
  assert.notDeepEqual(fit.center, points.at(-1), 'Track bounds, not only the last point, determine center');
  assert.ok(fit.zoom < MAP_MAX_ZOOM);
});
test('crossing the antimeridian keeps nearby points together', () => {
  const fitted = assertFitted([{ latitude: 20, longitude: 179.99 }, { latitude: 20.01, longitude: -179.99 }], 358, 259);
  assert.ok(Math.abs(fitted.center.longitude) > 179.9);
  assert.ok(fitted.zoom >= 13, 'Nearby points must not zoom out to the whole globe');
});
test('duplicate fixes and polar coordinates remain finite', () => {
  const point = { latitude: 31, longitude: 121 };
  const fitted = fitTrackViewport([point, point, point], point, 358, 259);
  assert.ok(Math.abs(fitted.center.latitude - 31) < .000001);
  assert.equal(fitted.zoom, MAP_MAX_ZOOM);
  for (const latitude of [-90, 90]) assert.ok(Number.isFinite(worldY(latitude, 16)));
});
test('downsampling preserves the start and end of long real routes', () => {
  const points = Array.from({ length: 601 }, (_, i) => ({ latitude: 31 + i * .00001, longitude: 121 + Math.sin(i / 50) * .0001 }));
  for (const count of [480, 240]) {
    const sampled = downsampleTrack(points, count);
    assert.ok(sampled.length <= count);
    for (const [actual, expected] of [[sampled[0], points[0]], [sampled.at(-1), points.at(-1)]]) {
      assert.ok(Math.abs(actual.latitude - expected.latitude) <= .0000005);
      assert.ok(Math.abs(actual.longitude - expected.longitude) <= .0000005);
    }
  }
  assert.ok(Math.abs(haversine(points[0], points[100]) - 111.2) < 2);
});
