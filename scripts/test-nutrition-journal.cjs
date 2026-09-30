const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  module._compile(output, filename);
};
const { FOODS } = require('../src/nutrition/catalog.ts');
const { emptyNutritionJournal, calculatePortions, normalizeNutritionJournal } = require('../src/nutrition/engine.ts');
const { withIntakeEntry, withoutIntakeEntry, withMealRevision, withNutritionPreferences } = require('../src/nutrition/journal.ts');
const { normalizeBodyMetrics } = require('../src/nutrition/profileBody.ts');
const { defaultNutritionPreferences, planDailyMenu } = require('../src/nutrition/engine.ts');
const date = '2026-09-27';
const now = '2026-09-27T03:00:00.000Z';
const later = '2026-09-27T03:01:00.000Z';
const input = (patch = {}) => ({ id: 'meal-1', date, slot: 'lunch', name: '午餐', portions: [{ foodId: FOODS[0].id, grams: 150 }], source: 'planned_meal', ...patch });

test('planned meal confirmation is idempotent even with new tap IDs or forged source keys', () => {
  const current = withIntakeEntry(emptyNutritionJournal(), input(), now);
  assert.equal(current.entries[0].sourceKey, `${date}:lunch`);
  const repeated = withIntakeEntry(current, input({ id: 'meal-2', sourceKey: 'different' }), later);
  assert.equal(repeated, current);
  assert.equal(repeated.entries.length, 1);
});

test('editing recalculates actual portions and preserves creation timestamp', () => {
  const current = withIntakeEntry(emptyNutritionJournal(), input(), now);
  const portions = [{ foodId: FOODS[0].id, grams: 80 }];
  const updated = withIntakeEntry(current, input({ name: '实际只吃了 80g', portions }), later);
  assert.equal(updated.entries.length, 1);
  assert.equal(updated.entries[0].createdAt, now);
  assert.equal(updated.entries[0].updatedAt, later);
  assert.deepEqual(updated.entries[0].nutrients, calculatePortions(portions));
  assert.equal(current.entries[0].portions[0].grams, 150);
});

test('manual extras are not collapsed into one planned meal', () => {
  let current = withIntakeEntry(emptyNutritionJournal(), input(), now);
  current = withIntakeEntry(current, input({ id: 'extra-1', source: 'manual', sourceKey: 'untrusted' }), now);
  current = withIntakeEntry(current, input({ id: 'extra-2', source: 'manual' }), now);
  assert.equal(current.entries.length, 3);
  assert.equal(current.entries.find(entry => entry.id === 'extra-1').sourceKey, undefined);
});

test('deletion changes only the selected intake, allowing intentional re-confirmation', () => {
  let current = withIntakeEntry(emptyNutritionJournal(), input(), now);
  current = withIntakeEntry(current, input({ id: 'breakfast', slot: 'breakfast' }), now);
  current = withoutIntakeEntry(current, 'meal-1');
  assert.deepEqual(current.entries.map(entry => entry.id), ['breakfast']);
  current = withIntakeEntry(current, input({ id: 'replacement' }), later);
  assert.equal(current.entries.length, 2);
});

test('meal swapping changes only revision state and never logged food', () => {
  const current = withIntakeEntry(emptyNutritionJournal(), input(), now);
  const changed = withMealRevision(current, date, 'lunch', 2);
  assert.deepEqual(changed.mealRevisions, { [`${date}:lunch`]: 2 });
  assert.equal(changed.entries, current.entries);
  assert.throws(() => withMealRevision(current, '2026-02-30', 'lunch', 1));
  assert.throws(() => withMealRevision(current, date, 'midnight', 1));
});

test('invalid mutation inputs cannot corrupt a valid journal', () => {
  const current = withIntakeEntry(emptyNutritionJournal(), input(), now);
  assert.throws(() => withIntakeEntry(current, input({ portions: [{ foodId: FOODS[0].id, grams: NaN }] }), later));
  assert.throws(() => withNutritionPreferences(current, { version: 1 }));
  assert.equal(current.entries.length, 1);
  assert.equal(current.preferences, null);
});

test('local JSON roundtrip preserves nutrient snapshots and journal state', () => {
  let current = withIntakeEntry(emptyNutritionJournal(), input(), now);
  current = withMealRevision(current, date, 'dinner', 1);
  assert.deepEqual(normalizeNutritionJournal(JSON.parse(JSON.stringify(current))), current);
});

test('editing one planned entry into an occupied slot fails without losing either record', () => {
  let current = withIntakeEntry(emptyNutritionJournal(), input(), now);
  current = withIntakeEntry(current, input({ id: 'dinner', slot: 'dinner' }), now);
  assert.throws(() => withIntakeEntry(current, input({ slot: 'dinner' }), later));
  assert.equal(current.entries.length, 2);
});

test('legacy body normalization does not fabricate a valid adult from missing or corrupt fields', () => {
  assert.deepEqual(normalizeBodyMetrics({}), { sex: 'unspecified', age: 0, height: 0, weight: 0 });
  assert.deepEqual(normalizeBodyMetrics({ sex: 'unknown', age: 0, height: Infinity, weight: 'bad' }), { sex: 'unspecified', age: 0, height: 0, weight: 0 });
  assert.deepEqual(normalizeBodyMetrics({ sex: 'female', age: '29', height: 165, weight: 61 }), { sex: 'female', age: 29, height: 165, weight: 61 });
});

test('device clock rollback cannot erase an edited entry on reload', () => {
  const current = withIntakeEntry(emptyNutritionJournal(), input(), now);
  const changed = withIntakeEntry(current, input({ name: '修正后的午餐' }), '2026-09-27T02:59:00.000Z');
  assert.equal(changed.entries[0].updatedAt, now);
  assert.equal(normalizeNutritionJournal(changed).entries.length, 1);
  assert.equal(normalizeNutritionJournal(changed).entries[0].name, '修正后的午餐');
});

test('reconfirming the same nutrition choices does not reshuffle the daily menu', () => {
  const profile = { age: 30, sex: 'male', height: 175, weight: 75, nutritionGoal: 'maintain', dietPattern: 'balanced_cn' };
  const preferences = { ...defaultNutritionPreferences(profile), screeningCompletedAt: now };
  const original = planDailyMenu(profile, preferences, date);
  const reconfirmed = planDailyMenu(profile, { ...preferences, screeningCompletedAt: later }, date);
  assert.deepEqual(reconfirmed, original);
});
