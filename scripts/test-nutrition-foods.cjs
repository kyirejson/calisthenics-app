const assert = require('node:assert/strict');
const fs = require('node:fs');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const ts = require('typescript');

// Read/transpile in memory only; no generated files, network or user data.
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { FOODS, RECIPES, getFood, FOOD_DATA_VERSION } = require('../src/nutrition/catalog.ts');
const { getFoodServings, SERVING_ESTIMATE_NOTE } = require('../src/nutrition/servings.ts');
const nutrientIds = { calories: [1008, 2048], protein: [1003], carbs: [1005], fat: [1004], fiber: [1079, 2033] };

assert.equal(FOODS.length, 101, 'review and version this snapshot if the catalog changes');
assert.equal(RECIPES.length, 20, 'this expansion must preserve existing recipes');
assert.equal(FOOD_DATA_VERSION, 'usda-foundation-2026-04_sr-legacy-2018-04_foods-v3_recipes-v1');
assert.equal(new Set(FOODS.map(food => food.id)).size, FOODS.length);
assert.match(SERVING_ESTIMATE_NOTE, /估量.*不是推荐摄入量/);
const allowedAllergens = ['milk', 'egg', 'soy', 'wheat', 'peanut', 'tree_nut', 'fish', 'shellfish'];
for (const food of FOODS) {
  assert.ok(food.name && food.state && food.aliases.length);
  assert.match(food.source.foodCode, /^FDC \d+(?: \/ NDB \d{5})?$/);
  const fdcId = food.source.foodCode.match(/^FDC (\d+)/)[1];
  assert.equal(food.source.url, 'https://fdc.nal.usda.gov/food-details/' + fdcId + '/nutrients');
  assert.equal(food.source.license, 'CC0-1.0');
  assert.ok(food.allergens.every(value => allowedAllergens.includes(value)));
  for (const key of Object.keys(nutrientIds)) assert.ok(Number.isFinite(food.per100g[key]) && food.per100g[key] >= 0, food.id + '/' + key);
  const servings = getFoodServings(food.id);
  assert.ok(servings.length >= 2, food.id + ' needs usable portion choices');
  assert.equal(new Set(servings.map(value => value.label)).size, servings.length);
  for (const serving of servings) {
    assert.match(serving.label, /约/);
    assert.ok(Number.isFinite(serving.grams) && serving.grams > 0 && serving.grams <= 2000);
    assert.ok(Object.values(food.per100g).every(value => Number.isFinite(value * serving.grams / 100)));
  }
  const original = servings[0].grams;
  servings[0].grams = -1;
  assert.equal(getFoodServings(food.id)[0].grams, original, 'servings must return defensive copies');
}
assert.deepEqual(getFoodServings('custom-or-unknown-food'), []);
assert.deepEqual(getFood('egg-noodles-cooked').allergens, ['wheat', 'egg']);
assert.deepEqual(getFood('soy-sauce-shoyu').allergens, ['soy', 'wheat']);
assert.deepEqual(getFood('shrimp-cooked').allergens, ['shellfish']);
assert.match(getFood('salt-table').name + getFood('salt-table').state, /不统计钠/);
assert.ok(getFood('rice-cooked').per100g.calories < getFood('rice-raw').per100g.calories);
assert.notEqual(getFood('egg-boiled').per100g.calories, getFood('egg-raw').per100g.calories);
for (const recipe of RECIPES) for (const portion of recipe.ingredients) {
  assert.ok(getFood(portion.foodId), recipe.id + '/' + portion.foodId);
  assert.ok(portion.grams > 0 && Number.isFinite(portion.grams));
  if (recipe.vegetarian) assert.ok(getFood(portion.foodId).vegetarian);
}
for (const query of ['面条', '土豆', '熟鸡胸', '水煮蛋', '猪肉', '牛肉', '糖', '酱油', '盐']) {
  assert.ok(FOODS.some(food => [food.name, ...food.aliases].some(value => value.includes(query))), 'missing search ' + query);
}
console.log('PASS catalog: 101 foods, 20 unchanged recipes, source metadata, cooked states, allergens, 202 independent serving choices');

