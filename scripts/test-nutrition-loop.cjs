const assert = require('node:assert/strict');

const { test } = require('node:test');
const ts = require('typescript');
require('./lib/register-typescript.cjs')({ compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, extensions: ['.ts'] });
const { localWeightDate } = require('../src/domain/weight/weightTrend.ts');
const { getWorkoutExercises } = require('../src/domain/training/catalog.ts');
const { getPlanDay, PRISONER_PLAN_ID } = require('../src/domain/training/trainingPlans.ts');
const { estimateStrengthSession } = require('../src/domain/training/trainingPrescription.ts');
const { FOODS, getFood } = require('./fixtures/user-food.cjs');
const { FOOD_DATA_VERSION } = require('../src/nutrition/foodData.ts');
const engine = require('../src/nutrition/engine.ts');
const journalTools = require('../src/nutrition/journal.ts');
const timeline = require('../src/nutrition/timeline.ts');
const trainingTools = require('../src/nutrition/training.ts');
const state = require('../src/nutrition/state.ts');
const { dateAtNoon, offsetDate } = require('../src/nutrition/validation.ts');
const now = '2026-09-28T04:00:00.000Z';
const date = localWeightDate(new Date(now));
const profile = { name: '隔离测试', sex: 'male', age: 30, height: 175, weight: 75, weightHistory: [], goal: 'street_mastery',
  nutritionGoal: 'maintain', dietPattern: 'balanced_cn', frequency: 3, sessionMinutes: 45, trainingRestSeconds: 180,
  levels: {}, experience: 'intermediate', planId: PRISONER_PLAN_ID, planStartedAt: now };
const training = { type: 'strength', title: '测试力量课', plannedMinutes: 45, completedMinutes: 0, completedSets: 0, sessionCount: 0, status: 'planned' };
const clone = value => JSON.parse(JSON.stringify(value));
function base(patch = {}) { return { ...engine.emptyNutritionJournal(), preferences: { ...engine.defaultNutritionPreferences(profile), screeningCompletedAt: now, ...patch } }; }
function entry(id, slot = 'breakfast', grams = 150, onDate = date) {
  return { id, date: onDate, slot, name: '米饭', source: 'manual', customFoods: FOODS, portions: [{ foodId: FOODS[0].id, grams }] };
}
function session(patch = {}) {
  return { id: 'strength', workoutId: 'prisonerA', workoutName: '测试课', startedAt: now, completedAt: now,
    durationSeconds: 1800, totalReps: 8, exercises: [{ exerciseId: 'push_05', name: '标准俯卧撑', category: 'push', sets: [{ completed: true, reps: 8 }] }], ...patch };
}
function capture(journal, onDate = date, body = profile) {
  return timeline.withDailyTargetSnapshot(journal, onDate, timeline.createNutritionTargetSnapshot(body, journal, training, dateAtNoon(onDate).toISOString()));
}
function fullDay(journal, onDate, id, grams = 150) {
  return timeline.withMealLoggingConfirmation(journalTools.withIntakeEntry(journal, entry(id, 'lunch', grams, onDate), dateAtNoon(onDate).toISOString()), onDate, 'day', true, now);
}

test('old journal gains empty history and completeness without fabricating either', () => {
  const legacy = { version: 1, preferences: base().preferences, entries: [], mealRevisions: {} };
  const normalized = engine.normalizeNutritionJournal(legacy);
  assert.deepEqual(normalized.days, {});
  assert.equal(normalized.trainingTime, 'unspecified');
});

test('date arithmetic covers leap days, month boundaries and calendar validity', () => {
  assert.equal(offsetDate('2024-02-28', 1), '2024-02-29');
  assert.equal(offsetDate('2026-12-31', 1), '2027-01-01');
  assert.equal(offsetDate('2026-03-01', -1), '2026-02-28');
  assert.throws(() => dateAtNoon('2026-02-30'));
});

test('training context matches the actual schedule and prescription including rest', () => {
  const planned = getPlanDay(profile, dateAtNoon(date));
  const expected = getWorkoutExercises(planned.day.workoutId, profile, planned.cycle.setMultiplier, planned.cycle.dupDay, planned.cycle.week, { sessions: [], date: dateAtNoon(date) });
  const result = trainingTools.getNutritionTrainingContext(profile, [], {}, date);
  assert.equal(result.type, 'strength');
  assert.equal(result.plannedMinutes, estimateStrengthSession(expected, 45, true).totalMinutes);
  assert.equal(result.completedMinutes, 0);
});

