const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file);
const { summarizeMealSlots, resolveRecipeArtwork } = require('../src/nutrition/presentation.ts');
const { RECIPES } = require('../src/nutrition/catalog.ts');
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
test('all four recipe illustrations match the entire ingredient set', () => {
  for (const id of ['soy-banana-oats', 'chicken-mushroom-pasta', 'chickpea-cucumber-snack', 'tilapia-bok-choy-rice']) {
    const recipe = RECIPES.find(item => item.id === id);
    assert.ok(recipe, id);
    assert.equal(resolveRecipeArtwork(recipe.ingredients), id);
    assert.equal(resolveRecipeArtwork([...recipe.ingredients].reverse().map(p => ({ ...p, grams: p.grams * 2 }))), id);
  }
});
test('a changed, missing, custom or substituted ingredient never gets another recipe photo', () => {
  const recipe = RECIPES.find(item => item.id === 'soy-banana-oats');
  for (const portions of [[], recipe.ingredients.slice(1), [...recipe.ingredients, { foodId: 'milk-2pct', grams: 100 }],
    recipe.ingredients.map(p => p.foodId === 'soy-milk' ? { foodId: 'milk-2pct', grams: p.grams } : p),
    [...recipe.ingredients, { foodId: 'custom-food', grams: 10 }], [...recipe.ingredients, { foodId: 'canola-oil', grams: 2 }]]) {
    assert.equal(resolveRecipeArtwork(portions), undefined);
  }
});
test('oil is allowed only in the two cooked dishes and invalid portions do not produce photos', () => {
  const recipe = RECIPES.find(item => item.id === 'tilapia-bok-choy-rice');
  assert.equal(resolveRecipeArtwork(recipe.ingredients.filter(p => p.foodId !== 'canola-oil')), recipe.id);
  for (const grams of [0, -1, NaN, Infinity]) {
    assert.equal(resolveRecipeArtwork(recipe.ingredients.map((p, i) => i === 0 ? { ...p, grams } : p)), undefined);
  }
});
test('recipe assets are separate, high-resolution square PNGs, not paired screenshots', () => {
  for (const name of ['soy-banana-oats', 'chicken-mushroom-pasta', 'chickpea-cucumber-snack', 'tilapia-bok-choy-rice']) {
    const image = fs.readFileSync(path.join(__dirname, '../assets/nutrition-recipes', name + '-v1.png'));
    assert.equal(image.subarray(1, 4).toString('ascii'), 'PNG');
    assert.ok(image.readUInt32BE(16) >= 512);
    assert.equal(image.readUInt32BE(16), image.readUInt32BE(20));
  }
});
