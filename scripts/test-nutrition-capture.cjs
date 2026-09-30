const { test } = require('node:test');
const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file);
const { createCustomFoodFromLabel, emptyNutritionJournal, normalizeNutritionJournal } = require('../src/nutrition/engine.ts');
const { withIntakeEntry, withCustomFood, withoutCustomFood, withoutIntakeEntry } = require('../src/nutrition/journal.ts');
const { normalizeFoodLabelDraft } = require('../src/nutrition/foodImport.ts');
const { normalizePhotoEstimate, replacePhotoItemWithFood, setPhotoItemGrams, scalePhotoItem, applyPhotoCorrection, photoPortionSummary, photoUsesOnlyLabels } = require('../src/nutrition/vision.ts');
const { captureServings } = require('../src/nutrition/captureServings.ts');
const { normalizeNutritionPhotos, referencedPhotoIds } = require('../src/nutrition/photoMetadata.ts');
const { summarizeMealSlots } = require('../src/nutrition/presentation.ts');
const time = '2026-09-29T01:30:00.000Z', clone = value => JSON.parse(JSON.stringify(value));
const origin = { provider: 'label_photo', identifier: 'deepseek-flash', fetchedAt: time, url: '', license: 'user-entered' };
const label = { name: '盐焗腰果仁', state: '开袋即食', basisUnit: 'g', basisAmount: 100, energyUnit: 'kJ', calories: 2515,
  protein: 23, carbs: 20, fat: 47, fiber: null, serving: null, packageGrams: 60, allergens: ['tree_nut'], warnings: [], origin };
const food = (patch = {}) => createCustomFoodFromLabel({ id: 'custom-cashew-capture', name: label.name, basisGrams: 100, energyUnit: 'kJ',
  calories: 2515, protein: 23, carbs: 20, fat: 47, allergens: ['tree_nut'], packageGrams: 60, origin, ...patch });
const visual = (patch = {}) => ({ id: 'capture-original', model: 'test-vision', items: [{ name: label.name, portionLabel: '照片一份',
  nutrients: { calories: 180, protein: 5, carbs: 7, fat: 15, fiber: 1 }, calorieRange: { min: 120, max: 250 }, ...patch }], assumptions: [], warnings: [] });
const entry = (estimate = visual(), patch = {}) => ({ id: 'test-capture-intake', date: '2026-09-29', slot: 'lunch', name: label.name,
  source: 'photo_estimate', portions: [], photoEstimate: estimate, ...patch });
const photo = (suffix = '1234567890') => ({ id: 'nutrition-photo-' + suffix, kind: 'food', capturedAt: time });
const { normalizeIngredientRecognition, createIngredientReview, calculateIngredients, ingredientIssue, matchIngredient, referenceServings } = require('../src/nutrition/ingredientCapture.ts');
const { summarizePhotoEstimate } = require('../src/nutrition/vision.ts');
const recognition = (patch = {}) => ({ kind: 'ingredients', id: 'ingredients-test', model: 'offline-vision', dishName: '番茄炒鸡蛋', needsOilReview: true,
  ingredients: [{ name: '鸡蛋', state: 'raw', role: 'food', estimatedGrams: null, count: 2 }, { name: '番茄', state: 'raw', role: 'food', estimatedGrams: 250, count: 2 }], warnings: [], ...patch });
const readyRows = () => { const rows = createIngredientReview(recognition()); rows[2].grams = 10; return rows; };

