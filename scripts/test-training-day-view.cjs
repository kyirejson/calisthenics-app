const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
require('./lib/register-typescript.cjs')({ compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, extensions: ['.ts'] });
const { getTrainingDayView } = require('../src/domain/training/trainingDayView.ts');
const { dailyWorkoutKey } = require('../src/domain/training/sessionRecords.ts');
const fixture = fs.readFileSync(require.resolve('./smoke-fitness-flows.cjs'), 'utf8');
const profile = { ...vm.runInNewContext('(' + fixture.match(/const profile = ([\s\S]*?);\r?\n/)[1] + ')'), experience: 'elite', frequency: 6 };
const now = new Date(2026, 9, 8, 9);

test('selected day uses its own course, prescription, tip and date without modifying inputs', () => {
  const sessions = [], edits = {}, before = JSON.stringify({ profile, sessions, edits });
  const today = getTrainingDayView(profile, sessions, edits, now, null);
  const future = getTrainingDayView(profile, sessions, edits, now, new Date(2026, 9, 9, 12));
  assert.equal(today.isToday, true); assert.equal(future.isToday, false);
  assert.match(today.title, /拉力与下肢/); assert.match(future.title, /推力与腹部/);
  assert.equal(future.key, '2026-10-9'); assert.notEqual(future.workout.id, today.workout.id);
  assert.ok(future.exercises.some(exercise => exercise.id === 'push_05'));
  assert.match(future.resolved.day.tip, /提踵/);
  assert.equal(JSON.stringify({ profile, sessions, edits }), before);
});

test('date browsing reads extras and completion from that day rather than today', () => {
  const future = getTrainingDayView(profile, [], {}, now, new Date(2026, 9, 9));
  const edit = { date: future.key, workoutId: future.editableWorkoutId, exerciseIds: ['squat_01'] };
  const edits = { [dailyWorkoutKey(future.key, future.editableWorkoutId)]: edit };
  const viewed = getTrainingDayView(profile, [], edits, now, future.date);
  assert.ok(viewed.exercises.some(exercise => exercise.id === 'squat_01'));
  assert.ok(!getTrainingDayView(profile, [], edits, now, null).addedIds.includes('squat_01'));
  const sessions = [{ id: 'future-record', kind: 'strength', workoutId: future.workout.id, trainingDate: future.key,
    startedAt: future.date.toISOString(), completedAt: future.date.toISOString(), completion: 'complete', exercises: [], durationSeconds: 30 }];
  assert.equal(getTrainingDayView(profile, sessions, {}, now, future.date).state.complete, true);
  assert.equal(getTrainingDayView(profile, sessions, {}, now, null).state.complete, false);
});

test('rest and cardio calendar dates do not borrow the current strength course', () => {
  const restingProfile = { ...profile, experience: 'intermediate', frequency: 3 };
  const recovery = getTrainingDayView(restingProfile, [], {}, now, new Date(2026, 9, 11));
  assert.equal(recovery.resolved.day.type, 'recovery'); assert.equal(recovery.workout, null);
  assert.deepEqual(recovery.exercises, []);
  const cardioProfile = { ...profile, goal: 'weight_loss' };
  const views = Array.from({ length: 7 }, (_, offset) => getTrainingDayView(cardioProfile, [], {}, now, new Date(2026, 9, 8 + offset)));
  assert.ok(views.some(view => view.resolved.day.type === 'cardio' && view.exercises.length === 0));
});

test('null tracks the actual day across midnight and invalid preview dates fall back safely', () => {
  const tomorrow = new Date(2026, 9, 9, 0, 1);
  assert.equal(getTrainingDayView(profile, [], {}, tomorrow, null).key, '2026-10-9');
  assert.equal(getTrainingDayView(profile, [], {}, now, new Date(NaN)).isToday, true);
  assert.equal(getTrainingDayView(profile, [], {}, now, new Date(2026, 9, 8, 23)).isToday, true);
});
