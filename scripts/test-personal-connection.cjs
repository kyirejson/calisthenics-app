const assert = require('node:assert/strict'), { test } = require('node:test');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { createPersonalTransport } = require('../src/agent/personalTransport.mjs');
const runtime = require('../src/agent/connectionRuntime.mjs');
const { readBoundedJSON } = require('../src/agent/httpJSON.mjs');
const config = { mode: 'personal', model: 'deepseek-flash', deepseekKey: 'sk-isolated-test-only', tavilyKey: 'tvly-isolated-test-only' };
const ready = { safetyStatus: 'ready', preferences: { objective: 'maintain', pattern: 'balanced', allergens: [], riskFlags: [], screeningCompletedAt: '2026-10-02T01:00:00Z' }, targets: { calories: 2000, protein: 100, carbs: 250, fat: 60, status: 'ready' }, menu: [] };
const response = raw => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(raw) } }] }), { headers: { 'content-type': 'application/json' } });
const search = () => new Response(JSON.stringify({ results: [{ title: '食谱资料', url: 'https://www.xiachufang.com/recipe/qa/', content: '番茄、鸡蛋、少量食用油炒制。' }] }));

test('connection summary never exposes keys, whitelist models, and malformed keys fail without installing', () => {
  runtime.installConnection(config); const summary = runtime.connectionSummary();
  assert.deepEqual(summary, { mode: 'personal', provider: 'deepseek', model: 'deepseek-flash', hasDeepseek: true, hasTavily: true, hasGlm: false });
  assert.equal(JSON.stringify(summary).includes('test-only'), false);
  assert.throws(() => runtime.installConnection({ ...config, deepseekKey: 'https://untrusted' }), /格式/);
  assert.equal(runtime.getConnection().deepseekKey, config.deepseekKey);
  assert.equal(runtime.normalizeConnection({ model: 'untrusted', mode: 'anything' }).model, 'deepseek-flash');
});
test('unconfigured health is presence only, does not contact a gateway or pretend verified connectivity', async () => {
  const transport = createPersonalTransport({ config: {}, fetchImpl: () => assert.fail('network not allowed') });
  const status = await transport.request('/health'); assert.equal(status.configured, false); assert.equal(status.readiness, 'unconfigured');
  await assert.rejects(transport.testConnection('deepseek'), /尚未配置/);
  assert.equal((await createPersonalTransport({ config }).request('/health')).readiness, 'degraded');
  await assert.rejects(createPersonalTransport({ config: { ...config, deepseekKey: '' }, fetchImpl: () => assert.fail('search must not spend credits without model key') }).request('/v1/nutrition/advice', { question: '搜索训练资料', context: ready }), /尚未配置/);
});
test('explicit tests send minimal payload to fixed official provider, never archives or other provider credentials', async () => {
  const calls = [], transport = createPersonalTransport({ config, fetchImpl: async (url, init) => {
    calls.push({ url, init }); return url.includes('deepseek') ? response({ ok: true }) : search();
  } });
  assert.match(await transport.testConnection('deepseek'), /不代表图片/); await transport.testConnection('tavily');
  assert.equal(calls[0].url, 'https://api.deepseek.com/chat/completions'); assert.equal(calls[0].init.headers.Authorization, 'Bearer ' + config.deepseekKey);
  assert.equal(JSON.stringify(calls[0]).includes(config.tavilyKey), false); assert.equal(JSON.parse(calls[0].init.body).max_tokens, 32);
  assert.equal(calls[1].url, 'https://api.tavily.com/search'); assert.equal(calls[1].init.headers.Authorization, 'Bearer ' + config.tavilyKey);
  assert.equal(JSON.stringify(calls[1]).includes(config.deepseekKey), false);
});
test('provider errors are sanitized, no raw response body, no silent developer gateway fallback', async () => {
  for (const [status, text] of [[401, /密钥无效/], [402, /余额不足/], [429, /额度受限/], [500, /暂不可用/]]) {
    const transport = createPersonalTransport({ config, fetchImpl: async () => new Response(config.deepseekKey, { status }) });
    await assert.rejects(transport.testConnection('deepseek'), error => text.test(error.message) && !error.message.includes(config.deepseekKey));
  }
});
test('search question is isolated from private context and citations derive from real provider sources', async () => {
  const calls = [], transport = createPersonalTransport({ config, fetchImpl: async (url, init) => {
    calls.push({ url, init });
    if (url.includes('tavily')) return search();
    return response({ answer: '资料中的配方不等于你实际吃的菜，请核对主要食材。', sourceIds: [JSON.parse(init.body).messages[0].content.match(/web-[a-f0-9]{24}/u)[0]] });
  } });
  const result = await transport.request('/v1/nutrition/advice', { question: '搜索番茄炒蛋做法', context: ready, memory: [{ kind: 'like', text: 'PRIVATE_FACT' }], webSearch: true });
  assert.equal(result.search.status, 'searched'); assert.equal(result.sources[0].url, 'https://www.xiachufang.com/recipe/qa/');
  assert.equal(calls.length, 2); assert.equal(calls[0].init.body.includes('PRIVATE_FACT'), false); assert.equal(calls[1].init.body.includes('PRIVATE_FACT'), true);
});
test('personal transport automatically repairs invalid model output and never asserts an unexecuted operation', async () => {
  let calls = 0; const transport = createPersonalTransport({ config, fetchImpl: async () => response(++calls === 1 ? { answer: '早餐必须吃3000卡路里', sourceIds: ['invented'] } : { answer: '不必补齐四餐，可以先记录你想记录的食物。', sourceIds: ['balanced'] }) });
  const result = await transport.request('/v1/nutrition/advice', { question: '如何记录饮食？', context: ready });
  assert.equal(calls, 2); assert.match(result.answer, /不必补齐/); assert.equal(result.intent, undefined); assert.equal(result.action, undefined);
});
test('explicit optional meal and training intents are candidate-only and need no paid model call', async () => {
  const transport = createPersonalTransport({ config: {}, fetchImpl: () => assert.fail('network not allowed') });
  const skipped = await transport.request('/v1/nutrition/advice', { question: '早餐我没吃', context: {}, assistantMode: true });
  assert.equal(skipped.intent.type, 'meal_status'); assert.equal(skipped.intent.status, 'not_eaten'); assert.equal(skipped.saved, undefined);
  const training = await transport.request('/v1/nutrition/advice', { question: '今天训练减载', context: {}, assistantMode: true });
  assert.equal(training.intent.type, 'training_adjustment');
  const negated = await transport.request('/v1/nutrition/advice', { question: '我没有鸡蛋过敏', context: {}, assistantMode: true }); assert.equal(negated.intent, undefined);
});
test('unknown dish search recomputes nutrients from catalog; quantity remains absent until the user confirms', async () => {
  const transport = createPersonalTransport({ config, fetchImpl: async (url, init) => {
    if (url.includes('tavily')) return search();
    const evidence = JSON.parse(JSON.parse(init.body).messages[1].content).evidence;
    return response({ candidates: [{ name: '番茄炒蛋', description: '参考配方', cookedGrams: 400, ingredients: [{ foodId: 'egg-raw', grams: 100 }, { foodId: 'tomato-raw', grams: 300 }, { foodId: 'canola-oil', grams: 10 }], sourceIds: [evidence[0].id], calories: 999 }] });
  } });
  const result = await transport.request('/v1/nutrition/search-food', { name: '番茄炒蛋', state: 'cooked' });
  assert.equal(result.candidates[0].per100g.calories, 73.4); assert.equal(result.saved, undefined); assert.equal(result.grams, undefined);
  await assert.rejects(createPersonalTransport({ config: { ...config, tavilyKey: '' } }).request('/v1/nutrition/search-food', { name: '未知菜' }), /Tavily/);
});
test('bounded JSON handles native text fallback and streaming, rejects UTF8 bytes beyond the budget', async () => {
  assert.deepEqual(await readBoundedJSON({ headers: new Headers(), text: async () => '{"ok":true}' }, 40), { ok: true });
  await assert.rejects(readBoundedJSON({ headers: new Headers(), text: async () => JSON.stringify('汉'.repeat(20)) }, 50), /large/);
  await assert.rejects(readBoundedJSON(new Response('a'.repeat(100)), 20), /large/);
});
test('direct photo label uses shared validation and untrusted model URLs never become provenance', async () => {
  const label = { name: '包装食品', state: '开袋即食', basisUnit: 'g', basisAmount: 100, energyUnit: 'kcal', calories: 200, protein: 10, carbs: 20, fat: 8, fiber: null, serving: null, allergens: ['milk'], warnings: [] };
  let payload;
  const transport = createPersonalTransport({ config, fetchImpl: async (_, init) => { payload = JSON.parse(init.body); return response({ kind: 'label', label }); } });
  const result = await transport.request('/v1/nutrition/analyze-photo', { imageDataUrl: 'data:image/jpeg;base64,/9j/2Q==' });
  assert.equal(result.kind, 'label'); assert.equal(result.draft.origin.provider, 'label_photo'); assert.equal(result.draft.fiber, null);
  assert.equal(payload.messages[1].content[1].type, 'image_url');
  await assert.rejects(createPersonalTransport({ config, fetchImpl: async () => response({ ...label, url: 'https://invented.example' }) }).request('/v1/nutrition/read-label', { imageDataUrl: 'data:image/jpeg;base64,/9j/2Q==' }));
  await assert.rejects(transport.request('/v1/nutrition/analyze-photo', { imageDataUrl: 'https://private.example/image' }));
});
test('barcode calls fixed public dataset without either model or search key; results are attributed packaging drafts', async () => {
  const code = '3017620422003'; let request;
  const product = { status: 'success', result: { id: 'product_found' }, product: { code, product_name_zh: '隔离测试', nutrition: { input_sets: [{ source: 'packaging', preparation: 'as_sold', per: '100g', per_quantity: 100, per_unit: 'g', nutrients: { 'energy-kcal': { unit: 'kcal', value: 200 }, proteins: { unit: 'g', value: 10 }, carbohydrates: { unit: 'g', value: 20 }, fat: { unit: 'g', value: 8 } } }] }, allergens_tags: [] } };
  const transport = createPersonalTransport({ config, fetchImpl: async (url, init) => { request = { url, init }; return new Response(JSON.stringify(product)); } });
  const result = await transport.request('/v1/nutrition/lookup-barcode', { barcode: code });
  assert.equal(result.origin.provider, 'open_food_facts'); assert.equal(result.origin.identifier, code);
  assert.equal(request.init.headers.Authorization, undefined); assert.equal(JSON.stringify(request).includes('test-only'), false);
  assert.ok(request.url.startsWith('https://world.openfoodfacts.org/api/v3.6/product/' + code));
});
test('caller cancellation interrupts personal paid requests without leaking credentials or invoking fallback', async () => {
  const controller = new AbortController();
  const transport = createPersonalTransport({ config, fetchImpl: async (_, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(Error(config.deepseekKey)), { once: true })) });
  const task = transport.testConnection('deepseek', controller.signal); controller.abort(); await assert.rejects(task, /已取消/);
});