test('ingredient recognition accepts candidates only, strips no model nutrient claims into calculations', () => {
  assert.ok(normalizeIngredientRecognition(recognition()));
  for (const patch of [{ calories: 276 }, { id: '../bad' }, { ingredients: [] }, { needsOilReview: 'true' }]) assert.equal(normalizeIngredientRecognition(recognition(patch)), null);
  assert.equal(normalizeIngredientRecognition(recognition({ ingredients: [{ ...recognition().ingredients[0], nutrients: { calories: 276 } }] })), null);
});
test('ingredient matching respects raw/cooked and unknowns, never uses a similar whole-dish recipe', () => {
  assert.equal(matchIngredient(recognition().ingredients[0]).id, 'egg-raw');
  assert.equal(matchIngredient({ ...recognition().ingredients[0], state: 'unknown' }), null);
  assert.equal(matchIngredient({ ...recognition().ingredients[0], name: '番茄炒鸡蛋盖饭' }), null);
  for (const name of ['鱼肉', '鸡肉']) assert.equal(matchIngredient({ ...recognition().ingredients[0], name }), null);
  const candidate = { ...recognition().ingredients[0], name: '鸡蛋' };
  assert.equal(matchIngredient(candidate, [{ ...food(), name: '鸡蛋', aliases: [] }, { ...food(), id: 'custom-duplicate', name: '鸡蛋', aliases: [] }]), null);
});
test('hidden cooking oil starts unknown and blocks calculation until explicitly selected', () => {
  const rows = createIngredientReview(recognition());
  assert.equal(rows[0].grams, 100.6); assert.equal(rows[1].grams, 250);
  assert.equal(rows[2].grams, null); assert.match(ingredientIssue(rows), /用油/);
  assert.throws(() => calculateIngredients(recognition(), rows, 1), /用油/);
  rows[2].grams = 0; assert.equal(ingredientIssue(rows), null);
  assert.equal(calculateIngredients(recognition(), rows, 1).items.length, 2);
});
test('real food snapshots, not mockup 276 kcal, determine decomposed tomato eggs', () => {
  const estimate = calculateIngredients(recognition(), readyRows(), 1);
  assert.equal(estimate.calculation, 'ingredients'); assert.equal(estimate.dishName, '番茄炒鸡蛋');
  assert.equal(summarizePhotoEstimate(estimate).nutrients.calories, 284.8);
  assert.ok(estimate.items.every(item => item.provenance.kind === 'catalog' && item.provenance.rangeBasis === 'reference-portion'));
  assert.equal(estimate.items[0].provenance.foodId, 'egg-raw');
  assert.equal(normalizePhotoEstimate(estimate).calculation, 'ingredients');
});
test('counts, oil and eaten fraction change actual nutrients independently', () => {
  const rows = readyRows(), total = summarizePhotoEstimate(calculateIngredients(recognition(), rows, 1)).nutrients;
  const half = summarizePhotoEstimate(calculateIngredients(recognition(), rows, .5)).nutrients;
  assert.equal(half.calories, 142.4); assert.ok(half.protein < total.protein);
  rows[2].grams = 5; const lessOil = summarizePhotoEstimate(calculateIngredients(recognition(), rows, 1)).nutrients;
  assert.equal(lessOil.protein, total.protein); assert.equal(lessOil.calories, 240.6);
  rows[0].grams = 150.9; assert.ok(summarizePhotoEstimate(calculateIngredients(recognition(), rows, 1)).nutrients.protein > total.protein);
});
test('unmatched ingredients and unknown quantities never become default 100g', () => {
  const draft = recognition({ needsOilReview: false, ingredients: [{ name: '未知混合菜', state: 'unknown', role: 'food', estimatedGrams: null, count: null }] });
  const rows = createIngredientReview(draft); assert.equal(rows[0].food, null); assert.equal(rows[0].grams, null);
  assert.throws(() => calculateIngredients(draft, rows, 1), /食品库/);
  for (const grams of [NaN, -1, 2001]) { const rows = readyRows(); rows[0].grams = grams; assert.throws(() => calculateIngredients(recognition(), rows, 1)); }
  assert.throws(() => calculateIngredients(recognition(), readyRows(), .3));
});
test('personal foods can be matched and use their own declared serving', () => {
  const personal = food({ serving: { label: '厂家一份', grams: 45 } });
  assert.equal(referenceServings(personal)[0].grams, 45);
  const draft = recognition({ needsOilReview: false, ingredients: [{ name: label.name, state: 'unknown', role: 'food', estimatedGrams: 30, count: null }] });
  const rows = createIngredientReview(draft, [personal]); assert.equal(rows[0].food.id, personal.id);
  assert.equal(summarizePhotoEstimate(calculateIngredients(draft, rows, 1)).nutrients.calories, 180.3);
});
test('ingredient result survives journal reload with source and dish name, labels remain distinct', () => {
  const estimate = calculateIngredients(recognition(), readyRows(), 1);
  const journal = withIntakeEntry(emptyNutritionJournal(), entry(estimate, { name: estimate.dishName }), time);
  const restored = normalizeNutritionJournal(clone(journal));
  assert.equal(restored.entries[0].photoEstimate.dishName, '番茄炒鸡蛋');
  assert.equal(restored.entries[0].photoEstimate.calculation, 'ingredients');
  assert.equal(restored.entries[0].nutrients.calories, 284.8);
  assert.equal(photoUsesOnlyLabels(restored.entries[0].photoEstimate), false);
});

