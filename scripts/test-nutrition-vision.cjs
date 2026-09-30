const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { normalizePhotoEstimate, summarizePhotoEstimate, scalePhotoItem } = require('../src/nutrition/vision.ts');
const { emptyNutritionJournal, normalizeNutritionJournal } = require('../src/nutrition/engine.ts');
const { withIntakeEntry, withoutIntakeEntry } = require('../src/nutrition/journal.ts');
const photo = () => ({ id: 'meal-vision-test', model: 'test-model', items: [{ name: '鸡肉饭', portionLabel: '照片中的一碗',
  nutrients: { calories: 560, protein: 35, carbs: 65, fat: 17, fiber: 5 }, calorieRange: { min: 430, max: 700 } }],
  assumptions: ['普通碗装'], warnings: ['用油量无法由照片确认'] });
const entry = (patch = {}) => ({ id: 'photo-meal-vision-test', date: '2026-09-27', slot: 'lunch', name: '鸡肉饭', portions: [], source: 'photo_estimate', photoEstimate: photo(), ...patch });
const now = '2026-09-27T03:00:00.000Z';

test('photo results validate finite values and retain estimates without invented database matches', () => {
  assert.deepEqual(normalizePhotoEstimate(photo()), photo());
  for (const value of [NaN, Infinity, -1, '560', 10001]) {
    const input = photo(); input.items[0].nutrients.calories = value;
    assert.equal(normalizePhotoEstimate(input), null);
  }
  for (const change of [{ min: 600, max: 800 }, { min: -1, max: 700 }, { min: 400, max: 559 }]) {
    const input = photo(); input.items[0].calorieRange = change;
    assert.equal(normalizePhotoEstimate(input), null);
  }
  assert.equal(normalizePhotoEstimate({ ...photo(), items: [] }), null);
  assert.equal(normalizePhotoEstimate({ ...photo(), items: Array(13).fill(photo().items[0]) }), null);
  const impossible = photo();
  impossible.items[0].nutrients = { calories: 0, protein: 100, carbs: 100, fat: 100, fiber: 0 };
  impossible.items[0].calorieRange = { min: 0, max: 0 };
  assert.equal(normalizePhotoEstimate(impossible), null);
});

test('fraction controls scale calories, all macros and range together, without mutating the original', () => {
  const original = photo(); const half = scalePhotoItem(original, 0, 0.5);
  assert.equal(half.items[0].nutrients.calories, 280);
  assert.equal(half.items[0].nutrients.protein, 17.5);
  assert.equal(half.items[0].nutrients.fat, 8.5);
  assert.equal(half.items[0].calorieRange.min, 215);
  assert.deepEqual(original, photo());
  assert.deepEqual(summarizePhotoEstimate(original).nutrients, original.items[0].nutrients);
  for (const factor of [-1, 0, NaN, Infinity, 4]) assert.throws(() => scalePhotoItem(original, 0, factor));
});

test('photo recording persists a bounded snapshot with no image payload, and survives restart', () => {
  const result = photo(); result.imageDataUrl = 'data:image/jpeg;base64,PRIVATE';
  result.items[0].photo = 'file:///private-capture.jpg';
  const journal = withIntakeEntry(emptyNutritionJournal(), entry({ photoEstimate: result }), now);
  const record = journal.entries[0];
  assert.equal(record.source, 'photo_estimate');
  assert.equal(record.foodDataVersion, 'vision-estimate-v1');
  assert.deepEqual(record.portions, []);
  assert.deepEqual(record.nutrients, photo().items[0].nutrients);
  assert.equal(JSON.stringify(journal).includes('PRIVATE'), false);
  assert.equal(JSON.stringify(journal).includes('private-capture'), false);
  assert.deepEqual(normalizeNutritionJournal(JSON.parse(JSON.stringify(journal))), journal);
});

test('repeated photo confirmation is idempotent and editing changes both snapshot and aggregate', () => {
  const before = withIntakeEntry(emptyNutritionJournal(), entry(), now);
  const after = withIntakeEntry(before, entry(), now);
  assert.equal(after.entries.length, 1);
  const updated = withIntakeEntry(after, entry({ photoEstimate: scalePhotoItem(photo(), 0, 0.5), slot: 'dinner' }), now);
  assert.equal(updated.entries[0].nutrients.calories, 280);
  assert.equal(updated.entries[0].slot, 'dinner');
  assert.deepEqual(normalizeNutritionJournal(updated), updated);
  assert.equal(withoutIntakeEntry(updated, updated.entries[0].id).entries.length, 0);
});

test('corrupt estimated records cannot silently change daily totals on reload', () => {
  const original = withIntakeEntry(emptyNutritionJournal(), entry(), now);
  const tampered = JSON.parse(JSON.stringify(original)); tampered.entries[0].nutrients.calories = 999;
  assert.equal(normalizeNutritionJournal(tampered).entries.length, 0);
  assert.throws(() => withIntakeEntry(original, entry({ photoEstimate: null }), now));
  assert.equal(original.entries[0].nutrients.calories, 560);
});

test('photo intake does not claim a planned meal slot or overwrite a weighed record', () => {
  const manual = withIntakeEntry(emptyNutritionJournal(), { id: 'weighed', date: '2026-09-27', slot: 'lunch', name: '燕麦', portions: [{ foodId: 'oats-dry', grams: 50 }], source: 'planned_meal' }, now);
  const combined = withIntakeEntry(manual, entry(), now);
  assert.equal(combined.entries.length, 2);
  assert.equal(combined.entries[0].sourceKey, undefined);
  assert.deepEqual(combined.entries[1], manual.entries[0]);
});

test('voice owns microphone permission without gallery blocking it; food camera remains photo-only', () => {
  const app = JSON.parse(fs.readFileSync(require('node:path').join(__dirname, '../app.json'), 'utf8')).expo;
  const camera = app.plugins.find(item => item[0] === 'expo-camera')[1];
  const picker = app.plugins.find(item => item[0] === 'expo-image-picker')[1];
  assert.equal(typeof camera.cameraPermission, 'string');
  assert.equal(picker.cameraPermission, camera.cameraPermission);
  assert.match(camera.microphonePermission, /麦克风.*饮食描述/u);
  assert.equal(camera.recordAudioAndroid, false);
  assert.match(picker.microphonePermission, /麦克风.*饮食描述/u);
  const speech = app.plugins.find(item => item[0] === 'expo-speech-recognition')[1];
  assert.equal(speech.microphonePermission, camera.microphonePermission);
  assert.match(speech.speechRecognitionPermission, /语音/u);
  const capture = fs.readFileSync(require('node:path').join(__dirname, '../src/components/nutrition/FoodCaptureCamera.tsx'), 'utf8');
  assert.doesNotMatch(capture, /useMicrophonePermissions|recordAsync|requestMicrophonePermissions/u);
});

test('server code and secrets are excluded from mobile cloud build archives', () => {
  const ignore = fs.readFileSync(require('node:path').join(__dirname, '../.easignore'), 'utf8');
  assert.ok(ignore.split(/\r?\n/).includes('/server/'));
});
