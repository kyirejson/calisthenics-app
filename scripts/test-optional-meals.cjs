const assert = require('node:assert/strict');
const { test } = require('node:test');
const ts = require('typescript');
require('./lib/register-typescript.cjs')({ compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, extensions: ['.ts'] });
const engine = require('../src/nutrition/engine.ts');
const { withMealStatus, withMealLoggingConfirmation, summarizeNutritionWeek } = require('../src/nutrition/timeline.ts');
const { withIntakeEntry } = require('../src/nutrition/journal.ts');
const { food: userFood } = require('./fixtures/user-food.cjs');
const now = '2026-10-02T01:00:00.000Z', date = '2026-10-02';
const profile = { age: 30, height: 175, weight: 75, sex: 'male', weightHistory: [] };
const food = { id: 'meal-qa', date, slot: 'lunch', name: '米饭', source: 'manual', customFoods: [userFood], portions: [{ foodId: userFood.id, grams: 100 }] };

test('a skipped meal persists independently without empty foods or full-day zero assumptions', () => {
  const j = withMealStatus(engine.emptyNutritionJournal(), date, 'breakfast', 'not_eaten', now);
  assert.equal(j.entries.length, 0);
  assert.deepEqual(j.days[date].skippedSlots, ['breakfast']);
  assert.deepEqual(j.days[date].confirmedSlots, ['breakfast']);
  assert.equal(j.days[date].completedAt, null);
  assert.deepEqual(engine.normalizeNutritionJournal(JSON.parse(JSON.stringify(j))), j);
  const review = summarizeNutritionWeek(j, profile, [], date);
  assert.equal(review.days.at(-1).state, 'partial'); assert.equal(review.completeDays, 0); assert.equal(review.average, null);
  let all = j; for (const slot of ['lunch', 'snack', 'dinner']) all = withMealStatus(all, date, slot, 'not_eaten', now);
  assert.equal(all.days[date].completedAt, null, 'individual choices do not auto-confirm the entire day');
});

test('only one meal can be recorded while others remain unknown; recording after a skip clears that skip', () => {
  const original = withMealStatus(engine.emptyNutritionJournal(), date, 'lunch', 'not_eaten', now);
  const recorded = withIntakeEntry(original, food, now);
  assert.equal(recorded.entries.length, 1); assert.deepEqual(recorded.days[date].skippedSlots, []); assert.deepEqual(recorded.days[date].confirmedSlots, []);
  assert.equal(recorded.days[date].completedAt, null);
  assert.throws(() => withMealStatus(recorded, date, 'lunch', 'not_eaten', now), /已有实际饮食记录/);
  assert.equal(recorded.entries.length, 1);
  const reset = withMealStatus(recorded, date, 'lunch', 'unrecorded', now);
  assert.deepEqual(reset.entries, recorded.entries);
});

test('revoking a meal or whole-day confirmation clears state but never deletes foods', () => {
  const j = withMealStatus(engine.emptyNutritionJournal(), date, 'breakfast', 'not_eaten', now);
  const day = withMealLoggingConfirmation(j, date, 'day', true, now);
  assert.ok(day.days[date].completedAt);
  const reset = withMealLoggingConfirmation(day, date, 'day', false, now);
  assert.deepEqual(reset.days[date].skippedSlots, []); assert.equal(reset.days[date].completedAt, null);
  assert.throws(() => withMealStatus(j, '2026-10-03', 'breakfast', 'not_eaten', now));
});
