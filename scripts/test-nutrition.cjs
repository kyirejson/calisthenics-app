const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  module._compile(output, filename);
};

const { FOODS, RECIPES, FOOD_DATA_VERSION, getFood } = require('../src/nutrition/catalog.ts');
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
  portions: [{ foodId: FOODS[0].id, grams: 120 }], source: 'manual', now, ...extra,
});

test('food records and every recipe have complete traceable nutrient inputs', () => {
  assert.ok(FOODS.length >= 15);
  assert.equal(new Set(FOODS.map(item => item.id)).size, FOODS.length);
  assert.equal(new Set(RECIPES.map(item => item.id)).size, RECIPES.length);
  for (const food of FOODS) {
    assert.ok(food.state && food.source.url.startsWith('https://') && food.source.foodCode && food.source.version && food.source.license);
    for (const key of ['calories', 'protein', 'carbs', 'fat', 'fiber']) assert.ok(Number.isFinite(food.per100g[key]) && food.per100g[key] >= 0, `${food.id}/${key}`);
  }
  for (const recipe of RECIPES) {
    assert.ok(recipe.ingredients.length && recipe.slots.length && recipe.steps.length);
    assert.deepEqual(engine.calculatePortions(recipe.ingredients), totals(recipe.ingredients));
    if (recipe.vegetarian) assert.ok(recipe.ingredients.every(item => getFood(item.foodId).vegetarian));
  }
});

test('actual food grams drive nutrients independently of daily targets', () => {
  const portions = [{ foodId: FOODS[0].id, grams: 125 }, { foodId: FOODS[1].id, grams: 37.5 }];
  assert.deepEqual(engine.calculatePortions(portions), totals(portions));
  assert.deepEqual(engine.calculatePortions([{ foodId: FOODS[0].id, grams: 100 }]),
    Object.fromEntries(Object.entries(FOODS[0].per100g).map(([k, n]) => [k, round(n)])));
  assert.deepEqual(engine.sumNutrients([]), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
});

test('strict portion and nutrient validation rejects silent coercion', () => {
  for (const grams of [0, -1, 2001, NaN, Infinity, '100', null]) {
    assert.throws(() => engine.calculatePortions([{ foodId: FOODS[0].id, grams }]));
  }
  for (const portions of [[], null, [{ foodId: 'unlisted', grams: 100 }], [{ foodId: '__proto__', grams: 100 }]]) {
    assert.throws(() => engine.calculatePortions(portions));
  }
  assert.doesNotThrow(() => engine.calculatePortions([{ foodId: FOODS[0].id, grams: 2000 }]));
  assert.throws(() => engine.sumNutrients([{ calories: NaN, protein: 1, carbs: 1, fat: 1, fiber: 0 }]));
  assert.throws(() => engine.sumNutrients([{ calories: Number.MAX_VALUE, protein: 1, carbs: 1, fat: 1, fiber: 0 }]));
});

test('dates are true calendar dates and revision keys validate their slot', () => {
  for (const value of ['2024-02-29', '2000-02-29', date]) assert.equal(engine.isValidDateKey(value), true);
  for (const value of ['2026-02-29', '1900-02-29', '2026-04-31', '2026-00-10', '2026-13-01', '2026-09-00', '2026-9-27', '0000-01-01', null]) assert.equal(engine.isValidDateKey(value), false);
  assert.equal(engine.nutritionRevisionKey(date, 'lunch'), `${date}:lunch`);
  assert.throws(() => engine.nutritionRevisionKey(date, 'midnight'));
  assert.throws(() => engine.planDailyMenu(profile, prefs(), '2026-02-30'));
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
    const menu = engine.planDailyMenu(person, preferences, date);
    assert.equal(menu.meals.length, 0);
    assert.equal(menu.totals.calories, 0);
    assert.ok(menu.warnings.length);
  }
});

test('preference imports fail closed when screening fields are incomplete or unknown', () => {
  for (const value of [null, {}, { ...prefs(), version: 2 }, { ...prefs(), objective: ['maintain'] }, { ...prefs(), riskFlags: undefined }, { ...prefs(), riskFlags: ['unknown'] }, { ...prefs(), allergens: ['unknown'] }, { ...prefs(), screeningCompletedAt: '2026-02-30T00:00:00.000Z' }, { ...prefs(), maxCookingMinutes: '30' }]) {
    assert.equal(engine.normalizeNutritionPreferences(value), null);
  }
  const input = prefs({ allergens: ['milk', 'milk'], riskFlags: ['sglt2', 'sglt2'] });
  assert.deepEqual(engine.normalizeNutritionPreferences(input).allergens, ['milk']);
  assert.equal(input.allergens.length, 2);
});

