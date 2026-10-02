const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file);
const { recordWeight, summarizeWeightTrend, weightTrendWindow } = require('../src/data/weightTrend.ts');
const { buildWeightChart, shortWeightDate } = require('../src/data/weightChart.ts');
const today = new Date(2026, 8, 28, 12);
const record = (date, kg) => ({ date, kg });

test('window retains measured days only, with last valid same-day value and no mutation', () => {
  const history = [record('2026-09-28', 75), record('2026-09-22', 77), record('2026-09-28', 74.5),
    record('2026-09-26', 75.5), record('2026-09-21', 99), record('2026-09-29', 30), record('2026-09-31', 60),
    record('2026-09-24', '70'), record('2026-09-23', 301), record('2026-09-28', NaN), null];
  const before = structuredClone(history);
  const window = weightTrendWindow(history, 7, today);
  assert.equal(window.start, '2026-09-22'); assert.equal(window.end, '2026-09-28');
  assert.deepEqual(window.records, [record('2026-09-22', 77), record('2026-09-26', 75.5), record('2026-09-28', 74.5)]);
  assert.equal(window.average, 75.7); assert.deepEqual(history, before);
});

test('duplicates cannot fabricate enough unique days to permit week comparisons', () => {
  const history = [record('2026-09-28', 75), record('2026-09-28', 74), record('2026-09-28', 73), record('2026-09-28', 72),
    record('2026-09-22', 74), record('2026-09-15', 76), record('2026-09-15', 75), record('2026-09-15', 74), record('2026-09-15', 73)];
  const summary = summarizeWeightTrend(history, today);
  assert.equal(summary.recentCount, 2); assert.equal(summary.previousCount, 1);
  assert.equal(summary.changeKg, undefined); assert.equal(summary.currentAverage, weightTrendWindow(history, 7, today).average);
});

test('7/30/90 day filters and averages reflect their own data and exclude future dates', () => {
  const history = [record('2026-09-28', 74), record('2026-09-10', 76), record('2026-08-02', 78), record('2026-06-01', 90), record('2026-10-01', 30)];
  assert.deepEqual([7, 30, 90].map(days => weightTrendWindow(history, days, today).average), [74, 75, 76]);
  assert.deepEqual([7, 30, 90].map(days => weightTrendWindow(history, days, today).records.length), [1, 2, 3]);
});

test('empty state has no points, curve, fill, or invented average', () => {
  const window = weightTrendWindow(undefined, 30, today), chart = buildWeightChart(window, 256);
  assert.equal(window.average, undefined); assert.deepEqual(chart.points, []); assert.equal(chart.line, ''); assert.equal(chart.area, '');
  assert.deepEqual(chart.ticks, []);
});

test('a single measurement renders one point without pretending a trend', () => {
  const chart = buildWeightChart(weightTrendWindow([record('2026-09-28', 75)], 7, today), 256);
  assert.equal(chart.points.length, 1); assert.equal(chart.line, ''); assert.equal(chart.area, '');
  assert.equal(chart.points[0].x, chart.right); assert.ok(chart.points[0].y >= chart.top && chart.points[0].y <= chart.bottom);
  assert.equal(chart.ticks.length >= 3, true); assert.ok(chart.ticks.every(tick => Number.isFinite(tick.kg) && Number.isFinite(tick.y)));
});

test('spacing is calendar-based, with no invented samples or spline overshoot', () => {
  const chart = buildWeightChart(weightTrendWindow([record('2026-09-22', 76), record('2026-09-27', 74), record('2026-09-28', 75)], 7, today), 348);
  assert.equal(chart.points.length, 3); assert.equal(chart.points[0].x, chart.left); assert.equal(chart.points[2].x, chart.right);
  const a = chart.points[1].x - chart.points[0].x, b = chart.points[2].x - chart.points[1].x;
  assert.ok(Math.abs(a / b - 5) < .002); assert.match(chart.line, /^M[^CL]+ L[^C]+ L/);
  assert.equal(chart.line.includes('C'), false); assert.equal((chart.line.match(/ L/g) || []).length, 2);
  assert.deepEqual(chart.dates.map(tick => tick.date), ['2026-09-22', '2026-09-25', '2026-09-28']);
});

test('constant weights and wide ranges retain finite, bounded chart coordinates at all widths', () => {
  for (const values of [[75, 75, 75], [30, 75, 300]]) for (const width of [256, 326, 376]) {
    const history = ['2026-09-22', '2026-09-25', '2026-09-28'].map((date, index) => record(date, values[index]));
    const chart = buildWeightChart(weightTrendWindow(history, 30, today), width);
    assert.equal(/NaN|Infinity/.test(chart.line + chart.area), false);
    assert.ok(chart.points.every(point => point.x >= chart.left && point.x <= chart.right && point.y >= chart.top && point.y <= chart.bottom));
    assert.ok(chart.ticks.length >= 3 && chart.ticks.length <= 7);
  }
});

test('chart date labels remain compact without leading zeroes', () => {
  assert.equal(shortWeightDate('2026-09-28'), '9/28');
});

test('invalid edits retain the last valid measurement; valid same-day edits replace rather than append', () => {
  const history = [record('2026-09-28', 75), record('2026-09-28', 74.5)];
  assert.deepEqual(recordWeight(history, NaN, today), [record('2026-09-28', 74.5)]);
  assert.deepEqual(recordWeight(history, 301, today), [record('2026-09-28', 74.5)]);
  assert.deepEqual(recordWeight(history, 74.2, today), [record('2026-09-28', 74.2)]);
});

test('calendar windows work across leap-day and month transitions', () => {
  const window = weightTrendWindow([record('2024-02-29', 75), record('2024-03-01', 74.8)], 7, new Date(2024, 2, 1, 12));
  assert.equal(window.start, '2024-02-24'); assert.equal(window.records.length, 2);
  const chart = buildWeightChart(window, 256);
  assert.ok(chart.points[0].x < chart.points[1].x); assert.equal(chart.points[1].x, chart.right);
});