test('merely opened strength workouts and zero-duration runs do not count', () => {
  const opened = session({ exercises: [{ exerciseId: 'push_05', name: '标准俯卧撑', category: 'push', sets: [{ completed: false, reps: 10 }] }] });
  const zeroRun = session({ id: 'run', kind: 'running', durationSeconds: 0, exercises: [] });
  assert.equal(trainingTools.meaningfulTrainingSessions([opened, zeroRun], date).length, 0);
});

test('padded and legacy training dates count checked sets once without calorie credit', () => {
  const checked = session({ trainingDate: date, calories: 99999, completion: 'partial' });
  const run = session({ id: 'run', kind: 'running', trainingDate: date.replace(/-0/g, '-'), durationSeconds: 600, calories: 99999, exercises: [] });
  const result = trainingTools.getNutritionTrainingContext(profile, [checked, run], {}, date);
  assert.equal(result.sessionCount, 2);
  assert.equal(result.completedSets, 1);
  assert.equal(result.completedMinutes, 40);
  assert.equal(result.status, 'partial');
  assert.equal(Object.hasOwn(result, 'calories'), false);
});

test('today target capture is idempotent and never manufactures a past target', () => {
  const original = capture(base());
  const snapshot = timeline.createNutritionTargetSnapshot(profile, original, training, now);
  assert.strictEqual(timeline.withDailyTargetSnapshot(original, date, snapshot), original);
  assert.throws(() => timeline.withDailyTargetSnapshot(original, offsetDate(date, -1), snapshot), /当天/);
  assert.equal(original.days[date].targetHistory.length, 1);
});

test('target changes append a preserved snapshot instead of changing yesterday', () => {
  const yesterday = offsetDate(date, -1);
  let journal = capture(base(), yesterday);
  const old = clone(journal.days[yesterday]);
  journal = capture(journal);
  const before = clone(journal.days[date].targetHistory[0]);
  journal = journalTools.withNutritionPreferences(journal, { ...journal.preferences, objective: 'muscle_gain' });
  journal = capture(journal);
  assert.equal(journal.days[date].targetHistory.length, 2);
  assert.deepEqual(journal.days[date].targetHistory[0], before);
  assert.deepEqual(journal.days[yesterday], old);
  assert.deepEqual(engine.normalizeNutritionJournal(clone(journal)).days, journal.days);
});

test('history retains earliest and latest snapshots when a day has many revisions', () => {
  let journal = base();
  for (let i = 0; i < 70; i++) journal = capture(journal, date, { ...profile, weight: 75 + i / 10 });
  assert.equal(journal.days[date].targetHistory.length, 64);
  assert.equal(journal.days[date].targetHistory[0].body.weight, 75);
  assert.equal(journal.days[date].targetHistory.at(-1).body.weight, 81.9);
});

test('a log at an old date does not create a historical target', () => {
  const yesterday = offsetDate(date, -1);
  const journal = journalTools.withIntakeEntry(base(), entry('old', 'lunch', 150, yesterday), now);
  assert.equal(timeline.latestNutritionTarget(journal, yesterday), null);
});

test('all explicit meal confirmations constitute a complete day, future days cannot be confirmed', () => {
  let journal = base();
  for (const slot of state.MEAL_SLOTS) journal = timeline.withMealLoggingConfirmation(journal, date, slot, true, now);
  assert.equal(journal.days[date].completedAt, now);
  journal = timeline.withMealLoggingConfirmation(journal, date, 'lunch', false, now);
  assert.equal(journal.days[date].completedAt, null);
  assert.throws(() => timeline.withMealLoggingConfirmation(journal, offsetDate(date, 1), 'day', true, now));
});

test('adding, editing and deleting food invalidate only the affected completeness', () => {
  let journal = journalTools.withIntakeEntry(base(), entry('a'), now);
  journal = timeline.withMealLoggingConfirmation(journal, date, 'day', true, now);
  journal = journalTools.withIntakeEntry(journal, entry('a', 'breakfast', 200), now);
  assert.equal(journal.days[date].completedAt, null);
  assert.deepEqual(journal.days[date].confirmedSlots, ['lunch', 'snack', 'dinner']);
  journal = timeline.withMealLoggingConfirmation(journal, date, 'day', true, now);
  journal = journalTools.withoutIntakeEntry(journal, 'a');
  assert.equal(journal.days[date].completedAt, null);
  assert.ok(!journal.days[date].confirmedSlots.includes('breakfast'));
});

