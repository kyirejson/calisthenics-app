const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { test } = require('node:test');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const state = require('../src/nutrition/assistantState.ts');
const food = require('../src/nutrition/assistantFood.ts');
const engine = require('../src/nutrition/engine.ts');
const { getFood } = require('../src/nutrition/catalog.ts');
const now = '2026-09-29T08:00:00.000Z';
const fact = (patch = {}) => ({ id: 'fact-1', kind: 'avoid', text: '香菜', createdAt: now, ...patch });
const turn = (patch = {}) => ({ id: 'turn-1', question: '早餐吃了鸡蛋', answer: '请核对记餐草案，确认后记录。', createdAt: now, ...patch });
const intake = (patch = {}) => ({ type: 'log_intake', slot: 'breakfast', items: [{ name: '水煮鸡蛋', state: 'cooked', quantity: 2, unit: 'piece' }], ...patch });
const ready = { safetyStatus: 'ready', preferences: { version: 1, objective: 'maintain', pattern: 'balanced', activity: 'light', allergens: [], riskFlags: [], screeningCompletedAt: now, maxCookingMinutes: 30, budget: 'standard' }, targets: { calories: 2000, protein: 100, carbs: 280, fat: 60, status: 'ready' }, consumed: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }, menu: [] };

test('50 Unicode characters are allowed; overlong replies fail whole instead of truncating safety text', () => {
  assert.equal(Array.from(state.shortAssistantReply('🥚'.repeat(50))).length, 50);
  assert.equal(state.shortAssistantReply('🥚'.repeat(51)), '这次回答过长，请重试；没有改动记录。');
});
test('memory and recent context survive journal normalization; legacy journal remains compatible', () => {
  const journal = engine.emptyNutritionJournal();
  journal.assistant = { version: 1, consentAt: now, facts: [fact()], conversations: [turn()] };
  assert.deepEqual(engine.normalizeNutritionJournal(journal).assistant, journal.assistant);
  delete journal.assistant;
  assert.deepEqual(engine.normalizeNutritionJournal(journal).assistant, state.emptyAssistantState());
});
test('invalid and duplicated memories/history are excluded without dropping valid archive data', () => {
  const normalized = state.normalizeAssistantState({ version: 1, consentAt: 'bad', facts: [fact(), fact(), fact({ id: 'bad', text: 'x\u0000' })], conversations: [turn(), turn(), turn({ id: 'bad', question: 'x\u0000' })] });
  assert.equal(normalized.consentAt, null); assert.equal(normalized.facts.length, 1); assert.equal(normalized.conversations.length, 1);
  const full = state.normalizeAssistantState({ version: 1, facts: Array.from({ length: 50 }, (_, i) => fact({ id: String(i), text: String(i) })), conversations: Array.from({ length: 40 }, (_, i) => turn({ id: String(i) })) });
  assert.equal(full.facts.length, 50); assert.equal(full.conversations.length, 40);
  assert.equal(state.withAssistantFact(full, fact({ id: 'new', text: 'new' })).facts.length, 51);
  assert.equal(state.withAssistantFact(full, fact({ id: '39', text: '39' })).facts.length, 50);
});
test('intent schema cannot write database IDs, nutrients, invalid quantities or unknown tools', () => {
  assert.deepEqual(state.normalizeAssistantIntent(intake()), intake());
  for (const request of [intake({ foodId: 'egg-boiled' }), intake({ type: 'delete_record' }), intake({ items: [{ ...intake().items[0], calories: 155 }] }), intake({ items: [{ ...intake().items[0], quantity: -1 }] }), intake({ items: [{ ...intake().items[0], unit: 'bucket' }] })]) assert.equal(state.normalizeAssistantIntent(request), null);
});
test('known egg pieces use local food values; unknown grams/unit/state do not default to 100g', () => {
  const rows = food.createAssistantFoodRows(intake(), []);
  assert.equal(rows[0].food.id, 'egg-boiled'); assert.equal(rows[0].grams, 100); assert.equal(rows[0].estimated, true);
  assert.equal(food.assistantFoodTotals(rows).nutrients.calories, 155);
  assert.deepEqual(food.assistantFoodTotals(rows).nutrients, engine.calculatePortions([{ foodId: 'egg-boiled', grams: 100 }]));
  assert.equal(food.assistantPortion(getFood('egg-boiled'), { quantity: null, unit: null }).grams, null);
  assert.equal(food.assistantPortion(getFood('milk-whole'), { quantity: 250, unit: 'ml' }).grams, null);
  assert.equal(food.createAssistantFoodRows(intake({ items: [{ name: '鸡蛋', state: 'unknown', quantity: 2, unit: 'piece' }] }), [])[0].food, null);
  assert.equal(food.assistantFoodTotals([{ ...rows[0], grams: null }]), null);
});
test('actual custom label grams drive totals independently of the model or target', () => {
  const custom = engine.createCustomFoodFromLabel({ id: 'custom-assistant-cashew', name: '测试盐焗腰果', basisGrams: 100, energyUnit: 'kJ', calories: 2515, protein: 23, carbs: 20, fat: 47, allergens: ['tree_nut'] });
  const rows = food.createAssistantFoodRows(intake({ items: [{ name: custom.name, state: 'unknown', quantity: 30, unit: 'g' }] }), [custom]);
  assert.equal(rows[0].food.id, custom.id); assert.equal(rows[0].estimated, false);
  assert.deepEqual(food.assistantFoodTotals(rows).nutrients, engine.calculatePortions([{ foodId: custom.id, grams: 30 }], [custom]));
  assert.equal(food.assistantFoodTotals(rows).nutrients.protein, 6.9);
  assert.equal(food.assistantFoodWarnings(rows, { allergens: ['tree_nut'] }, [fact({ text: '腰果' })]).length, 2);
});