test('cashew label converts kJ and 30g deterministically, not by inverse image calories', () => {
  const result = replacePhotoItemWithFood(visual(), 0, food(), { label: '半包', grams: 30 });
  assert.equal(result.items[0].nutrients.calories, 180.3);
  assert.equal(result.items[0].nutrients.protein, 6.9);
  assert.equal(result.items[0].estimatedGrams, 30);
  assert.equal(result.items[0].provenance.packageGrams, 60);
  assert.equal(result.items[0].provenance.fiberKnown, false);
  assert.equal(photoUsesOnlyLabels(result), true);
  assert.deepEqual(result.items[0].calorieRange, { min: 180.3, max: 180.3 });
  assert.match(photoPortionSummary(result), /30g/);
  assert.equal(setPhotoItemGrams(result, 0, 100).items[0].nutrients.calories, 601.1);
  assert.equal(visual().items[0].nutrients.protein, 5);
});
test('package fractions use actual net weight, never the per100g basis or manufacturer serving', () => {
  assert.deepEqual(captureServings(food()).slice(0, 3), [{ label: '整包', grams: 60 }, { label: '半包', grams: 30 }, { label: '四分之一包', grams: 15 }]);
  const withoutWeight = food({ packageGrams: undefined, serving: { label: '厂家一份', grams: 45 } });
  assert.ok(!captureServings(withoutWeight).some(portion => /包/.test(portion.label)));
  assert.ok(!captureServings(withoutWeight).some(portion => portion.grams === 100));
  assert.equal(normalizeFoodLabelDraft({ ...label, packageGrams: null }).packageGrams, null);
  for (const packageGrams of [0, -1, 2001, '60']) assert.equal(normalizeFoodLabelDraft({ ...label, packageGrams }), null);
});
test('old photos remain unknown mass; caloric match does not fabricate a 30g estimate', () => {
  const restored = normalizePhotoEstimate(visual());
  assert.equal(restored.items[0].estimatedGrams, undefined);
  assert.match(photoPortionSummary(restored), /份量未知/);
  assert.throws(() => setPhotoItemGrams(restored, 0, 30), /重量基准/);
  assert.match(photoPortionSummary(scalePhotoItem(restored, 0, .5)), /份量未知/);
});
test('visual grams are explicit estimates, validated and scaled without becoming label measurements', () => {
  assert.equal(normalizePhotoEstimate(visual({ estimatedGrams: null })).items[0].estimatedGrams, null);
  for (const estimatedGrams of [0, -1, 2001, '30']) assert.equal(normalizePhotoEstimate(visual({ estimatedGrams })), null);
  const updated = setPhotoItemGrams(visual({ estimatedGrams: 30 }), 0, 15);
  assert.equal(updated.items[0].nutrients.calories, 90);
  assert.equal(updated.items[0].estimatedGrams, 15);
  assert.equal(photoUsesOnlyLabels(updated), false);
  assert.match(photoPortionSummary(updated), /估计15g/);
});
test('personal-label snapshots and unknown fiber survive library edit, delete, and JSON restart', () => {
  const result = replacePhotoItemWithFood(visual(), 0, food(), { label: '半包', grams: 30 });
  let journal = withCustomFood(emptyNutritionJournal(), food());
  journal = withIntakeEntry(journal, entry(result), time);
  assert.equal(journal.entries[0].fiberIncomplete, true);
  journal = withCustomFood(journal, food({ calories: 2000 })); journal = withoutCustomFood(journal, food().id);
  assert.deepEqual(normalizeNutritionJournal(clone(journal)), journal);
  assert.equal(journal.entries[0].photoEstimate.items[0].provenance.source.origin.url, '');
  assert.equal(journal.entries[0].nutrients.calories, 180.3);
  const forged = clone(result); forged.items[0].estimatedGrams = 100;
  assert.equal(normalizePhotoEstimate(forged), null);
});
test('reshoot replaces only the selected food; multiple new foods cannot clobber a meal', () => {
  const original = { ...visual(), items: [visual().items[0], { ...visual().items[0], name: '其他食物' }] };
  const correction = replacePhotoItemWithFood(visual(), 0, food(), { label: '半包', grams: 30 });
  const updated = applyPhotoCorrection(original, 0, correction);
  assert.equal(updated.id, original.id);
  assert.deepEqual(updated.items[1], original.items[1]);
  assert.equal(updated.items[0].nutrients.protein, 6.9);
  assert.throws(() => applyPhotoCorrection(original, 0, original), /一项/);
  assert.throws(() => applyPhotoCorrection(original, 2, correction), /移除/);
});
test('photo metadata accepts only owned opaque IDs, bounded attachments, valid dates, no data payload', () => {
  assert.deepEqual(normalizeNutritionPhotos(undefined), []);
  for (const id of ['file:///outside', '../../file', 'https://external/photo', 'data:image/jpeg;base64,private']) assert.equal(normalizeNutritionPhotos([{ ...photo(), id }]), null);
  assert.equal(normalizeNutritionPhotos([photo(), photo()]), null);
  assert.equal(normalizeNutritionPhotos([photo(), photo('2234567890'), photo('3234567890'), photo('4234567890')]), null);
  assert.equal(normalizeNutritionPhotos([{ ...photo(), capturedAt: '2026-02-30T00:00:00Z' }]), null);
  assert.deepEqual(normalizeNutritionPhotos([{ ...photo(), image: 'data:PRIVATE' }]), [photo()]);
});
test('editing preserves photo references, explicit removal clears them, favorites retain shared files', () => {
  const journal = withIntakeEntry(emptyNutritionJournal(), entry(visual(), { photos: [photo()] }), time);
  const edited = withIntakeEntry(journal, entry(visual(), { slot: 'dinner' }), time);
  assert.deepEqual(edited.entries[0].photos, [photo()]);
  assert.deepEqual(normalizeNutritionJournal(clone(edited)), edited);
  const removed = withIntakeEntry(edited, entry(visual(), { photos: [] }), time);
  assert.deepEqual(referencedPhotoIds(removed), []);
  const favorite = { ...journal.entries[0], id: 'favorite-cashew', savedAt: time };
  const withFavorite = { ...journal, savedMeals: [favorite] };
  assert.deepEqual(referencedPhotoIds(withoutIntakeEntry(withFavorite, journal.entries[0].id)), [photo().id]);
});
test('label calculations are not presented as visual calorie estimates', () => {
  const result = replacePhotoItemWithFood(visual(), 0, food(), { label: '半包', grams: 30 });
  const journal = withIntakeEntry(emptyNutritionJournal(), entry(result), time);
  assert.equal(summarizeMealSlots(journal.entries)[0].containsPhoto, false);
  const mixed = withIntakeEntry(journal, entry(visual(), { id: 'visual-2' }), time);
  assert.equal(summarizeMealSlots(mixed.entries)[0].containsPhoto, true);
});