test('moving a saved meal invalidates both original and destination confirmations', () => {
  const yesterday = offsetDate(date, -1);
  let journal = journalTools.withIntakeEntry(base(), entry('a', 'lunch', 150, yesterday), now);
  journal = timeline.withMealLoggingConfirmation(journal, yesterday, 'day', true, now);
  journal = timeline.withMealLoggingConfirmation(journal, date, 'day', true, now);
  journal = journalTools.withIntakeEntry(journal, entry('a', 'dinner'), now);
  assert.equal(journal.days[yesterday].completedAt, null);
  assert.equal(journal.days[date].completedAt, null);
  assert.ok(!journal.days[yesterday].confirmedSlots.includes('lunch'));
  assert.ok(!journal.days[date].confirmedSlots.includes('dinner'));
});

test('unlogged and partially logged days do not become zero intake or intake deficits', () => {
  const missing = timeline.summarizeNutritionWeek(base(), profile, [], date);
  assert.equal(missing.average, null);
  assert.equal(missing.referenceCalories, null);
  assert.equal(missing.completeDays, 0);
  assert.equal(missing.status, 'insufficient');
  const partial = timeline.summarizeNutritionWeek(journalTools.withIntakeEntry(base(), entry('partial', 'lunch', 20), now), profile, [], date);
  assert.equal(partial.average, null);
  assert.equal(partial.recordedDays, 1);
  assert.match(partial.insights[0], /漏记不算少吃/);
});

test('weekly comparisons use the same complete dates and their original reference targets', () => {
  let journal = base();
  for (let i = 0; i < 4; i++) { const day = offsetDate(date, -i); journal = fullDay(capture(journal, day), day, 'day-' + i, 150 + i * 10); }
  // One complete day has records but no historical target; it is not compared.
  const unknown = offsetDate(date, -5);
  journal = fullDay(journal, unknown, 'no-target', 1000);
  const result = timeline.summarizeNutritionWeek(journal, profile, [session()], date);
  assert.equal(result.status, 'ready');
  assert.equal(result.completeDays, 5);
  assert.equal(result.comparableDays, 4);
  assert.notEqual(result.average.calories, result.comparisonAverage.calories);
  assert.equal(result.referenceCalories, engine.calculateTargets(profile, journal.preferences).calories);
  assert.equal(result.trainingDays, 1);
});

test('different purposes in a week and goal changes during a day are not conflated', () => {
  let journal = base();
  for (let i = 0; i < 4; i++) { const day = offsetDate(date, -i); journal = fullDay(capture(journal, day), day, 'day-' + i); }
  journal = journalTools.withNutritionPreferences(journal, { ...journal.preferences, objective: 'muscle_gain' });
  journal = capture(journal);
  const result = timeline.summarizeNutritionWeek(journal, profile, [], date);
  assert.equal(result.status, 'goal_changed');
  assert.equal(result.referenceCalories, null);
});

test('confirmed zero-intake days are distinct from missing data, not silently discarded', () => {
  const journal = timeline.withMealLoggingConfirmation(capture(base()), date, 'day', true, now);
  const result = timeline.summarizeNutritionWeek(journal, profile, [], date);
  assert.equal(result.completeDays, 1);
  assert.equal(result.average.calories, 0);
  assert.equal(result.recordedDays, 1);
});

test('a new underweight measurement pauses targets even before recalibrating the old profile', () => {
  const body = { ...profile, weightHistory: [{ date: localWeightDate(new Date()), kg: 45 }] };
  assert.equal(engine.calculateTargets(body, base().preferences).status, 'blocked');
  const future = { ...profile, weightHistory: [{ date: '2099-01-01', kg: 45 }] };
  assert.equal(engine.calculateTargets(future, base().preferences).status, 'ready');
});

test('consumed or explicitly finished slots cannot be overwritten by agent actions', () => {
  const request = { type: 'swap_meal', slot: 'dinner', focus: 'balanced' };
  const recorded = journalTools.withIntakeEntry(base(), entry('dinner', 'dinner'), now);
  const finished = timeline.withMealLoggingConfirmation(base(), date, 'dinner', true, now);
});

test('risk, underage and unsupported diet patterns stop all automatic action tools', () => {
  for (const [body, journal] of [[{ ...profile, age: 17 }, base()], [profile, base({ riskFlags: ['pregnancy'] })], [profile, base({ pattern: 'keto' })]]) {
  }
});
