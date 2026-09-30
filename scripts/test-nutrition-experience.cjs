const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const engine = require('../src/nutrition/engine.ts');
const { getFood } = require('../src/nutrition/catalog.ts');
const person = { name: 'fixture', sex: 'male', age: 30, height: 180, weight: 90, nutritionGoal: 'muscle_gain', dietPattern: 'balanced_cn' };
const preferences = overrides => ({ ...engine.defaultNutritionPreferences(person), activity: 'active',
  screeningCompletedAt: '2026-09-27T08:00:00.000Z', ...overrides });
const day = '2026-09-27';

test('alternative preview revisions reproduce exactly without changing other meals or records', () => {
  const prefs = preferences();
  const revisions = { [day + ':breakfast']: 2, [day + ':dinner']: 1 };
  const unchanged = JSON.stringify(revisions);
  const menu = engine.planDailyMenu(person, prefs, day, revisions);
  const original = menu.meals.find(meal => meal.slot === 'lunch');
  const options = engine.getMealAlternatives(person, prefs, day, revisions, 'lunch');
  assert.ok(options.length > 1);
  assert.equal(new Set(options.map(option => option.meal.recipeId)).size, options.length);
  for (const option of options) {
    assert.notEqual(option.meal.recipeId, original.recipeId);
    const next = engine.planDailyMenu(person, prefs, day, { ...revisions, [day + ':lunch']: option.revision });
    assert.deepEqual(next.meals.find(meal => meal.slot === 'lunch'), option.meal);
    assert.deepEqual(next.meals.filter(meal => meal.slot !== 'lunch'), menu.meals.filter(meal => meal.slot !== 'lunch'));
    assert.equal(next.totals.calories, option.dayCalories);
    assert.ok(Math.abs(option.difference.protein - (option.meal.nutrients.protein - original.nutrients.protein)) < 0.11);
    if (option.nearEquivalent) {
      assert.ok(Math.abs(option.difference.calories) <= original.nutrients.calories * 0.1);
      assert.ok(Math.abs(option.difference.protein) <= Math.max(5, original.nutrients.protein * 0.2));
      assert.equal(option.changesGoalDirection, false);
    }
  }
  assert.equal(JSON.stringify(revisions), unchanged);
  assert.deepEqual(options, [...options].sort((a, b) => Number(b.nearEquivalent) - Number(a.nearEquivalent)));
});

test('goal-direction conflicts are never labelled near-equivalent', () => {
  const options = engine.getMealAlternatives(person, preferences(), day, {}, 'lunch');
  assert.ok(options.some(option => option.changesGoalDirection));
  for (const option of options.filter(option => option.changesGoalDirection)) assert.equal(option.nearEquivalent, false);
});

test('every alternative retains allergy, vegetarian, time and budget filtering', () => {
  const prefs = preferences({ pattern: 'vegetarian', allergens: ['milk', 'egg'], maxCookingMinutes: 15, budget: 'economy' });
  for (const slot of ['breakfast', 'lunch', 'snack', 'dinner']) {
    for (const option of engine.getMealAlternatives(person, prefs, day, {}, slot)) {
      assert.ok(option.meal.minutes <= 15);
      for (const ingredient of option.meal.ingredients) {
        const food = getFood(ingredient.foodId);
        assert.ok(food.vegetarian);
        assert.ok(!food.allergens.some(allergen => prefs.allergens.includes(allergen)));
      }
    }
  }
});

test('unavailable menu has no alternative suggestions', () => {
  assert.deepEqual(engine.getMealAlternatives(person, null, day, {}, 'lunch'), []);
  assert.deepEqual(engine.getMealAlternatives(person, preferences({ riskFlags: ['pregnancy'] }), day, {}, 'lunch'), []);
  assert.throws(() => engine.getMealAlternatives(person, preferences(), '2026-02-30', {}, 'lunch'));
});