// Mock only native file boundaries; exercise real storage/rollback code without touching a user's files.
const files = new Map(), removedIds = [];
const loader = Module._load;
Module._load = function(name, parent, isMain) {
  if (name === 'react-native') return { Platform: { OS: 'android' } };
  if (name === 'expo-file-system') return { Paths: { document: 'owned-document' }, Directory: class { create() {} }, File: class {
    constructor(...parts) { this.uri = parts.join('/'); } get exists() { return files.has(this.uri); }
    create() { if (this.exists) throw Error('already exists'); files.set(this.uri, null); }
    write(bytes) { files.set(this.uri, bytes); } delete() { removedIds.push(this.uri); files.delete(this.uri); }
  } };
  return loader.call(this, name, parent, isMain);
};
const { withCapturedPhoto, saveNutritionPhoto, nutritionPhotoURI, deleteStoredPhotos } = require('../src/nutrition/photoStorage.ts');
Module._load = loader;
const jpeg = 'data:image/jpeg;base64,/9j/2Q==';
test('no opt-in means no photo saved; commit failure rolls back only its new asset', async () => {
  const initial = files.size;
  await withCapturedPhoto({ dataUrl: jpeg, capturedAt: Date.parse(time) }, false, async value => assert.equal(value, undefined));
  assert.equal(files.size, initial);
  const kept = await saveNutritionPhoto(jpeg, 'food', time);
  await assert.rejects(() => withCapturedPhoto({ dataUrl: jpeg, capturedAt: Date.parse(time) }, true, async () => { throw Error('journal failed'); }), /journal failed/);
  assert.equal(files.size, initial + 1); assert.ok(await nutritionPhotoURI(kept.id));
  await deleteStoredPhotos(['../../outside', kept.id]); assert.equal(files.size, initial);
  assert.ok(removedIds.every(uri => uri.startsWith('owned-document/nutrition-photos/nutrition-photo-')));
});
test('invalid capture metadata and image bytes fail before any record commit', async () => {
  let called = false;
  await assert.rejects(() => withCapturedPhoto({ dataUrl: 'data:image/jpeg;base64,eHg=', capturedAt: Date.parse(time) }, true, async () => { called = true; }));
  await assert.rejects(() => saveNutritionPhoto(jpeg, 'untrusted', time));
  assert.equal(called, false);
  assert.equal(await nutritionPhotoURI('file:///outside'), null);
});

