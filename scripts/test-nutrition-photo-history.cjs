const { test } = require('node:test');
// Compatibility for previously recorded photos/food snapshots, not a capture feature.
const assert = require('node:assert/strict'), Module = require('node:module');
const ts = require('typescript');
require('./lib/register-typescript.cjs')({ compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, extensions: ['.ts'] });
const { createCustomFoodFromLabel, emptyNutritionJournal, normalizeNutritionJournal } = require('../src/nutrition/engine.ts');
const { withIntakeEntry, withCustomFood, withoutCustomFood, withoutIntakeEntry } = require('../src/nutrition/journal.ts');
const { normalizeFoodLabelDraft } = require('../src/nutrition/foodImport.ts');
const { normalizePhotoEstimate, replacePhotoItemWithFood, setPhotoItemGrams, scalePhotoItem, applyPhotoCorrection, photoPortionSummary, photoUsesOnlyLabels } = require('../src/nutrition/vision.ts');
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
test('historic package metadata retains unknown mass and rejects invalid values', () => {
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

