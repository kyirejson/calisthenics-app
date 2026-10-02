const { test } = require('node:test');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file);
const { FOODS } = require('../src/nutrition/catalog.ts');
const { FOOD_ARTWORK_BY_ID, FOOD_ARTWORK_CATEGORIES, resolveFoodArtwork, mealFoodArtwork, isFoodArtworkCategory } = require('../src/nutrition/foodArtwork.ts');
const { emptyNutritionJournal, normalizeCustomFood, createCustomFoodFromLabel, normalizeNutritionJournal } = require('../src/nutrition/engine.ts');
const { withCustomFood, withoutCustomFood, withIntakeEntry, withoutIntakeEntry } = require('../src/nutrition/journal.ts');
const { addPhotoFood, normalizePhotoEstimate } = require('../src/nutrition/vision.ts');
const { referencedPhotoIds } = require('../src/nutrition/photoMetadata.ts');
const time = '2026-09-29T01:30:00.000Z';
const photo = suffix => ({ id: 'nutrition-photo-' + (suffix ?? '1234567890'), kind: 'food', capturedAt: time });
const food = () => ({ ...createCustomFoodFromLabel({ id: 'custom-artwork-test', name: '自定义腰果', state: '开袋即食',
  basisGrams: 100, energyUnit: 'kcal', calories: 600, protein: 23, carbs: 20, fat: 47, allergens: ['tree_nut'] }), photo: photo(), artworkCategory: 'nuts' });
const intake = (patch = {}) => ({ id: 'artwork-intake', date: '2026-09-29', slot: 'lunch', name: '测试食品', source: 'manual',
  portions: [{ foodId: food().id, grams: 30 }], ...patch });
const draft = () => ({ id: 'artwork-vision', model: 'offline', items: [], assumptions: [], warnings: [] });

test('every curated food has an explicit category and packaged optimized asset', () => {
  assert.equal(FOODS.length, 101);
  assert.deepEqual(Object.keys(FOOD_ARTWORK_BY_ID).sort(), FOODS.map(food => food.id).sort());
  for (const food of FOODS) {
    const art = resolveFoodArtwork(food);
    assert.ok(isFoodArtworkCategory(art.category));
    const asset = path.join(__dirname, '../assets/nutrition-foods', art.asset + '-v1.jpg');
    const bytes = fs.readFileSync(asset);
    assert.equal(bytes.readUInt16BE(0), 0xffd8);
    assert.ok(bytes.length < 50000, 'thumb is optimized, not a multi-megabyte generation');
    assert.match(art.accessibilityLabel, /配图.*非本次实拍/);
  }
  for (const category of FOOD_ARTWORK_CATEGORIES) assert.ok(resolveFoodArtwork({ id: 'custom-food', artworkCategory: category }).asset);
});
test('unknown names never acquire a false specific photo or change nutrition', () => {
  assert.equal(resolveFoodArtwork({ id: 'unknown', name: '番茄炒鸡蛋' }).category, 'mixed');
  assert.equal(resolveFoodArtwork({ id: 'unknown', name: '盐焗腰果仁' }).category, 'mixed');
  assert.equal(resolveFoodArtwork({ id: 'custom-salt-cashew', artworkCategory: 'nuts' }).category, 'nuts');
  assert.equal(resolveFoodArtwork({ id: 'egg-boiled' }).badge, '蛋类图');
  assert.equal(resolveFoodArtwork({ id: 'tomato-raw' }).asset, 'tomato');
  assert.equal(resolveFoodArtwork({ id: 'soy-milk' }).category, 'legumes');
  const original = JSON.stringify(food()); resolveFoodArtwork(food()); assert.equal(JSON.stringify(food()), original);
});
test('personal food photo and category survive validation and journal reload without URI payloads', () => {
  const normalized = normalizeCustomFood({ ...food(), photo: { ...photo(), uri: 'data:secret', exif: 'private' } });
  assert.deepEqual(normalized.photo, photo()); assert.equal(normalized.artworkCategory, 'nuts');
  const journal = withCustomFood(emptyNutritionJournal(), normalized);
  const restored = normalizeNutritionJournal(JSON.parse(JSON.stringify(journal)));
  assert.deepEqual(restored.customFoods, journal.customFoods);
  assert.deepEqual(referencedPhotoIds(restored), [photo().id]);
  for (const forged of ['https://external/image', '../../file', 'file:///outside', 'data:image/jpeg;base64,secret'])
    assert.equal(normalizeCustomFood({ ...food(), photo: { ...photo(), id: forged } }), null);
  assert.equal(normalizeCustomFood({ ...food(), artworkCategory: 'arbitrary-url' }), null);
  assert.equal(normalizeCustomFood({ ...food(), photo: { ...photo(), kind: 'external' } }), null);
});
test('food image edits and library deletion preserve manual history and favorite references', () => {
  let journal = withCustomFood(emptyNutritionJournal(), food());
  journal = withIntakeEntry(journal, intake(), time);
  const originalNutrients = journal.entries[0].nutrients;
  journal = { ...journal, savedMeals: [journal.entries[0]] };
  journal = withCustomFood(journal, { ...food(), photo: photo('2234567890') });
  assert.deepEqual(new Set(referencedPhotoIds(journal)), new Set([photo().id, photo('2234567890').id]));
  journal = withoutCustomFood(journal, food().id);
  assert.deepEqual(referencedPhotoIds(journal), [photo().id]);
  journal = withoutIntakeEntry(journal, journal.entries[0].id);
  assert.deepEqual(referencedPhotoIds(journal), [photo().id]);
  assert.deepEqual(journal.savedMeals[0].nutrients, originalNutrients);
  assert.deepEqual(normalizeNutritionJournal(JSON.parse(JSON.stringify(journal))), journal);
  journal = { ...journal, savedMeals: [] };
  assert.deepEqual(referencedPhotoIds(journal), []);
});
test('photo-based catalog snapshots keep personal images after removing the live food', () => {
  const estimate = addPhotoFood(draft(), food(), { label: '半袋', grams: 30 });
  const journal = withIntakeEntry(emptyNutritionJournal(), intake({ source: 'photo_estimate', portions: [], photoEstimate: estimate }), time);
  assert.deepEqual(referencedPhotoIds(journal), [photo().id]);
  assert.deepEqual(normalizeNutritionJournal(JSON.parse(JSON.stringify(journal))), journal);
  const forged = JSON.parse(JSON.stringify(estimate)); forged.items[0].provenance.photo.id = 'https://external/photo';
  assert.equal(normalizePhotoEstimate(forged), null);
});
test('meal artwork does not pass one ingredient photo off as a composite dish photograph', () => {
  const journal = withIntakeEntry(withCustomFood(emptyNutritionJournal(), food()), intake(), time);
  assert.deepEqual(mealFoodArtwork(journal.entries).photo, photo());
  const mixed = withIntakeEntry(journal, intake({ id: 'rice-second', portions: [{ foodId: 'rice-cooked', grams: 100 }] }), time);
  assert.equal(mealFoodArtwork(mixed.entries).artworkCategory, 'mixed');
  assert.equal(mealFoodArtwork(mixed.entries).photo, undefined);
  const estimate = addPhotoFood(draft(), food(), { label: '半袋', grams: 30 });
  const imageEntry = withIntakeEntry(emptyNutritionJournal(), intake({ source: 'photo_estimate', portions: [], photoEstimate: estimate }), time);
  assert.deepEqual(mealFoodArtwork(imageEntry.entries).photo, photo());
});
