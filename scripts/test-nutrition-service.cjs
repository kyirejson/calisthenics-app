const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=';
const PHOTO = { imageDataUrl: PNG, note: '这份米饭吃了一半。' };
const NUTRIENTS = { calories: 180, protein: 3.5, carbs: 39, fat: 0.4, fiber: 0.5 };
const RESULT = {
  kind: 'ingredients', dishName: '米饭', needsOilReview: false,
  ingredients: [{ name: '米饭', state: 'cooked', role: 'food', estimatedGrams: 140, count: null }], warnings: [],
};
const READY = {
  safetyStatus: 'ready', preferences: { version: 1, objective: 'maintain', pattern: 'balanced', activity: 'light', allergens: [], riskFlags: [], screeningCompletedAt: '2026-09-27T01:00:00.000Z', maxCookingMinutes: 30, budget: 'standard' },
  targets: { calories: 2000, protein: 100, carbs: 280, fat: 60, bmr: 1500, tdee: 2000, status: 'ready', message: '起点估算' },
  consumed: NUTRIENTS, menu: [{ slot: 'lunch', name: '米饭配蔬菜', nutrients: NUTRIENTS }],
};
const clone = value => JSON.parse(JSON.stringify(value));
function upstream(value, outer = {}) {
  return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) } }], ...outer }), { status: 200, headers: { 'content-type': 'application/json' } });
}

