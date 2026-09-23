const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const ts = require('typescript');

// Domain modules are dependency-free TypeScript; this small loader lets Node's
// built-in test runner exercise the same source used by the app.
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  module._compile(output, filename);
};

const { exercises } = require('../src/data/catalog.ts');
const progression = require('../src/data/progression.ts');
const plans = require('../src/data/trainingPlans.ts');
const { calculateNutritionPlan } = require('../src/data/nutritionPlanner.ts');

const profile = {
  name: '测试者', sex: 'male', age: 28, height: 175, weight: 70,
  goal: 'strength', nutritionGoal: 'performance', dietPattern: 'balanced_cn',
  frequency: 3, experience: 'beginner', planId: 'balanced_3',
  planStartedAt: new Date(2026, 8, 21).toISOString(),
  levels: { push: 1 },
};

test('all 188 actions belong to the integrated progression/catalogue', () => {
  assert.equal(exercises.length, 188);
  const statuses = progression.getAllProgressionStatuses(profile, []);
  assert.equal(statuses.length, 17);
  assert.equal(statuses.reduce((sum, status) => sum + status.totalLevels, 0), 184);
});

test('progression needs two qualified sessions at least 24 hours apart', () => {
  const status = progression.getProgressionStatus('push', profile, []);
  const exercise = status.current;
  const criteria = status.criteria;
  const session = (completedAt, quality = 'solid') => ({
    id: completedAt, kind: 'strength', workoutId: `single_${exercise.id}`,
    completedAt, quality, completion: 'complete',
    exercises: [{
      exerciseId: exercise.id,
      constraintsConfirmed: true,
      sets: Array.from({ length: criteria.sets }, () => ({
        completed: true, reps: criteria.value, unit: criteria.unit,
      })),
    }],
  });
  const older = session('2026-09-21T09:00:00Z');
  const sameDay = session('2026-09-22T08:59:00Z');
  const later = session('2026-09-22T10:00:00Z');
  assert.equal(progression.getProgressionStatus('push', profile, [older, sameDay]).eligible, false);
  assert.equal(progression.getProgressionStatus('push', profile, [older, later]).eligible, true);
  assert.equal(progression.getProgressionStatus('push', profile, [older, session(later.completedAt, 'pain')]).eligible, false);
});

test('unilateral actions require explicit full-standard confirmation', () => {
  const oneArm = exercises.find((exercise) => exercise.id === 'push_08');
  assert.ok(oneArm);
  const criteria = progression.parseMasteryCriteria(oneArm);
  assert.equal(criteria.manual, true);
  assert.match(criteria.confirmationHint, /左右两侧/);
});

test('seven-day starter begins on activation day and then gives a recovery day', () => {
  const start = new Date(2026, 8, 21);
  const starter = { ...profile, planId: 'rebirth_7', planStartedAt: start.toISOString() };
  const first = plans.getPlanDay(starter, start);
  assert.equal(first.phase, 'starter');
  assert.equal(first.dayNumber, 1);
  const eighth = new Date(start);
  eighth.setDate(start.getDate() + 7);
  const continuation = plans.getPlanDay(starter, eighth);
  assert.equal(continuation.phase, 'continuation');
  assert.equal(continuation.day.type, 'recovery');
});

test('nutrition blocks restrictive targets for minors and low BMI', () => {
  assert.equal(calculateNutritionPlan({ ...profile, age: 16, nutritionGoal: 'rapid_loss' }, true).safetyLevel, 'blocked');
  assert.equal(calculateNutritionPlan({ ...profile, weight: 45, dietPattern: 'keto' }, false).safetyLevel, 'blocked');
});
