const assert = require('node:assert/strict');

const { test } = require('node:test');
const ts = require('typescript');

require('./lib/register-typescript.cjs')({ compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, extensions: ['.ts'] });

const { FOODS, getFood } = require('./fixtures/user-food.cjs');
const { FOOD_DATA_VERSION } = require('../src/nutrition/foodData.ts');
const engine = require('../src/nutrition/engine.ts');
const profile = {
  name: '测试', sex: 'male', age: 30, height: 175, weight: 75,
  goal: 'street_mastery', nutritionGoal: 'maintain', dietPattern: 'balanced_cn',
  frequency: 4, levels: {}, experience: 'beginner', planId: 'full', planStartedAt: '2026-09-27T00:00:00.000Z',
};
const now = '2026-09-27T08:00:00.000Z';
const date = '2026-09-27';
const prefs = (extra = {}) => ({ ...engine.defaultNutritionPreferences(profile), screeningCompletedAt: now, ...extra });
const round = n => Math.round((n + Number.EPSILON) * 10) / 10;
const totals = portions => Object.fromEntries(['calories', 'protein', 'carbs', 'fat', 'fiber'].map(key => [
  key, round(portions.reduce((sum, p) => sum + getFood(p.foodId).per100g[key] * p.grams / 100, 0)),
]));
const intake = (extra = {}) => engine.createIntakeEntry({
  id: 'entry-1', date, slot: 'lunch', name: '称重午餐',
  customFoods: FOODS, portions: [{ foodId: FOODS[0].id, grams: 120 }], source: 'manual', now, ...extra,
});

