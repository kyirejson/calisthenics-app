const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const engine = require('../src/nutrition/engine.ts');
const { withMealStatus, withMealLoggingConfirmation, summarizeNutritionWeek } = require('../src/nutrition/timeline.ts');
const { withIntakeEntry } = require('../src/nutrition/journal.ts');
const { explicitMealStatusIntent, mealStatusReply } = require('../src/nutrition/mealStatusIntent.mjs');
const { normalizeAssistantIntent, normalizeAssistantState } = require('../src/nutrition/assistantState.ts');
const { assistantDataBasis, authorizeAssistantOperation, assistantOperationPayload } = require('../src/nutrition/assistantAuthorization.ts');
const now = '2026-10-02T01:00:00.000Z', date = '2026-10-02';
const profile = { age: 30, height: 175, weight: 75, sex: 'male', weightHistory: [] };
const food = { id: 'meal-qa', date, slot: 'lunch', name: '米饭', source: 'manual', portions: [{ foodId: 'rice-cooked', grams: 100 }] };

test('explicit current-day no-meal statements produce only a grounded optional state', () => {
  for (const question of ['早餐，我没吃', '今天早餐没吃。', '我今天早餐没吃', '我没吃早饭', '今天我没有吃早餐，帮我记录一下']) {
    const intent = explicitMealStatusIntent(question);
    assert.deepEqual(intent, { type: 'meal_status', slot: 'breakfast', status: 'not_eaten' });
    assert.deepEqual(normalizeAssistantIntent(intent), intent);
    assert.ok(Array.from(mealStatusReply(intent)).length <= 50);
    assert.match(mealStatusReply(intent), /不用补填/);
  }
  assert.equal(explicitMealStatusIntent('晚餐没吃').slot, 'dinner');
  assert.equal(explicitMealStatusIntent('早餐撤销没吃').status, 'unrecorded');
});

test('questions, future choices, old dates, habits, third parties and mixed food statements never silently mark no intake', () => {
  for (const text of ['早餐没吃怎么办？', '早餐没吃吗', '早餐没吃？', '明天早餐不吃了', '昨天早餐没吃', '我不吃早餐', '我不喜欢早餐', '他早餐没吃', '早餐没吃但喝了牛奶', '早餐不是没吃', '早餐还没吃', '早餐还没记录']) assert.equal(explicitMealStatusIntent(text), null, text);
});

test('a skipped meal persists independently without empty foods or full-day zero assumptions', () => {
  const j = withMealStatus(engine.emptyNutritionJournal(), date, 'breakfast', 'not_eaten', now);
  assert.equal(j.entries.length, 0);
  assert.deepEqual(j.days[date].skippedSlots, ['breakfast']);
  assert.deepEqual(j.days[date].confirmedSlots, ['breakfast']);
  assert.equal(j.days[date].completedAt, null);
  assert.deepEqual(engine.normalizeNutritionJournal(JSON.parse(JSON.stringify(j))), j);
  const review = summarizeNutritionWeek(j, profile, [], date);
  assert.equal(review.days.at(-1).state, 'partial'); assert.equal(review.completeDays, 0); assert.equal(review.average, null);
  let all = j; for (const slot of ['lunch', 'snack', 'dinner']) all = withMealStatus(all, date, slot, 'not_eaten', now);
  assert.equal(all.days[date].completedAt, null, 'individual choices do not auto-confirm the entire day');
});

test('only one meal can be recorded while others remain unknown; recording after a skip clears that skip', () => {
  const original = withMealStatus(engine.emptyNutritionJournal(), date, 'lunch', 'not_eaten', now);
  const recorded = withIntakeEntry(original, food, now);
  assert.equal(recorded.entries.length, 1); assert.deepEqual(recorded.days[date].skippedSlots, []); assert.deepEqual(recorded.days[date].confirmedSlots, []);
  assert.equal(recorded.days[date].completedAt, null);
  assert.throws(() => withMealStatus(recorded, date, 'lunch', 'not_eaten', now), /已有实际饮食记录/);
  assert.equal(recorded.entries.length, 1);
  const reset = withMealStatus(recorded, date, 'lunch', 'unrecorded', now);
  assert.deepEqual(reset.entries, recorded.entries);
});

