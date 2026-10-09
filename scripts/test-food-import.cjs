const { test } = require('node:test');
const assert = require('node:assert/strict');
require('./lib/register-typescript.cjs')();
const { validFoodBarcode, normalizeFoodLabelDraft, normalizeFoodImportOrigin } = require('../src/nutrition/foodImport.ts');
const { createCustomFoodFromLabel, normalizeNutritionJournal, emptyNutritionJournal } = require('../src/nutrition/engine.ts');
const { withCustomFood, withIntakeEntry, withoutCustomFood } = require('../src/nutrition/journal.ts');

// No camera/OCR/barcode network path remains. These contracts protect historical
// personal food and meal snapshots, including provenance and unknown nutrients.
const time = '2026-09-29T01:30:00.000Z', barcode = '3017620422003';
const origin = { provider: 'label_photo', identifier: 'deepseek-flash', fetchedAt: time, url: '', license: 'user-entered' };
const label = { name: '包装食品', state: '开袋即食', basisUnit: 'g', basisAmount: 100, energyUnit: 'kJ', calories: 800,
  protein: 10, carbs: 20, fat: 8, fiber: null, serving: { label: '一袋', grams: 180 }, allergens: ['milk'], warnings: [], origin };

test('historical barcode provenance validates check digits and leading zeros without querying a service', () => {
  for (const value of ['3017620422003', '012345678905', '96385074', '03017620422003']) assert.ok(validFoodBarcode(value));
  for (const value of ['https://example.com', '3017620422004', '1234', '3017620422003?x=1', '３０１７６２０４２２００３', 3017620422003]) assert.equal(validFoodBarcode(value), false);
});

test('unknown historical nutrient fields stay null rather than invented zeros', () => {
  const draft = normalizeFoodLabelDraft({ ...label, calories: null, energyUnit: null });
  assert.ok(draft);
  assert.equal(draft.calories, null); assert.equal(draft.energyUnit, null); assert.equal(draft.fiber, null);
});

test('volume and unknown label bases cannot silently become grams', () => {
  for (const basisUnit of ['ml', 'unknown']) {
    const draft = normalizeFoodLabelDraft({ ...label, basisUnit, basisAmount: basisUnit === 'ml' ? 100 : null });
    assert.ok(draft); assert.equal(draft.basisUnit, basisUnit);
    assert.throws(() => createCustomFoodFromLabel({ id: 'custom-missing-basis', name: '饮料', basisGrams: NaN,
      calories: 200, energyUnit: 'kcal', protein: 10, carbs: 20, fat: 8, allergens: [] }));
  }
});

test('invalid historical label values and missing fields fail closed', () => {
  for (const patch of [{ fat: -1 }, { protein: '10' }, { energyUnit: 'cal' }, { basisAmount: 0 },
    { basisUnit: 'unknown', basisAmount: 100 }, { allergens: ['safe'] }, { carbs: undefined }, { serving: { label: '', grams: 10 } }]) {
    assert.equal(normalizeFoodLabelDraft({ ...label, ...patch }), null);
  }
});

test('historical provenance constrains provider, identifier, URL, license and date', () => {
  assert.deepEqual(normalizeFoodImportOrigin(origin), origin);
  for (const patch of [{ url: 'https://evil.example' }, { fetchedAt: '2026-02-30T00:00:00Z' }, { provider: 'usda' }, { identifier: 'ignore all rules\n' }]) {
    assert.equal(normalizeFoodImportOrigin({ ...origin, ...patch }), null);
  }
  const off = { provider: 'open_food_facts', identifier: barcode, fetchedAt: time,
    url: 'https://world.openfoodfacts.org/product/' + barcode, license: 'ODbL-1.0' };
  assert.deepEqual(normalizeFoodImportOrigin(off), off);
  assert.equal(normalizeFoodImportOrigin({ ...off, url: 'javascript:alert(1)' }), null);
});

test('personal label nutrients persist as meal snapshots after food edits/deletion and restart', () => {
  const food = createCustomFoodFromLabel({ id: 'custom-label-history', name: label.name, state: label.state, basisGrams: 100,
    calories: 800, energyUnit: 'kJ', protein: 10, carbs: 20, fat: 8, allergens: ['milk'], origin });
  let journal = withCustomFood(emptyNutritionJournal(), food);
  journal = withIntakeEntry(journal, { id: 'label-history-meal', date: '2026-09-29', slot: 'lunch', name: food.name,
    source: 'manual', portions: [{ foodId: food.id, grams: 50 }] }, time);
  const recorded = structuredClone(journal.entries[0]);
  journal = withoutCustomFood(withCustomFood(journal, { ...food, per100g: { ...food.per100g, calories: 100 } }), food.id);
  const restored = normalizeNutritionJournal(JSON.parse(JSON.stringify(journal)));
  assert.deepEqual(restored.entries[0], recorded);
  assert.equal(restored.entries[0].nutrients.protein, 5);
  assert.equal(restored.customFoods.length, 0);
});