test('actual food grams drive nutrients independently of daily targets', () => {
  const portions = [{ foodId: FOODS[0].id, grams: 125 }, { foodId: FOODS[1].id, grams: 37.5 }];
  assert.deepEqual(engine.calculatePortions(portions, FOODS), totals(portions));
  assert.deepEqual(engine.calculatePortions([{ foodId: FOODS[0].id, grams: 100 }], FOODS),
    Object.fromEntries(Object.entries(FOODS[0].per100g).map(([k, n]) => [k, round(n)])));
  assert.deepEqual(engine.sumNutrients([]), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
});

test('strict portion and nutrient validation rejects silent coercion', () => {
  for (const grams of [0, -1, 2001, NaN, Infinity, '100', null]) {
    assert.throws(() => engine.calculatePortions([{ foodId: FOODS[0].id, grams }]));
  }
  for (const portions of [[], null, [{ foodId: 'unlisted', grams: 100 }], [{ foodId: '__proto__', grams: 100 }]]) {
    assert.throws(() => engine.calculatePortions(portions, FOODS));
  }
  assert.doesNotThrow(() => engine.calculatePortions([{ foodId: FOODS[0].id, grams: 2000 }], FOODS));
  assert.throws(() => engine.sumNutrients([{ calories: NaN, protein: 1, carbs: 1, fat: 1, fiber: 0 }]));
  assert.throws(() => engine.sumNutrients([{ calories: Number.MAX_VALUE, protein: 1, carbs: 1, fat: 1, fiber: 0 }]));
});

test('dates are true calendar dates and revision keys validate their slot', () => {
  for (const value of ['2024-02-29', '2000-02-29', date]) assert.equal(engine.isValidDateKey(value), true);
  for (const value of ['2026-02-29', '1900-02-29', '2026-04-31', '2026-00-10', '2026-13-01', '2026-09-00', '2026-9-27', '0000-01-01', null]) assert.equal(engine.isValidDateKey(value), false);
  assert.equal(engine.nutritionRevisionKey(date, 'lunch'), `${date}:lunch`);
  assert.throws(() => engine.nutritionRevisionKey(date, 'midnight'));
});

test('nutrition objective remains independent from training objective', () => {
  const first = engine.calculateTargets(profile, prefs({ objective: 'muscle_gain' }));
  const changed = engine.calculateTargets({ ...profile, goal: 'weight_loss', frequency: 1 }, prefs({ objective: 'muscle_gain' }));
  assert.deepEqual(first, changed);
  assert.equal(engine.defaultNutritionPreferences({ ...profile, goal: 'weight_loss' }).objective, 'maintain');
  assert.equal(engine.defaultNutritionPreferences({ ...profile, nutritionGoal: 'rapid_loss' }).objective, 'fat_loss');
});

test('adult target uses Mifflin with selected activity and modest objective changes', () => {
  const maintain = engine.calculateTargets(profile, prefs());
  assert.equal(maintain.status, 'ready');
  assert.equal(maintain.bmr, 1699);
  assert.equal(maintain.tdee, 2379);
  assert.equal(maintain.calories, maintain.tdee);
  assert.ok(maintain.protein >= 1.3 * 75 && maintain.protein <= 2 * 75);
  assert.ok(Math.abs(maintain.calories - (maintain.protein * 4 + maintain.carbs * 4 + maintain.fat * 9)) <= 5);
  const loss = engine.calculateTargets(profile, prefs({ objective: 'fat_loss' }));
  const gain = engine.calculateTargets(profile, prefs({ objective: 'muscle_gain' }));
  assert.ok(loss.calories >= maintain.tdee * .89 && loss.calories < maintain.tdee);
  assert.ok(gain.calories > maintain.tdee && gain.calories <= maintain.tdee * 1.06);
  assert.ok(engine.calculateTargets(profile, prefs({ activity: 'active' })).calories > maintain.calories);
  assert.ok(engine.calculateTargets({ ...profile, sex: 'female' }, prefs()).bmr < maintain.bmr);
});

test('risk, age, underweight and missing screening never expose numeric prescriptions', () => {
  const cases = [
    [profile, null, 'needs_setup'],
    [profile, engine.defaultNutritionPreferences(profile), 'needs_setup'],
    [{ ...profile, age: 17 }, prefs(), 'blocked'],
    [{ ...profile, weight: 45 }, prefs(), 'blocked'],
    ...['pregnancy', 'medical_condition', 'glucose_medication', 'sglt2', 'eating_disorder'].map(risk => [profile, prefs({ riskFlags: [risk] }), 'blocked']),
    ...['low_carb', 'keto'].map(pattern => [profile, prefs({ pattern }), 'unsupported']),
    ...[{ age: NaN }, { age: '30' }, { height: 0 }, { weight: Infinity }, { sex: 'unknown' }, { age: 35.5 }].map(change => [{ ...profile, ...change }, prefs(), 'needs_setup']),
  ];
  for (const [person, preferences, status] of cases) {
    const targets = engine.calculateTargets(person, preferences);
    assert.equal(targets.status, status);
    for (const key of ['calories', 'protein', 'carbs', 'fat', 'bmr', 'tdee']) assert.equal(targets[key], 0);
  }
});

test('preference imports fail closed when screening fields are incomplete or unknown', () => {
  for (const value of [null, {}, { ...prefs(), version: 2 }, { ...prefs(), objective: ['maintain'] }, { ...prefs(), riskFlags: undefined }, { ...prefs(), riskFlags: ['unknown'] }, { ...prefs(), allergens: ['unknown'] }, { ...prefs(), screeningCompletedAt: '2026-02-30T00:00:00.000Z' }]) {
    assert.equal(engine.normalizeNutritionPreferences(value), null);
  }
  const input = prefs({ allergens: ['milk', 'milk'], riskFlags: ['sglt2', 'sglt2'] });
  assert.deepEqual(engine.normalizeNutritionPreferences(input).allergens, ['milk']);
  assert.equal(input.allergens.length, 2);
});

test('intake stores independent portions and nutrient snapshots with dataset version', () => {
  const portions = [{ foodId: FOODS[0].id, grams: 100 }];
  const entry = intake({ portions });
  assert.equal(entry.foodDataVersion, FOOD_DATA_VERSION);
  assert.equal(entry.createdAt, now);
  assert.deepEqual(entry.nutrients, totals(portions));
  portions[0].grams = 500;
  assert.equal(entry.portions[0].grams, 100);
  assert.throws(() => intake({ date: '2026-02-30' }));
  assert.throws(() => intake({ source: 'planned_meal' }));
  assert.throws(() => intake({ now: 'yesterday' }));
  assert.throws(() => intake({ id: '__proto__' }));
});

test('journal preserves historic nutrients/version and discarded food IDs from an older dataset', () => {
  const entry = intake();
  entry.foodDataVersion = 'historical-db-v0';
  entry.nutrients = { calories: 111, protein: 12, carbs: 13, fat: 4, fiber: 1 };
  entry.portions[0].foodId = 'retired-food-id';
  delete entry.customFoods;
  const input = { ...engine.emptyNutritionJournal(), preferences: prefs(), entries: [entry] };
  const normalized = engine.normalizeNutritionJournal(input);
  assert.deepEqual(normalized.entries, [entry]);
  normalized.entries[0].nutrients.calories = 200;
  normalized.entries[0].portions[0].grams = 140;
  assert.equal(entry.nutrients.calories, 111);
  assert.equal(entry.portions[0].grams, 120);
});

test('journal rejects corrupt records, deduplicates source imports, and filters revision keys', () => {
  const entry = intake({ source: 'planned_meal', sourceKey: `${date}:lunch:recipe:0` });
  const broken = [
    { ...entry, id: 'bad-1', nutrients: { ...entry.nutrients, calories: NaN } },
    { ...entry, id: 'bad-2', customFoods: FOODS, portions: [{ foodId: FOODS[0].id, grams: -2 }] },
    { ...entry, id: 'bad-3', date: '2026-02-30' },
    { ...entry, id: 'bad-4', nutrients: { ...entry.nutrients, calories: 1000000 } },
    { ...entry, id: 'bad-5', customFoods: FOODS, portions: [{ foodId: 'not-in-current-db', grams: 100 }] },
    { ...entry, id: 'bad-6', createdAt: 'bad-time' },
  ];
  const input = { version: 1, preferences: prefs(), entries: [entry, entry, { ...entry, id: 'duplicate-source', sourceKey: 'another-recipe' }, ...broken], mealRevisions: {
    [`${date}:lunch`]: 2, '2026-02-30:lunch': 1, [`${date}:snack`]: -1, [`${date}:dinner`]: 1.5, '__proto__': 1,
  } };
  const normalized = engine.normalizeNutritionJournal(input);
  assert.deepEqual(normalized.entries, [{ ...entry, sourceKey: engine.nutritionRevisionKey(date, 'lunch') }]);
  assert.equal(Object.hasOwn(normalized, 'mealRevisions'), false);
  assert.deepEqual(engine.normalizeNutritionJournal({ ...input, version: 2 }), engine.emptyNutritionJournal());
});