test('revoking a meal or whole-day confirmation clears state but never deletes foods', () => {
  const j = withMealStatus(engine.emptyNutritionJournal(), date, 'breakfast', 'not_eaten', now);
  const day = withMealLoggingConfirmation(j, date, 'day', true, now);
  assert.ok(day.days[date].completedAt);
  const reset = withMealLoggingConfirmation(day, date, 'day', false, now);
  assert.deepEqual(reset.days[date].skippedSlots, []); assert.equal(reset.days[date].completedAt, null);
  assert.throws(() => withMealStatus(j, '2026-10-03', 'breakfast', 'not_eaten', now));
});

test('no-meal tool respects permission, stale meal state, replay receipts and reload', () => {
  const j = engine.emptyNutritionJournal(), basis = assistantDataBasis(j, null, [], {});
  const op = { id: 'meal_status-qa', kind: 'meal_status', policyVersion: 0, confirmed: false, basis, date, slot: 'breakfast', status: 'not_eaten' };
  assert.throws(() => authorizeAssistantOperation(j.assistant, op, basis), /确认/);
  assert.equal(authorizeAssistantOperation(j.assistant, { ...op, confirmed: true }, basis), 'execute');
  const changed = withMealStatus(j, date, 'lunch', 'not_eaten', now);
  assert.throws(() => authorizeAssistantOperation(j.assistant, { ...op, confirmed: true }, assistantDataBasis(changed, null, [], {})), /变化/);
  const assistant = normalizeAssistantState({ ...j.assistant, receipts: { [op.id]: { kind: op.kind, payload: assistantOperationPayload(op), createdAt: now } } });
  assert.equal(authorizeAssistantOperation(assistant, op, 'changed'), 'replay');
  assert.throws(() => authorizeAssistantOperation(assistant, { ...op, slot: 'dinner' }, basis), /重放/);
});

test('server accepts only grounded meal-state intents and validates source context independently', async () => {
  const { validateAssistantIntent } = await import('../server/assistant-intents.mjs');
  const { validateAdviceRequest } = await import('../server/validation.mjs');
  const intent = explicitMealStatusIntent('早餐没吃'), input = { question: '早餐没吃', assistantMode: true };
  assert.deepEqual(validateAssistantIntent(intent, input), intent);
  assert.equal(validateAssistantIntent({ ...intent, slot: 'lunch' }, input), null);
  assert.equal(validateAssistantIntent(intent, { ...input, question: '早餐没吃怎么办' }), null);
  const context = { logging: { date, confirmedSlots: ['breakfast'], skippedSlots: ['breakfast'], recordedSlots: [], complete: false, recordCount: 0, containsPhoto: false } };
  assert.deepEqual(validateAdviceRequest({ ...input, context }).context.logging.skippedSlots, ['breakfast']);
  assert.throws(() => validateAdviceRequest({ ...input, context: { logging: { ...context.logging, recordedSlots: ['breakfast'] } } }));
});

test('no-meal API works without paid AI, calorie setup or fabricated food records', async t => {
  const { createNutritionServer } = await import('../server/index.mjs');
  let calls = 0;
  const server = createNutritionServer({ apiKey: '', fetchImpl: async () => { calls++; throw Error('unexpected paid request'); } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/v1/nutrition/advice`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: '早餐，我没吃', context: {}, assistantMode: true }) });
  assert.equal(response.status, 200); const body = await response.json();
  assert.equal(body.intent.type, 'meal_status'); assert.equal(body.intent.slot, 'breakfast'); assert.equal(body.intent.status, 'not_eaten');
  assert.equal(body.action, undefined); assert.equal(calls, 0); assert.doesNotMatch(body.answer, /补剂|先核对/);
});