function readOfficialArchive(filename, expectedHash) {
  const archive = fs.readFileSync(filename);
  assert.equal(crypto.createHash('sha256').update(archive).digest('hex'), expectedHash, 'official snapshot checksum differs');
  let end = archive.length - 22;
  while (end >= Math.max(0, archive.length - 65557) && archive.readUInt32LE(end) !== 0x06054b50) end--;
  assert.ok(end >= 0 && archive.readUInt32LE(end) === 0x06054b50, 'ZIP directory missing');
  let offset = archive.readUInt32LE(end + 16);
  for (let i = 0; i < archive.readUInt16LE(end + 10); i++) {
    assert.equal(archive.readUInt32LE(offset), 0x02014b50);
    const nameLength = archive.readUInt16LE(offset + 28), extraLength = archive.readUInt16LE(offset + 30), commentLength = archive.readUInt16LE(offset + 32);
    const name = archive.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    if (name.endsWith('.json')) {
      const local = archive.readUInt32LE(offset + 42);
      const start = local + 30 + archive.readUInt16LE(local + 26) + archive.readUInt16LE(local + 28);
      const bytes = archive.subarray(start, start + archive.readUInt32LE(offset + 20));
      const method = archive.readUInt16LE(offset + 10);
      assert.ok(method === 0 || method === 8, 'unsupported ZIP compression');
      const data = JSON.parse((method === 8 ? zlib.inflateRawSync(bytes) : bytes).toString('utf8'));
      return Object.values(data).find(Array.isArray);
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error('USDA JSON missing');
}

// Optional exact source verification; the full archives are NOT bundled into the app.
// node scripts/test-nutrition-foods.cjs --source-archives <Foundation ZIP> <SR Legacy ZIP>
if (process.argv[2] === '--source-archives') {
  assert.equal(process.argv.length, 5, 'provide both official archives');
  const foundation = readOfficialArchive(process.argv[3], '186e988ec542e913f51ef62b86a47758e8cdd0d1dc3889e7b055581f3c09c77a');
  const sr = readOfficialArchive(process.argv[4], '0fe8ae486a2c8eb42cb96413f058deb51863a46c8fb8eeb4b1fb45006dd338ef');
  // Some archive arrays contain null separators; they are not food records.
  const sources = new Map([...foundation, ...sr].filter(row => row && Number.isInteger(row.fdcId)).map(row => [row.fdcId, row]));
  for (const food of FOODS) {
    const id = Number(food.source.foodCode.match(/^FDC (\d+)/)[1]);
    const source = sources.get(id);
    assert.ok(source, food.id + ' official FDC ID missing');
    assert.equal(food.source.title, 'USDA FoodData Central — ' + source.description);
    assert.ok((food.source.version.startsWith('Foundation') ? foundation : sr).includes(source));
    const ndb = food.source.foodCode.match(/NDB (\d+)/)?.[1];
    if (ndb) assert.equal(ndb, String(source.ndbNumber).padStart(5, '0'));
    for (const [key, ids] of Object.entries(nutrientIds)) {
      const record = ids.map(id => source.foodNutrients.find(value => value.nutrient.id === id)).find(Boolean);
      assert.ok(record && Number.isFinite(record.amount), food.id + '/' + key + ' missing in official source; do not substitute zero');
      assert.equal(food.per100g[key], record.amount, food.id + '/' + key);
    }
  }
  // Representative household-unit values are verified independently of per100g data.
  const officialPortions = [
    [173424, 'large', 1, 50], [172688, 'slice', 1, 32], [169655, 'tsp', 1, 4.2],
    [172336, 'tsp', 1, 4.5], [172336, 'tbsp', 1, 14], [174277, 'tbsp', 1, 16],
    [172237, 'tbsp', 1, 14.9], [169640, 'tbsp', 1, 21], [171267, 'cup', 1, 244],
    [172217, 'cup', 1, 244], [168484, 'medium', 1, 151], [169118, 'medium', 1, 178],
    [168153, 'fruit (2" dia)', 1, 69], [174683, 'grapes', 10, 49],
    [1105314, 'Peeled', 1, 115], [748967, 'whole without shell', 1, 50.3],
  ];
  for (const [id, modifier, amount, weight] of officialPortions) {
    assert.ok(sources.get(id).foodPortions.some(portion => portion.modifier === modifier && portion.amount === amount && portion.gramWeight === weight), 'official household weight ' + id);
  }
  console.log('PASS official archives: SHA-256 checked; 101 IDs, source descriptions, release membership, NDB codes, 505 nutrients and 16 household weights verified exactly');
}
