const { readFeature } = require('./lib/project-features.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require('./lib/register-typescript.cjs')({ compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, extensions: ['.ts'] });
const { buildTrainingDay } = require('../src/domain/training/dayTraining.ts');
const now = new Date(2026, 9, 8, 23, 30);
const at = new Date(2026, 9, 8, 10).toISOString();
const record = (id, sets = [{ reps: 8, completed: true, unit: 'reps' }], extra = {}) => ({ id, kind: 'strength', trainingDate: '2026-10-8', workoutId: 'lesson', workoutName: '真实训练', startedAt: at, completedAt: at, durationSeconds: 90, completion: 'partial', exercises: [{ exerciseId: 'squat_05', name: '标准深蹲', category: 'squat', targetSnapshot: { sets: 4, value: 10, unit: 'reps' }, sets }], totalReps: 999, ...extra });

test('today summary counts actual completed sets, never prescription or cached totals', () => {
  const summary = buildTrainingDay([record('a', [{ reps: 8, completed: true }, { reps: 10, completed: false }, { reps: 0, completed: true }, { reps: 1.5, completed: true }])], now);
  assert.equal(summary.setCount, 1); assert.equal(summary.totals.reps, 8);
  assert.equal(summary.exerciseCount, 1); assert.equal(summary.durationSeconds, 90);
});
test('multiple sessions aggregate without duplicate revisions or previous/future days', () => {
  const a = record('a'), updated = record('a', [{ reps: 9, completed: true }], { completedAt: new Date(2026, 9, 8, 11).toISOString() });
  const summary = buildTrainingDay([a, updated, record('b'), record('old', undefined, { trainingDate: '2026-10-7' }), record('future', undefined, { trainingDate: '2026-10-9' })], now);
  assert.equal(summary.records.length, 2); assert.equal(summary.setCount, 2); assert.equal(summary.totals.reps, 17); assert.equal(summary.durationSeconds, 180);
});
test('holds, distances, steps and per-side reps stay in their own units', () => {
  const side = record('side'); side.exercises[0].targetSnapshot.perSide = true;
  const summary = buildTrainingDay([side, record('hold', [{ reps: 30, completed: true, unit: 'seconds' }]), record('distance', [{ reps: 12.5, completed: true, unit: 'meters' }]), record('steps', [{ reps: 20, completed: true, unit: 'steps' }])], now);
  assert.deepEqual(summary.totals, { reps: 16, seconds: 30, meters: 12.5, steps: 20 });
  assert.equal(summary.setCount, 4); assert.equal(summary.exercises.length, 4); assert.equal(summary.exerciseCount, 1);
  assert.equal(summary.exercises.find(item => item.perSide).sets[0].reps, 8);
});
test('deletion recalculates summary and empty visits or old runs do not invent training', () => {
  const empty = buildTrainingDay([record('empty', []), record('run', [], { kind: 'running' })], now);
  assert.equal(empty.setCount, 0); assert.equal(empty.records.length, 0); assert.equal(empty.durationSeconds, 0);
  assert.equal(buildTrainingDay([record('a')], now).setCount, 1);
  assert.equal(buildTrainingDay([], now).setCount, 0);
});
test('unknown duration stays explicit rather than becoming an estimated workout time', () => {
  const summary = buildTrainingDay([record('no-time', undefined, { durationSeconds: 0 })], now);
  assert.equal(summary.unmeasuredCount, 1); assert.equal(summary.durationSeconds, 0);
});
test('completion navigation is downstream of successful persistence', () => {
  const app = fs.readFileSync(require.resolve('../App.tsx'), 'utf8');
  const screen = readFeature('training');
  assert.ok(app.includes("setSavedTrainingId(sessionId); setTab('profile')"));
  assert.ok(screen.indexOf('await saveSession(createRecord(quality, true))') < screen.indexOf('onComplete(sessionId.current)'));
  assert.match(screen, /finishing\.current = false;\s*setSaving\(false\)/);
});