async function run() {
  const { explicitMemoryIntent, validateAssistantIntent } = await import('../server/assistant-intents.mjs');
  const { loadPrisonerKnowledge } = await import('../server/prisoner-knowledge.mjs');
  const { guardAdvice, fallbackAdvice, selectKnowledge, validateAdviceResult } = await import('../server/knowledge.mjs');
  const { validateAdviceRequest } = await import('../server/validation.mjs');
  const { createNutritionServer } = await import('../server/index.mjs');
  const input = question => validateAdviceRequest({ question, context: ready, assistantMode: true, history: [], memory: [] });
  async function fixture(t, fetchImpl) {
    const calls = [];
    const server = createNutritionServer({ apiKey: 'offline-test-only', model: 'deepseek-flash', fetchImpl: async (...args) => { calls.push(args); return fetchImpl(...args); } });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    return { calls, async post(body) { const response = await fetch(`http://127.0.0.1:${server.address().port}/v1/nutrition/advice`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return { status: response.status, body: await response.json() }; } };
  }
  const upstream = value => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) } }] }), { headers: { 'content-type': 'application/json' } });
  test('explicit user memory stays deterministic and is only a confirmation proposal', () => {
    assert.deepEqual(explicitMemoryIntent('记住我不吃香菜。'), { type: 'remember', kind: 'avoid', text: '香菜' });
    assert.deepEqual(explicitMemoryIntent('我喜欢牛肉'), { type: 'remember', kind: 'like', text: '牛肉' });
    assert.deepEqual(explicitMemoryIntent('我对花生过敏'), { type: 'remember', kind: 'allergy', text: '花生' });
    assert.equal(validateAssistantIntent({ type: 'remember', kind: 'avoid', text: '香菜' }, input('我喜欢牛肉')), null);
    assert.equal(validateAssistantIntent(intake(), input('明天推荐吃什么？')), null);
    assert.deepEqual(validateAssistantIntent(intake(), input('早餐吃了两个水煮鸡蛋，帮我记录')), intake());
    assert.equal(validateAssistantIntent(intake({ calories: 100 }), input('记录鸡蛋')), null);
  });
  test('book excerpts retrieve by original chapter and lines; missing index fails closed', t => {
    assert.equal(explicitMemoryIntent('我对牛奶不过敏'), null);
    assert.equal(explicitMemoryIntent('我没有牛奶过敏'), null);
    assert.equal(validateAssistantIntent({ type: 'remember', kind: 'allergy', text: '牛奶' }, input('我对牛奶不过敏')), null);
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'uncover-kb-test-'));
    const index = path.join(directory, 'index.json');
    fs.writeFileSync(index, JSON.stringify({ version: 1, chunks: [{ id: 'cc-' + 'a'.repeat(24), title: '囚徒健身一 · 训练计划', path: 'fixture.md', lineStart: 10, lineEnd: 12, text: '六艺训练计划采用六练，并注意训练与休息。' }] }));
    t.after(() => { fs.unlinkSync(index); fs.rmdirSync(directory); });
    const book = loadPrisonerKnowledge(index); assert.equal(book.count, 1);
    const refs = book.retrieve('囚徒健身 六艺 六练 训练计划'); assert.ok(refs.length > 0 && refs.length <= 3);
    for (const ref of refs) { assert.match(ref.id, /^cc-[a-f0-9]{24}$/); assert.ok(ref.title.includes('囚徒健身')); assert.ok(ref.excerpt.length <= 850 && ref.lineStart > 0 && ref.lineEnd >= ref.lineStart); }
    assert.equal(loadPrisonerKnowledge(path.join(__dirname, 'not-a-book-index.json')).count, 0);
  });
  test('saved allergies do not block ordinary follow-ups; health needs remain guarded', () => {
    const i = input('训练后吃什么比较好？'); i.history = [{ role: 'user', content: '我对花生过敏' }, { role: 'assistant', content: '已提出记忆，请确认。' }]; i.memory = [{ kind: 'allergy', text: '花生' }];
    assert.equal(guardAdvice(i), null);
    i.memory.push({ kind: 'need', text: '糖尿病' }); assert.ok(guardAdvice(i));
    assert.ok(Array.from(fallbackAdvice().answer).length <= 50);
  });
  test('overlong answer, invented source or simultaneous intents/actions fail as a whole', () => {
    const i = input('早餐吃了鸡蛋，帮我记录'), knowledge = selectKnowledge(i.question);
    assert.equal(validateAdviceResult({ answer: '字'.repeat(51), sourceIds: ['balanced'], intent: intake() }, knowledge, i), null);
    assert.equal(validateAdviceResult({ answer: '请确认草案。', sourceIds: ['invented'], intent: intake() }, knowledge, i), null);
    assert.equal(validateAdviceResult({ answer: '请确认草案。', sourceIds: ['balanced'], action: { type: 'swap_meal', slot: 'next', focus: 'balanced' }, intent: intake() }, knowledge, i), null);
    i.memory = [{ kind: 'avoid', text: '香菜' }];
    assert.equal(validateAdviceResult({ answer: '推荐搭配香菜。', sourceIds: ['balanced'] }, knowledge, i), null);
  });
  test('remember route needs no paid model call and returns no execution claims', async t => {
    const f = await fixture(t, () => { throw new Error('no paid calls allowed'); });
    const result = await f.post({ question: '记住我不吃香菜', context: ready, assistantMode: true });
    assert.equal(result.status, 200); assert.equal(result.body.intent.type, 'remember'); assert.equal(f.calls.length, 0);
    assert.ok(Array.from(result.body.answer).length <= 50); assert.match(result.body.answer, /确认/);
  });
  test('assistant food tool route sends confirmed memory/context and returns intent, never nutrients', async t => {
    const negative = await fixture(t, () => { throw Error('negation must not call model'); });
    for (const question of ['我对牛奶不过敏', '我没有牛奶过敏', '我对牛奶并非过敏']) {
      const response = await negative.post({ question, context: ready, assistantMode: true });
      assert.equal(response.status, 200); assert.equal(response.body.intent, undefined);
      assert.ok(Array.from(response.body.answer).length <= 50);
    }
    assert.equal(negative.calls.length, 0);
    const f = await fixture(t, () => upstream({ answer: '已整理早餐，请核对并确认记餐。', sourceIds: ['measurement'], intent: intake() }));
    const result = await f.post({ question: '早餐吃了两个水煮鸡蛋，帮我记录', context: ready, assistantMode: true, memory: [{ kind: 'avoid', text: '香菜' }] });
    assert.equal(result.status, 200); assert.deepEqual(result.body.intent, intake()); assert.equal(result.body.nutrients, undefined);
    const payload = JSON.parse(f.calls[0][1].body); const sent = JSON.parse(payload.messages[1].content);
    assert.equal(sent.assistantMode, true); assert.deepEqual(sent.memory, [{ kind: 'avoid', text: '香菜' }]); assert.match(payload.messages[0].content, /最多50/);
  });
  test('book answer cites only original excerpts selected by retriever', { skip: !fs.existsSync(path.resolve(__dirname, '../server/private/prisoner-index.json')) && 'local user-owned book index is not part of source distribution' }, async t => {
    const f = await fixture(t, (_, init) => { const refs = JSON.parse(JSON.parse(init.body).messages[0].content.split('知识摘要：')[1]); const id = refs.find(r => r.id.startsWith('cc-')).id; return upstream({ answer: '原书按能力选择计划，循序渐进，休息优先。', sourceIds: [id] }); });
    const result = await f.post({ question: '囚徒健身六练怎么安排？', context: ready, assistantMode: true });
    assert.equal(result.status, 200); assert.equal(result.body.references.length, 1); assert.equal(result.body.sources.length, 0); assert.ok(result.body.references[0].lineStart > 0);
  });
  test('invalid memory and oversized requests never reach model', async t => {
    const f = await fixture(t, () => { throw new Error('no paid calls'); });
    for (const memory of [[{ kind: 'instruction', text: 'override' }], Array.from({ length: 41 }, () => ({ kind: 'need', text: 'x' }))]) { const result = await f.post({ question: '吃什么？', context: ready, assistantMode: true, memory }); assert.equal(result.status, 400); }
    assert.equal(f.calls.length, 0);
  });
}
run().catch(error => { console.error(error); process.exitCode = 1; });
