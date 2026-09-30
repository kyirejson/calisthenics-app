const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const history = require('../src/data/trainingHistory.ts');
const chart = require('../src/data/progressChart.ts');
const { getSeriesExercises, parseMasteryCriteria } = require('../src/data/progression.ts');
const now = new Date(2026, 8, 28, 20);
const date = (day, month = 8, year = 2026) => new Date(year, month, day, 10).toISOString();
function session(id, day, values = [10], extra = {}) {
  const at = date(day);
  return { id, workoutId: 'lesson', workoutName: '测试训练', startedAt: at, completedAt: at,
    durationSeconds: 90, kind: 'strength', completion: 'partial', exercises: [{ exerciseId: 'push_05', name: '标准俯卧撑', category: 'push',
      sets: values.map(value => typeof value === 'object' ? value : { completed: true, reps: value, unit: 'reps' }) }], totalReps: 0, ...extra };
}
function exam(id, day, exercise) {
  const criteria = parseMasteryCriteria(exercise);
  const record = session(id, day, Array(criteria.sets).fill(criteria.value), { workoutId: 'single_' + exercise.id, quality: 'solid', completion: 'complete' });
  record.exercises[0].exerciseId = exercise.id;
  record.exercises[0].constraintsConfirmed = true;
  record.exercises[0].sets.forEach(set => { set.unit = criteria.unit; });
  return record;
}
const perf = sessions => history.derivePerformanceHistory(sessions, 'push_05', 'reps', now);