function vault(platform = 'android', options = {}) {
  const runtimePath = path.resolve(__dirname, '../src/agent/connectionRuntime.mjs');
  const isolated = {}; vm.runInNewContext(ts.transpileModule(fs.readFileSync(runtimePath, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: isolated, Set, Object, Error });
  let saved = options.saved || null; const writes = [];
  const store = { isAvailableAsync: async () => true, getItemAsync: async () => saved, WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'this-device',
    setItemAsync: async (key, value, flags) => { if (options.failWrite) throw Error('native error'); writes.push({ key, value, flags }); saved = value; },
    deleteItemAsync: async () => { if (options.failDelete) throw Error('native error'); saved = null; } };
  const exports = {}, file = path.resolve(__dirname, '../src/agent/credentials.ts');
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: id => id === 'react-native' ? { Platform: { OS: platform } } : id === 'expo-secure-store' ? store : isolated, Promise, Error, JSON,
      window: { location: { hostname: 'example.org' } } });
  return { api: exports, runtime: isolated, writes, saved: () => saved };
}
test('native credentials load/write/delete only system vault; write failure does not activate unpersisted keys', async () => {
  const h = vault('android', { saved: JSON.stringify(config) }); await h.api.loadAgentConnection(); assert.equal(h.api.currentAgentConnection().deepseekKey, config.deepseekKey);
  await h.api.saveAgentConnection(config); assert.equal(h.writes.length, 1); assert.equal(h.writes[0].flags.keychainAccessible, 'this-device');
  await h.runtime.resetAgentConnection(); assert.equal(h.saved(), null); assert.equal(h.api.currentAgentConnection().deepseekKey, '');
  const failed = vault('android', { failWrite: true }); await failed.api.loadAgentConnection(); await assert.rejects(failed.api.saveAgentConnection(config), /未保存/); assert.equal(failed.api.currentAgentConnection().deepseekKey, '');
});
test('failed key deletion reports failure and retains runtime; browser keys never write persistent storage', async () => {
  const failed = vault('ios', { saved: JSON.stringify(config), failDelete: true }); await failed.api.loadAgentConnection();
  await assert.rejects(failed.runtime.resetAgentConnection(), /清除失败/); assert.equal(failed.api.currentAgentConnection().deepseekKey, config.deepseekKey);
  const web = vault('web'); await web.api.saveAgentConnection(config); assert.equal(web.writes.length, 0); assert.equal(web.saved(), null);
  assert.equal(web.api.currentAgentConnection().deepseekKey, config.deepseekKey);
});

