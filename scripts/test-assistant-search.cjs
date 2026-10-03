const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { normalizeDishFood } = require('../src/nutrition/dishEstimate.ts');
const { FOODS } = require('../src/nutrition/catalog.ts');
const engine = require('../src/nutrition/engine.ts');
const { assistantFoodTotals, assistantPortion } = require('../src/nutrition/assistantFood.ts');
const { withIntakeEntry } = require('../src/nutrition/journal.ts');
const { publicSourceURL } = require('../src/nutrition/sourceURL.mjs');
const dish = () => ({ id: 'custom-dish-qa', name: '番茄炒蛋（参考）', source: { kind: 'recipe_estimate', recipe: {
  description: '番茄、鸡蛋与食用油，参考配方估算', cookedGrams: 400,
  ingredients: [{ foodId: 'egg-raw', grams: 100 }, { foodId: 'tomato-raw', grams: 300 }, { foodId: 'canola-oil', grams: 10 }],
  sources: [{ title: '食谱资料', url: 'https://www.xiachufang.com/recipe/qa/' }], fetchedAt: '2026-10-02T01:00:00.000Z',
} } });
const response = raw => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(raw) } }] }), { headers: { 'content-type': 'application/json' } });
const ready = { safetyStatus: 'ready', preferences: { objective: 'maintain', pattern: 'balanced', allergens: [], riskFlags: [], screeningCompletedAt: '2026-10-02T01:00:00Z' }, targets: { calories: 2000, protein: 100, carbs: 250, fat: 60, status: 'ready' }, menu: [] };

test('dish estimates calculate from reference ingredients and cooked yield, never accept model nutrient numbers', () => {
  const value = dish(); value.per100g = { calories: 1, protein: 9999 }; const f = normalizeDishFood(value, FOODS);
  assert.equal(f.per100g.calories, 73.4); assert.equal(f.source.kind, 'recipe_estimate');
  assert.equal(f.source.origin, undefined); assert.match(f.state, /非实测/);
  assert.deepEqual(engine.normalizeCustomFood(f), f);
  assert.equal(assistantPortion(f, { quantity: 2, unit: 'bowl' }).grams, null);
  const rows = [{ food: f, grams: 200, estimated: true }, { food: f, grams: 100, estimated: true }];
  assert.equal(assistantFoodTotals(rows).nutrients.calories, 220.2);
});

test('estimates and source recipes survive persistence and historical edits independently of live food library', () => {
  const f = normalizeDishFood(dish(), FOODS), input = { id: 'intake-qa', date: '2026-10-02', slot: 'lunch', name: f.name, source: 'manual', portions: [{ foodId: f.id, grams: 200 }], customFoods: [f] };
  const j = withIntakeEntry(engine.emptyNutritionJournal(), input, '2026-10-02T01:00:00.000Z');
  const restored = engine.normalizeNutritionJournal(JSON.parse(JSON.stringify(j)));
  assert.equal(restored.entries.length, 1); assert.equal(restored.entries[0].nutrients.calories, 146.8);
  assert.deepEqual(restored.entries[0].customFoods[0].source.recipe, f.source.recipe);
  const edited = withIntakeEntry(restored, { ...input, portions: [{ foodId: f.id, grams: 100 }] });
  assert.equal(edited.entries[0].nutrients.calories, 73.4); assert.equal(restored.entries[0].nutrients.calories, 146.8);
});

test('missing source, unlisted ingredients, duplicate ingredients and invalid cooked yield cannot create foods', () => {
  for (const change of [v => v.source.recipe.sources = [], v => v.source.recipe.ingredients[0].foodId = 'fake', v => v.source.recipe.ingredients.push(v.source.recipe.ingredients[0]), v => v.source.recipe.cookedGrams = 0, v => v.source.recipe.cookedGrams = 1, v => v.source.recipe.sources[0].url = 'http://localhost/a']) {
    const value = dish(); change(value); assert.equal(normalizeDishFood(value, FOODS), null);
  }
  for (const url of ['javascript:alert(1)', 'https://127.0.0.1/a', 'https://[::1]/', 'https://secret@host.org/a', 'https://host.local/a', 'https://host.org:8080/a']) assert.equal(publicSourceURL(url), false);
});

