const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const engine = require('../src/nutrition/engine.ts');
const journal = require('../src/nutrition/journal.ts');
const vision = require('../src/nutrition/vision.ts');
const { getFood } = require('../src/nutrition/catalog.ts');
const { getFoodServings } = require('../src/nutrition/servings.ts');
const now = '2026-09-28T08:00:00.000Z';
const label = patch => ({ id: 'custom-label', name: '测试包装', state: '开袋即食', basisGrams: 100, energyUnit: 'kcal',
  calories: 150, protein: 10, carbs: 20, fat: 3, allergens: [], serving: { label: '一盒', grams: 180 }, ...patch });
const entryInput = patch => ({ id: 'entry-a', date: '2026-09-28', slot: 'lunch', name: '我的午餐', source: 'manual',
  portions: [{ foodId: 'custom-label', grams: 180 }], ...patch });
const photo = () => ({ id: 'photo-test', model: 'offline-test',
  items: [{ name: '米饭', portionLabel: '一碗', nutrients: { calories: 260, protein: 5, carbs: 56, fat: 1, fiber: 1 }, calorieRange: { min: 210, max: 310 } },
    { name: '鸡胸', portionLabel: '一份', nutrients: { calories: 165, protein: 31, carbs: 0, fat: 4, fiber: 0 }, calorieRange: { min: 140, max: 210 } }],
  assumptions: ['份量估算'], warnings: ['用油未知'] });

test('custom label supports per-serving/kJ input without inventing known fiber', () => {
  const food = engine.createCustomFoodFromLabel(label({ basisGrams: 50, energyUnit: 'kJ', calories: 313.8, protein: 5, carbs: 10, fat: 1.5 }));
  assert.ok(Math.abs(food.per100g.calories - 150) < 0.001);
  assert.equal(food.per100g.protein, 10);
  assert.equal(food.source.kind, 'user_label');
  assert.equal(food.source.url, '');
  assert.equal(food.fiberKnown, false);
  assert.deepEqual(getFoodServings(food), [{ label: '一盒', grams: 180 }, { label: '半份（一盒）', grams: 90 }]);
  assert.equal(engine.createCustomFoodFromLabel(label({ fiber: 0 })).fiberKnown, true);
});

test('invalid labels and forged curated identifiers are rejected', () => {
  for (const patch of [{ id: 'rice-cooked' }, { name: '' }, { basisGrams: 0 }, { basisGrams: NaN }, { calories: -1 },
    { protein: Infinity }, { fat: 101 }, { calories: 0, fat: 90 }, { allergens: ['unknown'] }, { serving: { label: '', grams: 0 } }]) {
    assert.throws(() => engine.createCustomFoodFromLabel(label(patch)));
  }
});

test('custom food history is independent from library edits and deletion', () => {
  const original = engine.createCustomFoodFromLabel(label());
  let state = journal.withCustomFood(engine.emptyNutritionJournal(), original);
  state = journal.withIntakeEntry(state, entryInput(), now);
  const snapshot = JSON.stringify(state.entries[0]);
  state = journal.withCustomFood(state, engine.createCustomFoodFromLabel(label({ calories: 180 })));
  state = journal.withoutCustomFood(state, original.id);
  assert.equal(JSON.stringify(state.entries[0]), snapshot);
  assert.equal(state.entries[0].fiberIncomplete, true);
  state = journal.withIntakeEntry(state, entryInput({ portions: [{ foodId: original.id, grams: 100 }] }), now);
  assert.equal(state.entries[0].nutrients.calories, 150);
  assert.deepEqual(engine.normalizeNutritionJournal(JSON.parse(JSON.stringify(state))), state);
});

test('favorites retain an independent snapshot and copying adds a new meal', () => {
  const food = engine.createCustomFoodFromLabel(label());
  let state = journal.withCustomFood(engine.emptyNutritionJournal(), food);
  state = journal.withIntakeEntry(state, entryInput(), now);
  state = journal.withFavoriteMeal(state, state.entries[0]);
  const favorite = state.savedMeals[0];
  state.entries[0].name = 'changed after saving';
  assert.equal(favorite.name, '我的午餐');
  state = journal.withoutIntakeEntry(journal.withoutCustomFood(state, food.id), 'entry-a');
  state = journal.withIntakeEntry(state, entryInput({ ...favorite, id: 'copied-meal', date: '2026-09-29', source: 'manual' }), now);
  assert.equal(state.entries[0].date, '2026-09-29');
  assert.equal(state.entries[0].nutrients.calories, 270);
  assert.equal(state.savedMeals[0].id, 'entry-a');
  assert.deepEqual(engine.normalizeNutritionJournal(JSON.parse(JSON.stringify(state))), state);
  assert.equal(journal.withoutFavoriteMeal(state, favorite.id).entries.length, 1);
});