test('GLM shares one vault key across fixed official chat/search endpoints, without sending private context to search', async () => {
  const cfg = { ...config, provider: 'glm', model: 'glm-4.7', glmKey: 'isolated-glm-id.isolated-glm-secret' };
  const calls = [], transport = createPersonalTransport({ config: cfg, fetchImpl: async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith('/web_search')) return new Response(JSON.stringify({ search_result: [
      { title: '真实检索资料', link: 'https://fdc.nal.usda.gov/data-documentation.html', content: '食品数据应核对状态和可食重量。' },
      { title: '拒绝私网', link: 'http://127.0.0.1/private', content: '不能作为来源。' },
    ] }));
    const body = JSON.parse(init.body), source = body.messages[0].content.match(/web-[a-f0-9]{24}/u)?.[0];
    return response(body.max_tokens === 32 ? { ok: true } : { answer: '请核对食品状态和实际可食重量。', sourceIds: [source] });
  } });
  assert.match(await transport.testConnection('model'), /智谱/);
  const result = await transport.request('/v1/nutrition/advice', { question: '搜索食品重量资料', context: ready, memory: [{ kind: 'like', text: 'PRIVATE_FACT' }], webSearch: true });
  assert.equal(result.search.count, 1); assert.equal(result.sources[0].url, 'https://fdc.nal.usda.gov/data-documentation.html');
  assert.equal(calls.length, 3); assert.equal(calls[1].url, 'https://open.bigmodel.cn/api/paas/v4/web_search');
  const query = JSON.parse(calls[1].init.body); assert.equal(query.search_intent, false); assert.equal(query.count, 4); assert.equal(query.search_query.includes('PRIVATE_FACT'), false);
  assert.ok(calls.every(call => call.init.headers.Authorization === 'Bearer ' + cfg.glmKey));
  assert.ok(calls.every(call => !JSON.stringify(call).includes(config.deepseekKey) && !JSON.stringify(call).includes(config.tavilyKey)));
  await assert.rejects(transport.request('/v1/nutrition/analyze-photo', { imageDataUrl: 'data:image/jpeg;base64,/9j/2Q==' }), /不支持照片/);
  assert.equal(calls.length, 3, 'unsupported vision must fail locally without a paid call');
  const h = vault(); await h.api.saveAgentConnection(cfg); assert.equal(h.api.currentAgentConnection().glmKey, cfg.glmKey);
  await h.runtime.resetAgentConnection(); assert.equal(h.saved(), null); assert.equal(h.api.currentAgentConnection().glmKey, '');
});
test('GLM malformed keys/models fail closed and search errors never expose upstream secrets', async () => {
  assert.throws(() => runtime.normalizeConnection({ provider: 'glm', glmKey: 'url/invalid' }), /格式/);
  assert.equal(runtime.normalizeConnection({ provider: 'glm', model: 'deepseek-flash' }).model, 'glm-4.7');
  const cfg = { provider: 'glm', glmKey: 'isolated-glm-id.isolated-glm-secret' };
  const transport = createPersonalTransport({ config: cfg, fetchImpl: async () => new Response(cfg.glmKey, { status: 403 }) });
  await assert.rejects(transport.testConnection('search'), e => e.message.includes('智谱') && !e.message.includes(cfg.glmKey));
});