(async () => {
  const { createNutritionServer } = await import('../server/index.mjs');
  const { validateIngredientResult } = await import('../server/validation.mjs');
  test('smart photo detection reads a label in one paid call, high detail, safe source assigned by server', async t => {
    let calls = 0, payload;
    const modelLabel = { ...label }; delete modelLabel.origin;
    const server = createNutritionServer({ apiKey: 'offline-only', model: 'deepseek-flash', fetchImpl: async (url, init) => {
      calls++; payload = JSON.parse(init.body);
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ kind: 'label', label: modelLabel }) } }] }));
    } });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=';
    const response = await fetch(`http://127.0.0.1:${server.address().port}/v1/nutrition/analyze-photo`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ imageDataUrl: PNG }) });
    const result = await response.json(); assert.equal(response.status, 200);
    assert.equal(result.kind, 'label'); assert.equal(result.draft.calories, 2515); assert.equal(result.draft.packageGrams, 60);
    assert.equal(result.draft.origin.provider, 'label_photo'); assert.equal(result.draft.origin.url, '');
    assert.equal(result.items, undefined); assert.equal(calls, 1);
    assert.equal(payload.messages[1].content[1].image_url.detail, 'high');
  });
  test('server ingredient contract never accepts a whole-dish nutrient guess or invents missing mass', () => {
    const bare = { kind: 'ingredients', dishName: '腰果', needsOilReview: false, ingredients: [{ name: '腰果', state: 'unknown', role: 'food', count: null, estimatedGrams: null }], warnings: [] };
    assert.equal(validateIngredientResult(bare).ingredients[0].estimatedGrams, null);
    for (const estimatedGrams of [-1, 0, 2001, '30']) assert.throws(() => validateIngredientResult({ ...bare, ingredients: [{ ...bare.ingredients[0], estimatedGrams }] }));
    assert.throws(() => validateIngredientResult({ items: visual().items, assumptions: [], warnings: [] }));
  });
})();
