const { readFeature } = require('./lib/project-features.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require('./lib/register-typescript.cjs')({ compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, extensions: ['.ts'] });
const { derivePerformanceHistory } = require('../src/domain/training/trainingHistory.ts');
const { buildTrainingDay } = require('../src/domain/training/dayTraining.ts');
const now = new Date(2026, 9, 8, 22);
const session = (id, hour, values) => {
  const at = new Date(2026, 9, 8, hour).toISOString();
  return { id, kind: 'strength', workoutId: 'same-workout', workoutName: '同一课程', trainingDate: '2026-10-8', startedAt: at, completedAt: at, completion: 'complete', durationSeconds: 60, exercises: [{ exerciseId: 'pull_05', name: '标准引体向上', category: 'pull', sets: values.map(reps => ({ reps, completed: true, unit: 'reps' })) }] };
};
test('same-day repeat adds all actual sets while best remains a maximum', () => {
  const sessions = [session('first', 10, [9, 9, 9, 9]), session('repeat', 11, [6, 6, 6, 6])];
  const history = derivePerformanceHistory(sessions, 'pull_05', 'reps', now);
  assert.equal(history.points.length, 1); assert.equal(history.latest.total, 60); assert.equal(history.latest.best, 9);
  assert.equal(history.latest.sessionIds.length, 2); assert.equal(history.latest.sets.length, 8);
  assert.equal(buildTrainingDay(sessions, now).totals.reps, 60);
});
test('partial repeat counts only done sets, revisions never duplicate, deletion recalculates', () => {
  const first = session('first', 10, [9, 9, 9, 9]), repeat = session('repeat', 11, [6, 6, 6, 6]);
  const partial = { ...session('partial', 12, [5]), completion: 'partial' };
  partial.exercises[0].sets.push({ reps: 100, completed: false, unit: 'reps' });
  const sessions = [first, repeat, partial, { ...partial, completedAt: new Date(2026, 9, 8, 13).toISOString() }];
  assert.equal(derivePerformanceHistory(sessions, 'pull_05', 'reps', now).latest.total, 65);
  assert.equal(buildTrainingDay(sessions, now).setCount, 9);
  const remaining = sessions.filter(item => item.id !== 'partial');
  assert.equal(derivePerformanceHistory(remaining, 'pull_05', 'reps', now).latest.total, 60);
  assert.equal(buildTrainingDay(remaining, now).totals.reps, 60);
});
test('data chart selection is owned above routes, not reset by data-page remount', () => {
  const app = fs.readFileSync(require.resolve('../App.tsx'), 'utf8');
  const screen = readFeature('history');
  assert.ok(app.includes('viewPreferences={dataView} onViewPreferences={setDataView}'));
  assert.ok(app.includes("metric: 'total'"));
  assert.ok(screen.includes('onViewPreferences({ ...viewPreferences, ...patch })'));
  assert.ok(!screen.includes("useState<ProgressMetric>('best')"));
  assert.ok(!screen.includes("const [selectedSeries, setSelectedSeries]"));
});