test('daily menus are deterministic, bounded, and sum displayed food quantities', () => {
  const first = engine.planDailyMenu(profile, prefs(), date);
  assert.deepEqual(first, engine.planDailyMenu(profile, prefs(), date));
  assert.equal(first.meals.length, 4);
  assert.deepEqual(first.totals, engine.sumNutrients(first.meals.map(meal => meal.nutrients)));
  for (const meal of first.meals) {
    assert.deepEqual(meal.nutrients, totals(meal.ingredients));
    const recipe = RECIPES.find(item => item.id === meal.recipeId);
    assert.equal(meal.ingredients.length, recipe.ingredients.length);
    meal.ingredients.forEach((portion, index) => {
      assert.equal(portion.foodId, recipe.ingredients[index].foodId);
      assert.ok(portion.grams >= recipe.ingredients[index].grams * .65 - .1);
      assert.ok(portion.grams <= Math.min(2000, recipe.ingredients[index].grams * 1.8) + .1);
    });
  }
  assert.ok(first.totals.calories >= first.targets.calories * .85 && first.totals.calories <= first.targets.calories * 1.15,
    `ordinary profile energy gap: ${first.totals.calories}/${first.targets.calories}`);
  assert.ok(first.totals.protein >= first.targets.protein * .85, `ordinary protein gap: ${first.totals.protein}/${first.targets.protein}`);
  const month = new Set(Array.from({ length: 10 }, (_, index) => engine.planDailyMenu(profile, prefs(), `2026-09-${String(index + 1).padStart(2, '0')}`).meals.map(meal => meal.recipeId).join(',')));
  assert.ok(month.size >= 3, 'date must affect the actual recipes, not only a signature');
});

test('single-slot swap changes its recipe without changing other slots or earlier objects', () => {
  const original = engine.planDailyMenu(profile, prefs(), date);
  const originalJson = JSON.stringify(original);
  const revisions = { [engine.nutritionRevisionKey(date, 'lunch')]: 1 };
  const swapped = engine.planDailyMenu(profile, prefs(), date, revisions);
  assert.notEqual(original.meals.find(item => item.slot === 'lunch').recipeId, swapped.meals.find(item => item.slot === 'lunch').recipeId);
  assert.deepEqual(original.meals.filter(item => item.slot !== 'lunch'), swapped.meals.filter(item => item.slot !== 'lunch'));
  assert.equal(JSON.stringify(original), originalJson);
  assert.deepEqual(swapped, engine.planDailyMenu(profile, prefs(), date, revisions));
});

test('allergy, vegetarian, time and budget filters apply on generation and swap', () => {
  for (const vegetarian of [false, true]) for (const maxCookingMinutes of [15, 30, 45]) for (const budget of ['economy', 'standard']) {
    const preferences = prefs({ pattern: vegetarian ? 'vegetarian' : 'balanced', allergens: ['milk', 'egg'], maxCookingMinutes, budget });
    for (const revision of [0, 1, 2]) {
      const menu = engine.planDailyMenu(profile, preferences, date, Object.fromEntries(['breakfast', 'lunch', 'snack', 'dinner'].map(slot => [engine.nutritionRevisionKey(date, slot), revision])));
      for (const meal of menu.meals) {
        assert.ok(meal.minutes <= maxCookingMinutes);
        const recipe = RECIPES.find(item => item.id === meal.recipeId);
        if (budget === 'economy') assert.equal(recipe.budget, 'economy');
        for (const portion of meal.ingredients) {
          const food = getFood(portion.foodId);
          assert.ok(!food.allergens.includes('milk') && !food.allergens.includes('egg'));
          if (vegetarian) assert.equal(food.vegetarian, true);
        }
      }
      if (menu.meals.length < 4) assert.ok(menu.warnings.some(message => message.includes('不完整')));
    }
  }
});

test('unreachable targets are reported honestly instead of fabricated totals', () => {
  const menu = engine.planDailyMenu({ ...profile, weight: 280, height: 200 }, prefs({ activity: 'active', maxCookingMinutes: 15, budget: 'economy', pattern: 'vegetarian', allergens: ['milk', 'egg', 'soy', 'wheat', 'peanut', 'tree_nut'] }), date);
  assert.deepEqual(menu.totals, engine.sumNutrients(menu.meals.map(meal => engine.calculatePortions(meal.ingredients))));
  assert.ok(menu.warnings.length);
  assert.ok(menu.totals.calories !== menu.targets.calories);
});