(async () => {
  const { createWebSearch } = await import('../server/search.mjs');
  const { createNutritionServer } = await import('../server/index.mjs');
  const { searchDish } = await import('../server/dish-search.mjs');
  async function fixture(t, fetchImpl, searchApiKey = 'test-search-only') {
    const calls = [], server = createNutritionServer({ apiKey: 'test-model-only', searchApiKey, fetchImpl: async (url, init) => { calls.push({ url, init }); return fetchImpl(url, init); } });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    return { calls, async post(body, path = 'advice') { const r = await fetch(`http://127.0.0.1:${server.address().port}/v1/nutrition/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() }; } };
  }
  const searchResult = () => new Response(JSON.stringify({ results: [{ title: '配方资料', url: 'https://www.xiachufang.com/recipe/qa/', content: '番茄炒蛋由鸡蛋、番茄和食用油炒制。' }] }));
  test('Tavily missing credentials never sends a fake search or exposes secrets', async () => {
    const search = createWebSearch({ fetchImpl: () => { throw Error('must not call'); } });
    await assert.rejects(search.search('番茄炒蛋', new AbortController().signal), e => e.code === 'SEARCH_NOT_CONFIGURED');
  });
  test('Tavily official API is bounded, caches independent clones and filters executable/private URLs', async () => {
    let payload, headers, calls = 0;
    const search = createWebSearch({ apiKey: 'test-only', fetchImpl: async (_, init) => { calls++; payload = JSON.parse(init.body); headers = init.headers; return new Response(JSON.stringify({ results: [
      { title: 'bad', url: 'https://127.0.0.1/a', content: 'bad' }, { title: 'ok', url: 'https://fdc.nal.usda.gov/data-documentation.html', content: '<b>food</b>' },
      { title: 'dupe', url: 'https://fdc.nal.usda.gov/data-documentation.html', content: 'duplicate' },
    ] })); } });
    const result = await search.search('营养资料', new AbortController().signal);
    assert.equal(result.results.length, 1); assert.equal(payload.include_answer, false); assert.equal(payload.max_results, 4);
    assert.equal(headers.Authorization, 'Bearer test-only'); assert.equal(JSON.stringify(result).includes('test-only'), false);
    result.results[0].title = 'changed'; assert.equal((await search.search('营养资料', new AbortController().signal)).results[0].title, 'ok'); assert.equal(calls, 1);
  });
  test('one automatic repair can recover a valid answer without exposing failed text or taking an action', async t => {
    let call = 0;
    const app = await fixture(t, async () => response(++call === 1 ? { answer: '每天只吃一千克蛋白质', sourceIds: ['balanced'] } : { answer: '先告诉我这餐的菜名和做法，我再帮你整理记录。', sourceIds: ['balanced'] }));
    const result = await app.post({ question: '如何记录饮食？', context: ready });
    assert.equal(result.status, 200); assert.equal(call, 2); assert.match(result.body.answer, /先告诉我/); assert.equal(result.body.action, undefined);
  });
  test('search forwards question only, returns actual provider links, and never sends personal context to Tavily', async t => {
    const app = await fixture(t, async (url, init) => url.includes('tavily') ? searchResult() : response({ answer: '资料提示做法有所不同，请核对实际食材。', sourceIds: [JSON.parse(init.body).messages[0].content.match(/web-[a-f0-9]{24}/u)[0]] }));
    const result = await app.post({ question: '搜索番茄炒蛋的做法', webSearch: true, context: ready, memory: [{ kind: 'like', text: 'PRIVATE_MEMORY' }] });
    assert.equal(result.body.search.status, 'searched'); assert.equal(result.body.sources[0].url, 'https://www.xiachufang.com/recipe/qa/');
    assert.equal(JSON.stringify(app.calls[0].init.body).includes('PRIVATE_MEMORY'), false);
    assert.deepEqual(Object.keys(JSON.parse(app.calls[0].init.body)).sort(), ['auto_parameters', 'include_answer', 'include_images', 'include_raw_content', 'max_results', 'query', 'search_depth', 'topic'].sort());
  });
  test('search not configured and failed API are honest metadata, not a network-grounded answer', async t => {
    const app = await fixture(t, async () => response({ answer: '可以告诉我具体食材，再整理这餐记录。', sourceIds: ['balanced'] }), '');
    const result = await app.post({ question: '搜索食材信息', context: ready });
    assert.equal(result.body.search.status, 'unconfigured'); assert.deepEqual(result.body.searchSources, []); assert.equal(app.calls.length, 1);
  });
  test('unknown dishes search automatically through endpoint; source IDs and catalog recipe control numbers', async t => {
    const app = await fixture(t, async (url, init) => {
      if (url.includes('tavily')) return searchResult();
      const evidence = JSON.parse(JSON.parse(init.body).messages[1].content).evidence;
      const f = dish(); return response({ candidates: [{ name: f.name, ...f.source.recipe, sourceIds: [evidence[0].id], calories: 999 }], message: '' });
    });
    const result = await app.post({ name: '番茄炒蛋', state: 'cooked' }, 'search-food');
    assert.equal(result.status, 200); assert.equal(result.body.candidates[0].per100g.calories, 73.4);
    assert.equal(result.body.candidates[0].source.kind, 'recipe_estimate');
    assert.equal(result.body.grams, undefined); assert.equal(result.body.saved, undefined);
  });
  test('food profile with invented citations or missing ingredients returns a concrete refinement path', async () => {
    const result = await searchDish({ name: '未知菜', state: 'unknown' }, { signal: new AbortController().signal,
      search: async () => ({ fetchedAt: '2026-10-02T00:00:00Z', results: [{ id: 'web-a', title: 't', url: 'https://fdc.nal.usda.gov/a' }] }),
      generate: async () => ({ candidates: [{ name: 'fake', ingredients: [{ foodId: 'fake', grams: 100 }], sourceIds: ['invented'] }] }),
    });
    assert.deepEqual(result.candidates, []); assert.match(result.message, /主要食材/);
  });
})().catch(e => { console.error(e); process.exitCode = 1; });