async function main() {
  const { createNutritionServer } = await import(pathToFileURL(path.resolve(__dirname, '../server/index.mjs')).href);
  async function fixture(t, options = {}) {
    const calls = [];
    const server = createNutritionServer({ apiKey: 'offline-test-only', model: 'deepseek-flash', corsOrigins: ['http://localhost:8081', 'http://127.0.0.1:8081'], fetchImpl: async (url, init) => { calls.push({ url, init }); return upstream(RESULT); }, ...options });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const base = `http://127.0.0.1:${server.address().port}`;
    const post = async (body = PHOTO, endpoint = '/v1/nutrition/analyze-photo', headers = {}) => {
      const response = await fetch(base + endpoint, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
      return { response, body: await response.json() };
    };
    return { server, base, calls, post };
  }

  test('health reports only non-secret configuration, missing key fails safely', async t => {
    const app = await fixture(t, { apiKey: '' });
    const response = await fetch(app.base + '/health');
    assert.deepEqual(await response.json(), { configured: false, provider: 'deepseek', model: 'deepseek-flash' });
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const result = await app.post();
    assert.equal(result.response.status, 503);
    assert.equal(result.body.error.code, 'SERVICE_NOT_CONFIGURED');
    assert.equal(app.calls.length, 0);
  });

  test('photo uses a vision payload but returns only ingredient candidates, never meal nutrients', async t => {
    const app = await fixture(t);
    const { response, body } = await app.post();
    assert.equal(response.status, 200);
    assert.match(body.id, /^[a-zA-Z0-9_-]+$/);
    assert.equal(body.model, 'deepseek-flash');
    assert.deepEqual(body.ingredients, RESULT.ingredients);
    assert.equal(body.items, undefined);
    assert.equal(body.kind, 'ingredients');
    assert.match(body.warnings[0], /估计/);
    assert.equal(body.foodDataVersion, undefined);
    const call = app.calls[0];
    assert.equal(call.url, 'https://api.deepseek.com/chat/completions');
    const payload = JSON.parse(call.init.body);
    assert.deepEqual(payload.response_format, { type: 'json_object' });
    assert.deepEqual(payload.thinking, { type: 'disabled' });
    assert.equal(payload.messages[1].content[1].type, 'image_url');
    assert.equal(payload.messages[1].content[1].image_url.url, PNG);
    assert.equal(payload.max_tokens, 3500);
    assert.equal(call.init.redirect, 'error');
  });

  test('CORS permits only configured origins and a limited preflight', async t => {
    const app = await fixture(t);
    const valid = await app.post(PHOTO, undefined, { Origin: 'http://localhost:8081' });
    assert.equal(valid.response.headers.get('access-control-allow-origin'), 'http://localhost:8081');
    const forbidden = await app.post(PHOTO, undefined, { Origin: 'https://untrusted.example' });
    assert.equal(forbidden.response.status, 403);
    assert.equal(forbidden.response.headers.get('access-control-allow-origin'), null);
    const empty = await app.post(PHOTO, undefined, { Origin: 'null' });
    assert.equal(empty.response.status, 403);
    const preflight = await fetch(app.base + '/v1/nutrition/advice', { method: 'OPTIONS', headers: { Origin: 'http://127.0.0.1:8081', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } });
    assert.equal(preflight.status, 204);
    const wrong = await fetch(app.base + '/v1/nutrition/advice', { method: 'OPTIONS', headers: { Origin: 'http://localhost:8081', 'Access-Control-Request-Headers': 'authorization' } });
    assert.equal(wrong.status, 403);
    assert.equal(app.calls.length, 1);
  });

  test('DNS rebinding Host is rejected before paid requests', async t => {
    const app = await fixture(t);
    const result = await new Promise((resolve, reject) => {
      const req = http.request(app.base + '/health', { headers: { Host: 'attacker.example' } }, res => {
        let data = ''; res.on('data', chunk => { data += chunk; }); res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
      }); req.on('error', reject); req.end();
    });
    assert.equal(result.status, 403);
    assert.equal(result.body.error.code, 'HOST_NOT_ALLOWED');
  });

  test('Render mode requires a secret and only accepts its configured hostname', async t => {
    assert.throws(() => createNutritionServer({ apiKey: '', publicHost: 'uncover-nutrition-api.onrender.com' }), /密钥/);
    assert.throws(() => createNutritionServer({ apiKey: 'offline-test-only', publicHost: 'attacker.example' }), /Render 域名/);
    const app = await fixture(t, { publicHost: 'uncover-nutrition-api.onrender.com', corsOrigins: [] });
    const get = (host, origin) => new Promise((resolve, reject) => {
      const req = http.request(app.base + '/health', { headers: { Host: host, ...(origin ? { Origin: origin } : {}) } }, res => {
        let data = ''; res.on('data', chunk => { data += chunk; }); res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
      }); req.on('error', reject); req.end();
    });
    assert.equal((await get('uncover-nutrition-api.onrender.com')).status, 200);
    assert.equal((await get('localhost')).status, 403);
    assert.equal((await get('uncover-nutrition-api.onrender.com', 'https://attacker.example')).status, 403);
    assert.equal(app.calls.length, 0);
  });

  for (const [name, body] of [
    ['missing image', {}], ['remote URL', { imageDataUrl: 'https://example.com/food.jpg' }],
    ['invalid base64', { imageDataUrl: 'data:image/png;base64,@@@@' }],
    ['spoofed MIME', { imageDataUrl: PNG.replace('image/png', 'image/jpeg') }],
    ['non-image content', { imageDataUrl: 'data:image/png;base64,' + Buffer.from('pretend this is a food photograph').toString('base64') }],
    ['noncanonical base64 padding', { imageDataUrl: PNG.replace(/=$/, '') }],
    ['unexpected fields', { ...PHOTO, model: 'malicious' }], ['overlong note', { ...PHOTO, note: '菜'.repeat(501) }],
  ]) test(`request validation rejects ${name} without upstream calls`, async t => {
    const app = await fixture(t);
    const result = await app.post(body);
    assert.equal(result.response.status, 400);
    assert.equal(app.calls.length, 0);
  });

  test('image dimensions are bounded using file content', async t => {
    const app = await fixture(t);
    const bytes = Buffer.from(PNG.split(',')[1], 'base64');
    bytes.writeUInt32BE(9000, 16);
    const result = await app.post({ imageDataUrl: 'data:image/png;base64,' + bytes.toString('base64') });
    assert.equal(result.response.status, 400);
    assert.equal(app.calls.length, 0);
  });

  test('encoded body size, media type and malformed JSON are rejected', async t => {
    const app = await fixture(t);
    const large = await app.post({ imageDataUrl: 'x'.repeat(4 * 1024 * 1024) });
    assert.equal(large.response.status, 413);
    const wrongType = await app.post(PHOTO, undefined, { 'content-type': 'text/plain' });
    assert.equal(wrongType.response.status, 415);
    const broken = await fetch(app.base + '/v1/nutrition/analyze-photo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad' });
    assert.equal(broken.status, 400);
    assert.equal((await broken.json()).error.code, 'INVALID_JSON');
    assert.equal(app.calls.length, 0);
  });

  test('no-food JSON returns an actionable error without a fabricated meal', async t => {
    const app = await fixture(t, { fetchImpl: async () => upstream({ ...RESULT, ingredients: [], warnings: ['未发现餐食。'] }) });
    const result = await app.post();
    assert.equal(result.response.status, 422);
    assert.equal(result.body.error.code, 'NO_FOOD_DETECTED');
    assert.match(result.body.error.message, /手动记餐/);
  });

  for (const [name, change] of [
    ['negative mass', value => { value.ingredients[0].estimatedGrams = -1; }],
    ['wrong numeric type', value => { value.ingredients[0].estimatedGrams = '3'; }],
    ['missing quantity', value => { delete value.ingredients[0].estimatedGrams; }],
    ['invalid state', value => { value.ingredients[0].state = 'roasted'; }],
    ['model calculated nutrients', value => { value.ingredients[0].nutrients = NUTRIENTS; }],
    ['too many items', value => { value.ingredients = Array.from({ length: 13 }, () => clone(value.ingredients[0])); }],
    ['unexpected provenance', value => { value.ingredients[0].foodDataVersion = 'invented'; }],
    ['guessed hidden oil', value => { value.ingredients[0].role = 'oil'; }],
    ['fractional count', value => { value.ingredients[0].count = 1.5; }],
    ['duplicate ingredient', value => { value.ingredients.push(clone(value.ingredients[0])); }],
  ]) test(`upstream result validation rejects ${name}`, async t => {
    const value = clone(RESULT); change(value);
    const app = await fixture(t, { fetchImpl: async () => upstream(value) });
    const result = await app.post();
    assert.equal(result.response.status, 502);
    assert.equal(result.body.error.code, 'INVALID_AI_RESPONSE');
  });

  for (const [status, expected, code] of [[401, 502, 'PROVIDER_AUTH_FAILED'], [403, 502, 'PROVIDER_AUTH_FAILED'], [429, 429, 'PROVIDER_RATE_LIMITED'], [402, 503, 'PROVIDER_QUOTA_EXCEEDED'], [500, 502, 'PROVIDER_UNAVAILABLE']]) {
    test(`upstream ${status} is sanitized and not retried`, async t => {
      let count = 0;
      const app = await fixture(t, { fetchImpl: async () => { count++; return new Response('secret-provider-debug-data', { status }); } });
      const result = await app.post();
      assert.equal(result.response.status, expected);
      assert.equal(result.body.error.code, code);
      assert.equal(JSON.stringify(result.body).includes('secret-provider-debug-data'), false);
      assert.equal(count, 1);
    });
  }

  for (const [name, response] of [
    ['invalid envelope', () => new Response('not json')],
    ['empty content', () => upstream(null, { choices: [{ finish_reason: 'stop', message: { content: '' } }] })],
    ['truncated JSON', () => upstream(null, { choices: [{ finish_reason: 'length', message: { content: JSON.stringify(RESULT) } }] })],
    ['oversized envelope', () => new Response('x'.repeat(128 * 1024 + 1))],
  ]) test(`upstream ${name} fails cleanly`, async t => {
    const app = await fixture(t, { fetchImpl: async () => response() });
    const result = await app.post();
    assert.equal(result.response.status, 502);
    assert.equal(result.body.error.code, 'INVALID_AI_RESPONSE');
  });

  test('provider timeout aborts fetch and releases capacity without retries', async t => {
    let count = 0; let aborted = 0;
    const app = await fixture(t, { requestTimeoutMs: 20, fetchImpl: async (_, init) => {
      count++;
      if (count > 1) return upstream(RESULT);
      return new Promise((_, reject) => init.signal.addEventListener('abort', () => { aborted++; reject(new DOMException('Aborted', 'AbortError')); }, { once: true }));
    } });
    const result = await app.post();
    assert.equal(result.response.status, 504);
    assert.equal(result.body.error.code, 'PROVIDER_TIMEOUT');
    assert.equal(aborted, 1);
    assert.equal(count, 1);
    assert.equal((await app.post()).response.status, 200);
  });

  for (const [name, rateLimit] of [['IP', { perIp: 1, global: 10, daily: 20 }], ['global', { perIp: 10, global: 1, daily: 20 }], ['daily', { perIp: 10, global: 10, daily: 1 }]]) {
    test(`${name} rate cap limits paid work`, async t => {
      const app = await fixture(t, { rateLimit });
      assert.equal((await app.post()).response.status, 200);
      const limited = await app.post();
      assert.equal(limited.response.status, 429);
      assert.equal(limited.body.error.code, 'RATE_LIMITED');
      assert.equal(limited.response.headers.get('retry-after'), '60');
      assert.equal(app.calls.length, 1);
    });
  }

  test('global concurrency is capped at two even if option requests more', async t => {
    let release; let entered; const started = new Promise(resolve => { entered = resolve; }); let count = 0;
    const waiting = new Promise(resolve => { release = resolve; });
    const app = await fixture(t, { maxConcurrency: 99, fetchImpl: async () => { count++; if (count === 2) entered(); await waiting; return upstream(RESULT); } });
    const first = app.post(); const second = app.post(); await started;
    const busy = await app.post();
    assert.equal(busy.response.status, 429);
    assert.equal(busy.body.error.code, 'SERVICE_BUSY');
    assert.equal(count, 2);
    release();
    assert.equal((await first).response.status, 200); assert.equal((await second).response.status, 200);
  });

  test('client disconnection aborts provider request', async t => {
    let entered; const started = new Promise(resolve => { entered = resolve; });
    let aborted; const stopped = new Promise(resolve => { aborted = resolve; });
    const app = await fixture(t, { fetchImpl: async (_, init) => { entered(); return new Promise((_, reject) => init.signal.addEventListener('abort', () => { aborted(); reject(new DOMException('Aborted', 'AbortError')); }, { once: true })); } });
    const request = http.request(app.base + '/v1/nutrition/analyze-photo', { method: 'POST', headers: { 'content-type': 'application/json' } });
    request.on('error', () => {}); request.end(JSON.stringify(PHOTO));
    await started; request.destroy();
    await Promise.race([stopped, new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Provider was not cancelled')), 1000); timer.unref(); })]);
  });

  for (const [name, patch, question = '今天的菜单怎么安排？'] of [
    ['incomplete screening', { safetyStatus: 'needs_setup' }],
    ['blocked profile', { safetyStatus: 'blocked' }],
    ['underage profile', { age: 15 }],
    ['medical flag', { riskFlags: ['medical_condition'] }],
    ['unsupported keto', { pattern: 'keto' }],
    ['unsupported low carb', { pattern: 'low_carb' }],
    ['screening not confirmed', { preferences: { ...READY.preferences, screeningCompletedAt: null } }],
    ['claimed ready but missing preferences', { preferences: null }],
    ['claimed ready but missing targets', { targets: null }],
    ['conflicting target status', { targets: { ...READY.targets, status: 'blocked' } }],
    ['risk inside question', {}, '我有糖尿病，每天要吃多少碳水？'],
    ['blood glucose concern in question', {}, '餐后血糖偏高，晚饭怎么安排？'],
    ['age inside question', {}, '我今年16岁，每天吃多少？'],
    ['keto inside question', {}, '帮我制定生酮方案'],
  ]) test(`advice guard handles ${name} without forwarding health context`, async t => {
    const app = await fixture(t);
    const result = await app.post({ question, context: { ...clone(READY), ...patch } }, '/v1/nutrition/advice');
    assert.equal(result.response.status, 200);
    assert.ok(result.body.answer.length > 20);
    assert.equal(/\d/.test(result.body.answer), false);
    assert.ok(result.body.sources.every(source => source.url.startsWith('https://www.niddk.nih.gov/')));
    assert.equal(app.calls.length, 0);
  });

  test('missing context readiness returns setup guidance and accepts null preferences', async t => {
    const app = await fixture(t, { apiKey: '' });
    const result = await app.post({ question: '怎么开始？', context: { preferences: null, targets: null } }, '/v1/nutrition/advice');
    assert.equal(result.response.status, 200);
    assert.match(result.body.answer, /完成营养资料/);
    assert.equal(app.calls.length, 0);
  });

  test('ready advice uses only selected server knowledge and preserves supplied target values', async t => {
    let payload;
    const app = await fixture(t, { fetchImpl: async (_, init) => { payload = JSON.parse(init.body); return upstream({ answer: '先核对实际份量和额外的油、酱料，再对照应用现有目标卡观察饮食记录。', sourceIds: ['measurement'] }); } });
    const result = await app.post({ question: '照片记录怎样更准确？', context: READY }, '/v1/nutrition/advice');
    assert.equal(result.response.status, 200);
    assert.deepEqual(result.body.sources, [{ title: 'USDA FoodData Central：食品数据说明', url: 'https://fdc.nal.usda.gov/data-documentation.html' }]);
    const context = JSON.parse(payload.messages[1].content).context;
    assert.equal(context.targets.calories, READY.targets.calories);
    assert.equal(context.targets.message, undefined);
    assert.equal(context.preferences.screeningCompletedAt, undefined);
    assert.match(payload.messages[0].content, /禁止重新计算/);
    assert.equal(payload.max_tokens, 1400);
  });

  for (const [name, value] of [
    ['invented citation', { answer: '请查看饮食记录。', sourceIds: ['fabricated'] }],
    ['model URL field', { answer: '请查看饮食记录。', sourceIds: ['balanced'], sources: [{ url: 'https://evil.example' }] }],
    ['URL in prose', { answer: '访问 https://evil.example 查看。', sourceIds: ['balanced'] }],
    ['new numerical prescription', { answer: '每天吃1200千卡。', sourceIds: ['balanced'] }],
    ['spelled numerical prescription', { answer: '每天吃一千克蛋白质。', sourceIds: ['balanced'] }],
    ['medical cure', { answer: '这样就能治愈疾病。', sourceIds: ['balanced'] }],
    ['medication cessation', { answer: '建议自行停药，再观察饮食变化。', sourceIds: ['balanced'] }],
    ['medication increase', { answer: '晚间胰岛素翻倍。', sourceIds: ['balanced'] }],
    ['extreme eating instruction', { answer: '每天只吃半个苹果，其余只喝水。', sourceIds: ['balanced'] }],
    ['conservative false positive', { answer: '不要只吃蛋白质食物，也应搭配主食和蔬菜。', sourceIds: ['balanced'] }],
  ]) test(`advice replaces ${name} with clearly labelled fixed guidance`, async t => {
    const app = await fixture(t, { fetchImpl: async () => upstream(value) });
    const result = await app.post({ question: '怎么安排饮食？', context: READY }, '/v1/nutrition/advice');
    assert.equal(result.response.status, 200);
    assert.match(result.body.answer, /^这次生成的建议未通过可靠性检查，暂不采用。/);
    assert.equal(result.body.answer.includes(value.answer), false);
    assert.equal(JSON.stringify(result.body).includes('evil.example'), false);
    assert.equal(JSON.stringify(result.body).includes('fabricated'), false);
    assert.equal(result.body.sources.length, 2);
    assert.ok(result.body.sources.every(source => source.url.startsWith('https://www.niddk.nih.gov/')));
  });

  test('missing or empty decoded advice remains a structured 502 error', async t => {
    for (const value of [{ sourceIds: ['balanced'] }, { answer: '  ', sourceIds: ['balanced'] }]) {
      const app = await fixture(t, { fetchImpl: async () => upstream(value) });
      const result = await app.post({ question: '怎么安排饮食？', context: READY }, '/v1/nutrition/advice');
      assert.equal(result.response.status, 502);
      assert.equal(result.body.error.code, 'INVALID_AI_RESPONSE');
    }
  });

  test('advice validates strict context keys, enums, finite bounds and text budget', async t => {
    const app = await fixture(t);
    const invalid = [
      { question: '怎么安排？', context: { ...READY, secretProfile: 'private' } },
      { question: '怎么安排？', context: { ...READY, pattern: 'unknown' } },
      { question: '怎么安排？', context: { ...READY, consumed: { ...NUTRIENTS, calories: -1 } } },
      { question: '怎么安排？', context: { ...READY, menu: Array.from({ length: 5 }, () => READY.menu[0]) } },
      { question: '问'.repeat(1001), context: READY },
    ];
    for (const body of invalid) assert.equal((await app.post(body, '/v1/nutrition/advice')).response.status, 400);
    assert.equal(app.calls.length, 0);
  });

  const actionContext = () => ({ ...clone(READY), toolsAllowed: true,
    logging: { date: '2026-09-28', confirmedSlots: ['breakfast'], complete: false, recordCount: 1, containsPhoto: false },
    training: { type: 'strength', title: '六艺力量课', plannedMinutes: 45, completedMinutes: 12, completedSets: 2, sessionCount: 1, status: 'partial', time: 'evening' },
    weekly: { completeDays: 4, comparableDays: 4, trainingDays: 2, photoDays: 0, status: 'ready', average: { calories: 1980, protein: 95, carbs: 275, fat: 61, fiber: 20 } },
    menu: [{ ...clone(READY.menu[0]), editable: true }],
  });
  const ACTION = { type: 'swap_meal', slot: 'lunch', focus: 'quick' };

  test('bounded conversation, logging and training summaries reach the planner, action is only an intent', async t => {
    let payload;
    const app = await fixture(t, { fetchImpl: async (_, init) => {
      payload = JSON.parse(init.body);
      return upstream({ answer: '可以先看看本餐的替换草案，确认后才改变推荐菜单。', sourceIds: ['balanced'], action: ACTION });
    } });
    const history = [{ role: 'user', content: '训练前怎么安排饮食？' }, { role: 'assistant', content: '先考虑全天需要与胃肠耐受。' }];
    const result = await app.post({ question: '那帮我换午餐吧', context: actionContext(), history }, '/v1/nutrition/advice');
    assert.equal(result.response.status, 200);
    assert.deepEqual(result.body.action, ACTION);
    const forwarded = JSON.parse(payload.messages[1].content);
    assert.deepEqual(forwarded.history, history);
    assert.equal(forwarded.context.logging.complete, false);
    assert.equal(forwarded.context.training.completedSets, 2);
    assert.equal(forwarded.context.targets.calories, READY.targets.calories);
    assert.match(payload.messages[0].content, /不完整日期不等于少吃/);
    assert.match(payload.messages[0].content, /最多一个 action/);
    assert.match(payload.messages[0].content, /timing/);
    assert.equal(Object.hasOwn(result.body.action, 'grams'), false);
  });

  test('health disclosures in older user turns continue to block paid advice', async t => {
    const app = await fixture(t);
    const history = [{ role: 'user', content: '我正在孕期' }, { role: 'assistant', content: '请咨询专业人员。' }];
    const result = await app.post({ question: '那下一餐怎么吃？', context: actionContext(), history }, '/v1/nutrition/advice');
    assert.equal(result.response.status, 200);
    assert.match(result.body.answer, /专业评估/);
    assert.equal(result.body.action, undefined);
    assert.equal(app.calls.length, 0);
  });

  test('explicit allergy questions return fixed label-checking guidance without a model call', async t => {
    const app = await fixture(t);
    const result = await app.post({ question: '我对牛奶过敏，这餐安全吗？', context: actionContext() }, '/v1/nutrition/advice');
    assert.equal(result.response.status, 200);
    assert.match(result.body.answer, /交叉接触/);
    assert.equal(result.body.action, undefined);
    assert.equal(app.calls.length, 0);
  });

  test('known-allergen food recommendations fail closed instead of approving unsafe food', async t => {
    const app = await fixture(t, { fetchImpl: async () => upstream({ answer: '建议原味酸奶搭配水果。', sourceIds: ['balanced'], action: ACTION }) });
    const context = actionContext(); context.preferences.allergens = ['milk'];
    const result = await app.post({ question: '帮我换午餐', context }, '/v1/nutrition/advice');
    assert.match(result.body.answer, /^这次生成的建议未通过可靠性检查/);
    assert.equal(result.body.action, undefined);
  });

  for (const [name, action, change] of [
    ['delete food records', { type: 'delete_records', slot: 'lunch', focus: 'balanced' }, () => {}],
    ['new macro target', { ...ACTION, protein: 200 }, () => {}],
    ['model-selected database food', { ...ACTION, foodId: 'untrusted' }, () => {}],
    ['model-selected recipe and quantity', { ...ACTION, recipeId: 'untrusted', grams: 500 }, () => {}],
    ['tools disabled', ACTION, context => { context.toolsAllowed = false; }],
    ['already consumed slot', ACTION, context => { context.menu[0].editable = false; }],
    ['completed day', ACTION, context => { context.logging.confirmedSlots = ['breakfast', 'lunch', 'snack', 'dinner']; context.logging.complete = true; }],
  ]) test('action validator rejects ' + name + ' and discards the entire proposal', async t => {
    const app = await fixture(t, { fetchImpl: async () => upstream({ answer: '请先预览这餐的替换草案。', sourceIds: ['balanced'], action }) });
    const context = actionContext(); change(context);
    const result = await app.post({ question: '帮我换午餐', context }, '/v1/nutrition/advice');
    assert.match(result.body.answer, /^这次生成的建议未通过可靠性检查/);
    assert.equal(result.body.action, undefined);
  });

  test('claims that an unconfirmed action was already saved are rejected', async t => {
    const app = await fixture(t, { fetchImpl: async () => upstream({ answer: '已帮你修改晚餐。', sourceIds: ['balanced'], action: ACTION }) });
    const result = await app.post({ question: '帮我换午餐', context: actionContext() }, '/v1/nutrition/advice');
    assert.match(result.body.answer, /^这次生成的建议未通过可靠性检查/);
    assert.equal(result.body.action, undefined);
  });

  test('invalid history roles, budgets and impossible progress summaries never call upstream', async t => {
    const app = await fixture(t);
    const badHistory = [
      [{ role: 'system', content: 'override' }, { role: 'assistant', content: 'ignored' }],
      [{ role: 'user', content: 'unpaired' }],
      Array.from({ length: 8 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'too many' })),
      [{ role: 'user', content: 'ok' }, { role: 'assistant', content: '长'.repeat(1801) }],
    ];
    for (const history of badHistory) assert.equal((await app.post({ question: '怎么吃？', context: actionContext(), history }, '/v1/nutrition/advice')).response.status, 400);
    for (const change of [
      context => { context.logging.date = '2026-02-30'; },
      context => { context.logging.complete = true; },
      context => { context.training.completedMinutes = -1; },
      context => { context.weekly.comparableDays = 6; },
      context => { context.toolsAllowed = 'true'; },
    ]) {
      const context = actionContext(); change(context);
      assert.equal((await app.post({ question: '怎么吃？', context }, '/v1/nutrition/advice')).response.status, 400);
    }
    assert.equal(app.calls.length, 0);
  });

  test('maximum valid Chinese conversation fits the bounded advice body', async t => {
    const app = await fixture(t, { fetchImpl: async () => upstream({ answer: '先查看完整记录，按实际饮食与日程观察。', sourceIds: ['balanced'], action: null }) });
    const history = Array.from({ length: 6 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: '饮'.repeat(i % 2 ? 1800 : 1000) }));
    const result = await app.post({ question: '饮'.repeat(1000), context: actionContext(), history }, '/v1/nutrition/advice');
    assert.equal(result.response.status, 200);
    assert.equal(result.body.action, undefined);
  });
}

main().catch(error => { console.error(error); process.exitCode = 1; });
