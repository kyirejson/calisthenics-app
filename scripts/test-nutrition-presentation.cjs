const assert = require('node:assert/strict');

const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');
require('./lib/register-typescript.cjs')({ compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, extensions: ['.ts'] });
const { summarizeMealSlots } = require('../src/nutrition/presentation.ts');
const { FOODS, getFood } = require('./fixtures/user-food.cjs');
const { FOOD_DATA_VERSION } = require('../src/nutrition/foodData.ts');
const { sumNutrients } = require('../src/nutrition/engine.ts');

const entry = (id, slot, extra = {}) => ({
  id, slot, name: '测试餐' + id, date: '2026-09-28', portions: [{ foodId: 'rice-cooked', grams: 100 }],
  source: 'manual', nutrients: { calories: 701.2, protein: 31.7, carbs: 66.2, fat: 12.1, fiber: 2 },
  ...extra,
});

test('meal rows are ordered by meal slot, not entry creation time', () => {
  const records = [entry('dinner', 'dinner'), entry('lunch', 'lunch'), entry('breakfast', 'breakfast')];
  const before = JSON.stringify(records);
  assert.deepEqual(summarizeMealSlots(records).map(row => row.slot), ['breakfast', 'lunch', 'dinner']);
  assert.equal(JSON.stringify(records), before);
});
test('slot totals use saved nutrient snapshots, not grams from the current catalog', () => {
  const records = [entry('one', 'lunch'), entry('two', 'lunch', { nutrients: { calories: 105.6, protein: 3.3, carbs: 20, fat: 1, fiber: 0 } })];
  const [row] = summarizeMealSlots(records);
  assert.deepEqual(row.nutrients, sumNutrients(records.map(item => item.nutrients)));
  assert.equal(row.nutrients.calories, 806.8);
  assert.equal(row.entries.length, 2);
  assert.equal(row.containsPhoto, false);
});
test('missing meals stay absent; recommendations never become eaten meal rows', () => {
  assert.deepEqual(summarizeMealSlots([]), []);
  assert.deepEqual(summarizeMealSlots([entry('one', 'snack')]).map(row => row.slot), ['snack']);
});
test('photo estimates remain visible in a mixed meal group and names are not duplicated', () => {
  const records = [entry('one', 'lunch', { name: '米饭' }), entry('two', 'lunch', { name: '米饭', source: 'photo_estimate' })];
  const [row] = summarizeMealSlots(records);
  assert.deepEqual(row.names, ['米饭']);
  assert.equal(row.containsPhoto, true);
  assert.equal(row.entries.length, 2);
});
