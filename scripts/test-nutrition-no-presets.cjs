const { test } = require('node:test');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
require('./lib/register-typescript.cjs')({ compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, extensions: ['.ts'] });
const engine = require('../src/nutrition/engine.ts');
const { food } = require('./fixtures/user-food.cjs');
test('fresh nutrition journal contains no food, recipes or allocation state', () => {
  const journal = engine.emptyNutritionJournal();
  assert.deepEqual(journal.customFoods, []); assert.deepEqual(journal.entries, []); assert.deepEqual(journal.savedMeals, []);
  for (const key of ['mealRevisions', 'mealOverrides']) assert.equal(Object.hasOwn(journal, key), false);
  assert.equal(engine.planDailyMenu, undefined); assert.equal(engine.getMealAlternatives, undefined);
  for (const file of ['catalog.ts', 'adjustments.ts', 'dishEstimate.ts']) assert.equal(fs.existsSync(path.join(__dirname, '../src/nutrition', file)), false);
});
test('bundled food identifiers cannot supply nutrients', () => {
  assert.throws(() => engine.calculatePortions([{ foodId: 'rice-cooked', grams: 100 }]));
  assert.deepEqual(engine.calculatePortions([{ foodId: food.id, grams: 100 }], [food]), food.per100g);
});
test('old recipe allocation state is discarded without deleting recorded history', () => {
  const entry = { id: 'historic', date: '2026-09-27', slot: 'lunch', name: '历史午餐', source: 'manual', portions: [{ foodId: 'retired-food', grams: 100 }], nutrients: { calories: 120, protein: 8, carbs: 14, fat: 4, fiber: 1 }, foodDataVersion: 'old-food-library', createdAt: '2026-09-27T08:00:00.000Z', updatedAt: '2026-09-27T08:00:00.000Z' };
  const restored = engine.normalizeNutritionJournal({ ...engine.emptyNutritionJournal(), entries: [entry], mealRevisions: { '2026-09-27:lunch': 1 }, mealOverrides: { old: {} } });
  assert.deepEqual(restored.entries, [entry]); assert.equal(Object.hasOwn(restored, 'mealOverrides'), false);
});