test('macro-aware portions fit ordinary meals and disclose large gaps after constrained swaps', () => {
  const person = { ...profile, sex: 'female', weight: 65, height: 165 };
  const preferences = prefs({ pattern: 'vegetarian', objective: 'fat_loss' });
  const day = '2026-09-06';
  const swapped = engine.planDailyMenu(person, preferences, day, {
    [engine.nutritionRevisionKey(day, 'lunch')]: 4,
    [engine.nutritionRevisionKey(day, 'snack')]: 4,
  });
  assert.deepEqual(swapped.totals, engine.sumNutrients(swapped.meals.map(meal => totals(meal.ingredients))));
  for (const [key, label] of [['carbs', '碳水化合物'], ['fat', '脂肪']]) {
    if (Math.abs(swapped.totals[key] - swapped.targets[key]) > swapped.targets[key] * .25) {
      assert.ok(swapped.warnings.some(message => message.includes(label)), `${key} gap must be visible`);
    }
  }
  for (const objective of ['maintain', 'fat_loss', 'muscle_gain']) for (const pattern of ['balanced', 'vegetarian']) {
    const normal = engine.planDailyMenu(person, prefs({ objective, pattern }), date);
    assert.ok(Math.abs(normal.totals.carbs - normal.targets.carbs) <= normal.targets.carbs * .25 || normal.warnings.some(message => message.includes('碳水化合物')));
    assert.ok(Math.abs(normal.totals.fat - normal.targets.fat) <= normal.targets.fat * .25 || normal.warnings.some(message => message.includes('脂肪')));
    assert.ok(normal.totals.protein >= normal.targets.protein * .85 || normal.warnings.some(message => message.includes('蛋白质')));
  }
});

test('baseline menu varies main foods and discloses objective-direction conflicts', () => {
  const person = { ...profile, height: 180, weight: 90 };
  const maintain = engine.planDailyMenu(person, prefs({ activity: 'active' }), '2026-09-05');
  assert.notEqual(maintain.meals.find(meal => meal.slot === 'lunch').recipeId, maintain.meals.find(meal => meal.slot === 'dinner').recipeId);
  for (const foodId of ['chickpeas-canned', 'egg-raw']) {
    assert.ok(maintain.meals.filter(meal => meal.ingredients.some(portion => portion.foodId === foodId)).length <= 2,
      'ordinary baseline must not rely on legumes or eggs throughout the entire day');
  }
  const day = '2026-09-02';
  const gainPrefs = prefs({ activity: 'active', objective: 'muscle_gain' });
  const gain = engine.planDailyMenu(person, gainPrefs, day);
  assert.ok(gain.meals.filter(meal => meal.ingredients.some(portion => portion.foodId === 'egg-raw')).length <= 2);
  if (gain.totals.calories < gain.targets.tdee) assert.ok(gain.warnings.some(message => message.includes('增肌目标')));
  // All alternatives must keep the other baseline slots frozen, not just revision 1.
  for (const slot of ['breakfast', 'lunch', 'snack', 'dinner']) {
    const swapped = engine.planDailyMenu(person, gainPrefs, day, { [engine.nutritionRevisionKey(day, slot)]: 4 });
    assert.deepEqual(swapped.meals.filter(meal => meal.slot !== slot), gain.meals.filter(meal => meal.slot !== slot));
    if (swapped.totals.fiber > 50) assert.ok(swapped.warnings.some(message => message.includes('膳食纤维')));
    if (swapped.totals.calories < swapped.targets.tdee) assert.ok(swapped.warnings.some(message => message.includes('增肌目标')));
  }
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
    { ...entry, id: 'bad-2', portions: [{ foodId: FOODS[0].id, grams: -2 }] },
    { ...entry, id: 'bad-3', date: '2026-02-30' },
    { ...entry, id: 'bad-4', nutrients: { ...entry.nutrients, calories: 1000000 } },
    { ...entry, id: 'bad-5', portions: [{ foodId: 'not-in-current-db', grams: 100 }] },
    { ...entry, id: 'bad-6', createdAt: 'bad-time' },
  ];
  const input = { version: 1, preferences: prefs(), entries: [entry, entry, { ...entry, id: 'duplicate-source', sourceKey: 'another-recipe' }, ...broken], mealRevisions: {
    [`${date}:lunch`]: 2, '2026-02-30:lunch': 1, [`${date}:snack`]: -1, [`${date}:dinner`]: 1.5, '__proto__': 1,
  } };
  const normalized = engine.normalizeNutritionJournal(input);
  assert.deepEqual(normalized.entries, [{ ...entry, sourceKey: engine.nutritionRevisionKey(date, 'lunch') }]);
  assert.deepEqual(normalized.mealRevisions, { [`${date}:lunch`]: 2 });
  assert.deepEqual(engine.normalizeNutritionJournal({ ...input, version: 2 }), engine.emptyNutritionJournal());
});