test('legacy journals migrate without losing entries; unknown custom IDs cannot be recorded', () => {
  const old = { version: 1, entries: [], preferences: null, mealRevisions: {} };
  assert.deepEqual(engine.normalizeNutritionJournal(old), engine.emptyNutritionJournal());
  assert.throws(() => engine.createIntakeEntry({ ...entryInput(), now }));
  for (const revision of [-1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => journal.withMealRevision(engine.emptyNutritionJournal(), '2026-09-28', 'lunch', revision));
  }
});

test('per-item photo corrections never change other food or restore a deleted item', () => {
  const original = photo();
  const halfRice = vision.scalePhotoItem(original, 0, .5);
  assert.equal(halfRice.items[0].nutrients.calories, 130);
  assert.deepEqual(halfRice.items[1], original.items[1]);
  const removed = vision.removePhotoItem(halfRice, 1);
  const adjusted = vision.scalePhotoItem(removed, 0, 1.5);
  assert.equal(adjusted.items.length, 1);
  assert.equal(vision.summarizePhotoEstimate(adjusted).nutrients.calories, 195);
  assert.deepEqual(original, photo());
});

test('photo renaming does not pretend the nutrition was recomputed', () => {
  const original = photo();
  const renamed = vision.renamePhotoItem(original, 1, '这其实是鱼');
  assert.deepEqual(renamed.items[1].nutrients, original.items[1].nutrients);
  assert.equal(renamed.items[1].provenance.kind, 'photo');
  assert.equal(renamed.items[1].provenance.renamed, true);
  assert.throws(() => vision.renamePhotoItem(original, 0, ''));
});

test('catalog photo replacement recalculates only that item and persists provenance', () => {
  const original = photo();
  const replaced = vision.replacePhotoItemWithFood(original, 1, 'egg-boiled', { label: '约一大个', grams: 50 });
  assert.deepEqual(replaced.items[0], original.items[0]);
  assert.equal(replaced.items[1].nutrients.calories, getFood('egg-boiled').per100g.calories / 2);
  assert.equal(replaced.items[1].provenance.kind, 'catalog');
  assert.equal(replaced.items[1].provenance.grams, 50);
  const scaled = vision.scalePhotoItem(replaced, 1, .5);
  assert.equal(scaled.items[1].provenance.grams, 25);
  const state = journal.withIntakeEntry(engine.emptyNutritionJournal(), entryInput({ source: 'photo_estimate', portions: [], photoEstimate: scaled }), now);
  assert.deepEqual(engine.normalizeNutritionJournal(JSON.parse(JSON.stringify(state))), state);
  const invalid = JSON.parse(JSON.stringify(scaled)); invalid.items[1].nutrients.calories += 1;
  assert.equal(vision.normalizePhotoEstimate(invalid), null);
});

test('empty photo edits cannot be saved and invalid reference portions are rejected', () => {
  const empty = vision.removePhotoItem(vision.removePhotoItem(photo(), 1), 0);
  assert.equal(empty.items.length, 0);
  assert.equal(vision.normalizePhotoEstimate(empty), null);
  assert.throws(() => journal.withIntakeEntry(engine.emptyNutritionJournal(), entryInput({ source: 'photo_estimate', portions: [], photoEstimate: empty }), now));
  for (const grams of [0, -1, NaN, Infinity, 2001]) assert.throws(() => vision.replacePhotoItemWithFood(photo(), 0, 'rice-cooked', { label: '一碗', grams }));
  assert.throws(() => vision.replacePhotoItemWithFood(photo(), 0, 'not-a-food', { label: '一碗', grams: 150 }));
  const withOil = vision.addPhotoFood(empty, 'canola-oil', { label: '约一茶匙', grams: 4.5 });
  assert.equal(withOil.items.length, 1);
  assert.equal(withOil.items[0].nutrients.calories, 39.8);
  assert.equal(withOil.items[0].provenance.rangeBasis, 'reference-portion');
  assert.equal(vision.addPhotoFood(photo(), 'canola-oil', { label: '约一茶匙', grams: 4.5 }).items.length, 3);
  assert.throws(() => vision.addPhotoFood({ ...photo(), items: Array(12).fill(photo().items[0]) }, 'canola-oil', { label: '一份', grams: 1 }));
});