test('no records means no invented points, personal best, or reviewed days', () => {
  assert.deepEqual(perf([]), { points: [], bestAllTime: 0, latest: null, hasData: false });
  assert.deepEqual(history.computeReviewedTrainingStreak([], now), { days: null, status: 'empty' });
  assert.equal(history.computeWeekStreak([], now), 0);
});
test('only actually checked positive finite integer reps count', () => {
  const record = session('s', 1, [{ reps: 8, completed: true }, { reps: 20, completed: false },
    { reps: 0, completed: true }, { reps: -1, completed: true }, { reps: 1.5, completed: true },
    { reps: Infinity, completed: true }, { reps: NaN, completed: true }]);
  assert.deepEqual(perf([record]).latest.sets, [8]);
  assert.equal(perf([record]).latest.total, 8);
});
test('legacy snapshot units are explicit evidence; absent units default to reps', () => {
  const record = session('hold', 1, [{ reps: 40, completed: true }]);
  record.exercises[0].targetSnapshot = { sets: 1, value: 20, unit: 'seconds' };
  assert.equal(history.derivePerformanceHistory([record], 'push_05', 'seconds', now).latest.best, 40);
  assert.equal(perf([record]).hasData, false);
  delete record.exercises[0].targetSnapshot;
  assert.equal(history.derivePerformanceHistory([record], 'push_05', 'seconds', now).hasData, false);
});
test('seconds, steps and fractional metres never become reps', () => {
  for (const [unit, value] of [['seconds', 54], ['steps', 16], ['meters', 12.5]]) {
    const record = session('unit-' + unit, 1, [{ reps: value, completed: true, unit }]);
    const result = history.derivePerformanceHistory([record], 'push_05', unit, now);
    assert.equal(result.latest.best, value);
    assert.equal(result.latest.unit, unit);
    assert.equal(perf([record]).hasData, false);
  }
});
test('same-day sessions aggregate best by max and volume by sum', () => {
  const result = perf([session('a', 2, [12, 8]), session('b', 2, [14, 10])]);
  assert.equal(result.points.length, 1);
  assert.equal(result.latest.best, 14);
  assert.equal(result.latest.total, 44);
  assert.equal(result.latest.sessionIds.length, 2);
});
test('repeated exercise entries aggregate rather than silently losing the second', () => {
  const record = session('s', 1, [8]);
  record.exercises.push({ ...record.exercises[0], sets: [{ reps: 12, completed: true, unit: 'reps' }] });
  assert.equal(perf([record]).latest.total, 20);
  assert.equal(perf([record]).latest.best, 12);
});
test('duplicate session IDs use the latest revision once, without mutating raw logs', () => {
  const old = session('s', 1, [10]);
  const latest = session('s', 1, [16], { completedAt: date(2) });
  const original = JSON.stringify([old, latest]);
  assert.equal(perf([old, latest, old]).latest.total, 16);
  assert.equal(JSON.stringify([old, latest]), original);
});
test('a valid revision replaces an earlier duplicate with an invalid clock', () => {
  const bad = session('s', 1, [10], { startedAt: 'invalid', completedAt: 'invalid' });
  assert.equal(perf([bad, session('s', 1, [16])]).latest.total, 16);
});
test('training date overrides timestamp day and accepts unpadded legacy keys', () => {
  const record = session('s', 2, [8], { trainingDate: '2026-9-1' });
  assert.equal(perf([record]).latest.dayKey, '2026-09-01');
  assert.equal(history.groupHistoryByDay([record], now)[0].key, '2026-09-01');
});
test('invalid dates, future start/end, future workout day and future checked sets are excluded', () => {
  assert.equal(perf([
    session('invalid', 1, [8], { trainingDate: '2026-02-30' }),
    session('future', 30),
    session('future-end', 1, [8], { completedAt: date(30) }),
    session('future-day', 1, [8], { trainingDate: '2026-10-01' }),
    session('future-set', 1, [{ reps: 8, completed: true, completedAt: date(30) }]),
    session('invalid-start', 1, [8], { startedAt: 'invalid' }),
  ]).hasData, false);
});
test('merely viewing, an empty session, and running with zero duration do not count as attendance', () => {
  const records = [session('s', 1, [{ reps: 10, completed: false }]), session('empty', 1, [], { exercises: [] }),
    session('run', 1, [], { kind: 'running', durationSeconds: 0 })];
  assert.equal(history.validHistorySessions(records, now).length, 0);
  assert.equal(history.computeMonthStats(records, now).count, 0);
});
test('a reversed session clock is not a reliable training record', () => {
  assert.equal(perf([session('s', 2, [8], { completedAt: date(1) })]).hasData, false);
});
test('real running duration counts without inventing strength results', () => {
  const run = session('run', 1, [], { kind: 'running', durationSeconds: 600, exercises: [] });
  assert.equal(history.computeMonthStats([run], now).count, 1);
  assert.equal(perf([run]).hasData, false);
});
test('unknown feedback stays unknown and there is no fabricated RIR', () => {
  const point = perf([session('s', 1)]).latest;
  assert.equal(point.feedback.unrated, 1);
  assert.equal(point.feedback.solid, 0);
  assert.equal(Object.hasOwn(point, 'rir'), false);
});
test('mixed same-day feedback is preserved, including explicit pain', () => {
  const point = perf([session('a', 1, [8], { quality: 'solid' }), session('b', 1, [10], { quality: 'pain' })]).latest;
  assert.equal(point.feedback.solid, 1);
  assert.equal(point.feedback.pain, 1);
});
test('rest days do not create data points or a predicted target achievement', () => {
  const result = perf([session('a', 1, [8]), session('b', 8, [12])]);
  assert.equal(result.points.length, 2);
  assert.equal((result.points[1].t - result.points[0].t) / 86400000, 7);
  assert.equal(result.latest.best, 12);
});
test('manual choice of a high level does not manufacture exam badges', () => {
  const steps = history.deriveSeriesStaircase([], 'push', 8, getSeriesExercises('push'), 8, now);
  assert.equal(steps.some(step => step.isCompleted), false);
  assert.equal(steps.find(step => step.isCurrent).step, 8);
});
test('three-step window includes the next level and short series never fabricate extra stairs', () => {
  const all = getSeriesExercises('push');
  assert.deepEqual(history.deriveSeriesStaircase([], 'push', 5, all, 5, now).map(step => step.step), [4, 5, 6]);
  assert.equal(history.deriveSeriesStaircase([], 'push', 1, all.slice(0, 1), 1, now).length, 1);
  assert.deepEqual(history.deriveSeriesStaircase([], 'push', 1, [], 1, now), []);
});
test('two spaced qualifying exams reuse progression rules to light an evidence badge', () => {
  const all = getSeriesExercises('push'), exercise = all[3];
  const records = [exam('a', 1, exercise), exam('b', 3, exercise)];
  const step = history.deriveSeriesStaircase(records, 'push', 5, all, 5, now).find(step => step.step === 4);
  assert.equal(step.isCompleted, true);
  assert.equal(step.firstRecordedDate, '2026-09-01');
});
test('one exam, partial exams, unknown quality, or bad units never qualify', () => {
  const all = getSeriesExercises('push'), exercise = all[3];
  const passed = records => history.deriveSeriesStaircase(records, 'push', 5, all, 5, now).find(step => step.step === 4).isCompleted;
  const one = exam('a', 1, exercise), two = exam('b', 3, exercise);
  assert.equal(passed([one]), false);
  assert.equal(passed([one, { ...two, completion: 'partial' }]), false);
  assert.equal(passed([one, { ...two, quality: undefined }]), false);
  const wrongUnit = structuredClone(two); wrongUnit.exercises[0].sets.forEach(set => set.unit = 'seconds');
  assert.equal(passed([one, wrongUnit]), false);
});
test('invalid high-value sets cannot sneak into mastery evidence', () => {
  const all = getSeriesExercises('push'), exercise = all[3];
  const records = [exam('a', 1, exercise), exam('b', 3, exercise)];
  records.forEach(record => { record.exercises[0].sets = [{ reps: 1, completed: true }, { reps: Infinity, completed: true }, { reps: Infinity, completed: true }]; });
  assert.equal(history.deriveSeriesStaircase(records, 'push', 5, all, 5, now).some(step => step.isCompleted), false);
});
test('deleting exam evidence removes the badge instead of trusting the chosen level', () => {
  const all = getSeriesExercises('push'), records = [exam('a', 1, all[3]), exam('b', 3, all[3])];
  assert.equal(history.deriveSeriesStaircase(records.slice(1), 'push', 5, all, 5, now).some(step => step.isCompleted), false);
});
test('feedback streak counts reviewed training days, not the forty-eight calendar days since pain', () => {
  const records = [session('a', 1, [8], { quality: 'pain' }), session('b', 8, [8], { quality: 'solid' }), session('c', 20, [8], { quality: 'hard' })];
  assert.deepEqual(history.computeReviewedTrainingStreak(records, now), { days: 2, status: 'reported' });
});
test('latest unknown feedback does not mean no pain; explicit pain gives zero', () => {
  assert.deepEqual(history.computeReviewedTrainingStreak([session('s', 1)], now), { days: null, status: 'unreviewed' });
  assert.deepEqual(history.computeReviewedTrainingStreak([session('s', 1, [8], { quality: 'pain' })], now), { days: 0, status: 'pain' });
});
test('same-day unknown feedback breaks a reviewed-day streak rather than disappearing', () => {
  assert.equal(history.computeReviewedTrainingStreak([session('a', 1, [8], { quality: 'solid' }), session('b', 1)], now).status, 'unreviewed');
});
test('month comparison uses matching elapsed dates and separates active days from sessions', () => {
  const records = [session('a', 1), session('b', 1), session('c', 20),
    session('prev', 1, [8], { startedAt: date(15, 7), completedAt: date(15, 7) }),
    session('prev-late', 1, [8], { startedAt: date(31, 7), completedAt: date(31, 7) })];
  const stats = history.computeMonthStats(records, now);
  assert.equal(stats.count, 3); assert.equal(stats.activeDays, 2); assert.equal(stats.prevCount, 1);
  assert.equal(stats.seconds, 270); assert.equal(stats.deltaPercent, 200);
});
test('valid checked sets count even when duration is unmeasured, but missing time is explicit', () => {
  const records = [session('a', 1), session('b', 2, [8], { durationSeconds: 0 }),
    session('c', 3, [8], { durationSeconds: -1 }), session('d', 4, [8], { durationSeconds: NaN })];
  const stats = history.computeMonthStats(records, now);
  assert.equal(stats.count, 4); assert.equal(stats.seconds, 90); assert.equal(stats.unmeasuredCount, 3);
  assert.deepEqual(history.summarizeHistoryDuration(records), { seconds: 90, unmeasuredCount: 3 });
  assert.equal(history.formatDuration(NaN), '—');
  assert.equal(history.formatDuration(-1), '—');
  assert.equal(history.formatDuration(0), '0 秒');
});
test('calendar rolls across years and missing completion is partial, not completed', () => {
  const record = session('dec', 1, [8], { startedAt: date(31, 11, 2025), completedAt: date(31, 11, 2025), completion: undefined });
  const grid = history.buildMonthGrid(2026, -1, [record], now).filter(Boolean);
  assert.equal(grid[0].key, '2025-12-01');
  assert.equal(grid.at(-1).key, '2025-12-31');
  assert.equal(grid.at(-1).state, 'partial');
});
test('week streak ignores empty sessions and allows an unfinished current week', () => {
  const records = [session('last', 22), session('before', 15)];
  assert.equal(history.computeWeekStreak(records, now), 2);
  assert.equal(history.computeWeekStreak([session('empty', 28, [])], now), 0);
});
test('previous comparison uses the same unit and skips uncompleted intervening attempts', () => {
  const old = session('old', 1, [10]);
  const wrong = session('wrong', 3, [{ reps: 60, unit: 'seconds', completed: true }]);
  const empty = session('empty', 4, [{ reps: 50, completed: false }]);
  const current = session('current', 5, [12]);
  const row = history.compareWithPrevious(current, [old, wrong, empty, current], now)[0];
  assert.equal(row.prevBest, 10); assert.equal(row.delta, 2); assert.equal(row.unit, 'reps');
});
test('history comparisons merge repeated same-unit entries without duplicate rows or data loss', () => {
  const current = session('current', 3, [12]);
  current.exercises.push({ ...current.exercises[0], sets: [{ reps: 18, completed: true, unit: 'reps' }] });
  current.exercises.push({ ...current.exercises[0], sets: [{ reps: 40, completed: true, unit: 'seconds' }] });
  const before = JSON.stringify(current);
  const rows = history.compareWithPrevious(current, [session('old', 1, [10]), current], now);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0].exercise.sets.map(set => set.reps), [12, 18]);
  assert.equal(rows[0].best, 18); assert.equal(rows[0].delta, 8);
  assert.equal(rows[1].unit, 'seconds'); assert.equal(rows[1].prevBest, null);
  assert.equal(JSON.stringify(current), before);
});
test('range filtering uses calendar days and keeps old records for All', () => {
  const result = perf([session('old', 1), session('current', 28)]);
  assert.equal(chart.visibleProgressPoints(result.points, 30, now).length, 2);
  const later = new Date(2026, 10, 1);
  assert.equal(chart.visibleProgressPoints(result.points, 30, later).length, 0);
  assert.equal(chart.visibleProgressPoints(result.points, 'all', later).length, 2);
});
test('chart X positions reflect actual gaps, not equal spacing for unequal dates', () => {
  const points = perf([session('a', 1), session('b', 2), session('c', 11)]).points;
  const geometry = chart.progressGeometry(points, 'best', 20, 300, 160);
  const a = geometry.coordinate(points[0]), b = geometry.coordinate(points[1]), c = geometry.coordinate(points[2]);
  assert.ok(Math.abs((b.x - a.x) / (c.x - a.x) - 0.1) < 1e-8);
});
test('Y scale covers actual highs and all tick values share the same transform', () => {
  const points = perf([session('a', 1, [150])]).points;
  const geometry = chart.progressGeometry(points, 'best', 20, 300, 160);
  assert.ok(geometry.maximum > 150);
  assert.ok(geometry.coordinate(points[0]).y > 0);
  for (const tick of geometry.ticks) assert.ok(Math.abs(tick.y - (160 - tick.value / geometry.maximum * 160)) < 1e-8);
});
test('one point is centred without a made-up line or target point; endpoints have halo padding', () => {
  const points = perf([session('a', 1, [18])]).points;
  const geometry = chart.progressGeometry(points, 'best', 20, 300, 160);
  assert.equal(geometry.coordinate(points[0]).x, 150);
  assert.equal(geometry.fill, '');
  assert.ok(!geometry.path.includes('C'));
  const pair = perf([session('a', 1), session('b', 2)]).points;
  const two = chart.progressGeometry(pair, 'best', 20, 300, 160);
  assert.equal(two.coordinate(pair[0]).x, 12);
  assert.equal(two.coordinate(pair[1]).x, 288);
});
test('total mode uses actual sum with no single-set target line', () => {
  const points = perf([session('a', 1, [18, 14, 9])]).points;
  const geometry = chart.progressGeometry(points, 'total', null, 300, 160);
  assert.equal(geometry.benchmarkY, null);
  assert.ok(Math.abs(geometry.coordinate(points[0]).y - (160 - 41 / geometry.maximum * 160)) < 1e-8);
});
test('smooth curve control points stay within each pair of observed values', () => {
  const coordinates = [{ x: 0, y: 100 }, { x: 10, y: 20 }, { x: 100, y: 80 }, { x: 110, y: 80 }];
  const sections = chart.monotoneProgressPath(coordinates).split(' C ').slice(1);
  assert.equal(sections.length, 3);
  sections.forEach((section, i) => {
    const values = section.split(' ').map(Number), low = Math.min(coordinates[i].y, coordinates[i + 1].y), high = Math.max(coordinates[i].y, coordinates[i + 1].y);
    assert.ok(values[1] >= low && values[1] <= high); assert.ok(values[3] >= low && values[3] <= high);
  });
});
test('large histories bound curve rendering while retaining original point identities', () => {
  const template = perf([session('s', 1)]).latest;
  const points = Array.from({ length: 10000 }, (_, i) => ({ ...template, id: String(i), t: i * 86400000, best: i % 113 }));
  const sampled = chart.sampleProgressPoints(points, 'best');
  assert.ok(sampled.length <= 100); assert.equal(sampled[0], points[0]); assert.equal(sampled.at(-1), points.at(-1));
  assert.ok(sampled.every(point => points.includes(point)));
  assert.equal(points.length, 10000);
});
test('bounded sampling always preserves absolute highs and lows including a four-point budget', () => {
  const template = perf([session('s', 1)]).latest;
  const points = Array.from({ length: 1000 }, (_, i) => ({ ...template, id: String(i), t: i * 86400000, best: 50 + i % 7 }));
  points[201].best = 1; points[753].best = 500;
  for (const limit of [4, 5, 100]) {
    const sampled = chart.sampleProgressPoints(points, 'best', limit);
    assert.ok(sampled.length <= limit);
    for (const point of [points[0], points.at(-1), points[201], points[753]]) assert.ok(sampled.includes(point));
    assert.ok(sampled.every((point, i) => i === 0 || point.t > sampled[i - 1].t));
  }
});
test('sub-minute real duration remains visible instead of rounding to zero minutes', () => {
  assert.equal(history.formatDuration(30), '30 秒');
  assert.equal(history.formatDuration(90), '1 分30 秒');
  assert.equal(chart.progressNumber(12.5), '12.5');
});
test('no fake preview paths, RIR conversion, symmetry ratios or unused chart implementations remain', () => {
  const source = fs.readFileSync(require.resolve('../src/components/UnifiedProgressCard.tsx'), 'utf8');
  assert.equal(/pRatios|达标目标|S1|rar|Quality:|RIR\s|stepsToRender/.test(source), false);
  for (const filename of ['PerformanceCurveChart.tsx', 'ProgressionStaircaseChart.tsx', 'SymmetryStreakCard.tsx']) assert.equal(fs.existsSync(require('node:path').join(__dirname, '../src/components', filename)), false);
});
