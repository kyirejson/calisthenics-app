const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
require('./lib/register-typescript.cjs')();
const { repositoryHarness } = require('./lib/app-repository-harness.cjs');
const { emptyNutritionJournal, normalizeNutritionJournal } = require('../src/nutrition/engine.ts');
const { applyMealOperations } = require('../src/nutrition/mealOperations.ts');
const { hasUnknownNutrition, nutrientKnown } = require('../src/nutrition/agentFood.ts');
const { summarizeNutritionWeek } = require('../src/nutrition/timeline.ts');
const date = '2026-10-12', now = '2026-10-12T02:00:00.000Z';
const add = (name = '鸡蛋', slot = 'breakfast', extra = {}) => ({ action: 'add', date, slot, name, amount: '2 个', estimated: true,
  nutrients: { calories: 140, protein: 12, carbs: 1, fat: 10, fiber: 0 }, ...extra });
const batch = (...operations) => ({ operationKey: 'meals_1', operations });

test('agent saves four model-selected meal slots and never classifies from food names', () => {
  const operations = ['breakfast', 'lunch', 'dinner', 'snack'].map(slot => add('同一种食物', slot));
  const { journal, result } = applyMealOperations(emptyNutritionJournal(), batch(...operations), 'chat-one', now);
  assert.equal(result.ok, true); assert.equal(journal.entries.length, 4);
  assert.deepEqual(journal.entries.map(row => row.slot).sort(), ['breakfast', 'dinner', 'lunch', 'snack']);
  assert.deepEqual(normalizeNutritionJournal(JSON.parse(JSON.stringify(journal))), journal);
});

test('unknown portions and individually unknown nutrients round-trip without claiming known zero', () => {
  const { journal } = applyMealOperations(emptyNutritionJournal(), batch(add('鸡胸肉', 'lunch', { amount: null, nutrients: { calories: 120, protein: null } })), 'chat-two', now);
  const entry = normalizeNutritionJournal(journal).entries[0];
  assert.equal(entry.agentFood.amount, null); assert.equal(entry.agentFood.values.protein, null);
  assert.equal(entry.agentFood.values.fiber, null); assert.equal(nutrientKnown(entry, 'protein'), false);
  assert.equal(nutrientKnown(entry, 'calories'), true); assert.equal(hasUnknownNutrition(entry), true);
});

test('operation retries replay receipts; same food in a different message remains a legitimate new record', () => {
  let applied = applyMealOperations(emptyNutritionJournal(), batch(add()), 'chat-three', now);
  const retry = applyMealOperations(applied.journal, batch(add()), 'chat-three', now);
  assert.equal(retry.journal, applied.journal); assert.equal(retry.result.replayed, true);
  applied = applyMealOperations(retry.journal, batch(add()), 'chat-four', now);
  assert.equal(applied.journal.entries.length, 2);
});

test('model updates original record then deletes it; a replay cannot resurrect deleted food', () => {
  let applied = applyMealOperations(emptyNutritionJournal(), batch(add()), 'chat-five', now);
  const id = applied.result.entryIds[0];
  applied = applyMealOperations(applied.journal, batch({ ...add(), action: 'update', entryId: id, amount: '3 个', nutrients: { calories: 210 } }), 'chat-six', now);
  assert.equal(applied.journal.entries.length, 1); assert.equal(applied.journal.entries[0].agentFood.amount, '3 个');
  applied = applyMealOperations(applied.journal, batch({ action: 'delete', entryId: id }), 'chat-seven', now);
  const reload = normalizeNutritionJournal(applied.journal);
  assert.equal(reload.entries.length, 0); assert.equal(JSON.stringify(reload).includes('鸡蛋'), false);
  const retry = applyMealOperations(reload, batch(add()), 'chat-five', now);
  assert.equal(retry.result.replayed, true); assert.equal(retry.journal.entries.length, 0);
});

test('invalid batch leaves all records and meal states untouched, including earlier valid operations', () => {
  const initial = emptyNutritionJournal();
  assert.throws(() => applyMealOperations(initial, batch(add(), add('坏数据', 'lunch', { nutrients: { calories: -1 } })), 'chat-eight', now));
  assert.deepEqual(initial, emptyNutritionJournal());
  assert.throws(() => applyMealOperations(initial, batch({ ...add(), action: 'update', entryId: 'missing' }), 'chat-nine', now), /不存在/);
  assert.throws(() => applyMealOperations(initial, batch(add('bad', 'lunch', { nutrients: 'not-object' })), 'chat-ten', now));
});

test('explicit skipped meals persist but adding food clears conflicting skipped state', () => {
  let applied = applyMealOperations(emptyNutritionJournal(), batch({ action: 'set_meal_status', date, slot: 'dinner', status: 'not_eaten' }), 'chat-eleven', now);
  assert.deepEqual(applied.journal.days[date].skippedSlots, ['dinner']);
  applied = applyMealOperations(applied.journal, batch(add('晚餐', 'dinner')), 'chat-twelve', now);
  assert.deepEqual(applied.journal.days[date].skippedSlots, []);
});

test('real repository commits after persistence, survives restart, serializes concurrent writes and returns failures', async () => {
  let fail = true;
  const h = repositoryHarness({ before: async event => { if (fail && event.key === 'nutrition_journal_v1') throw Error('disk full'); } });
  await h.load();
  await assert.rejects(h.store().applyMealOperations(batch(add()), 'chat-thirteen'), /disk full/);
  assert.equal(h.store().nutritionJournal.entries.length, 0); assert.equal(h.disk.has('nutrition_journal_v1'), false);
  fail = false;
  await Promise.all([h.store().applyMealOperations(batch(add()), 'chat-thirteen'), h.store().applyMealOperations(batch(add('米饭', 'lunch')), 'chat-fourteen')]);
  assert.equal(h.store().nutritionJournal.entries.length, 2);
  const reload = repositoryHarness({ initial: Object.fromEntries(h.disk) }); await reload.load();
  assert.equal(reload.store().nutritionStorageIssue, ''); assert.equal(reload.store().nutritionJournal.entries.length, 2);
  assert.equal((await reload.store().applyMealOperations(batch(add()), 'chat-thirteen')).replayed, true);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(reload.store().applyMealOperations(batch(add()), 'chat-fifteen', controller.signal), /取消/);
  assert.equal(reload.store().nutritionJournal.entries.length, 2);
  await reload.store().clearData(); assert.equal(reload.store().nutritionJournal.entries.length, 0);
  assert.equal(reload.disk.has('nutrition_journal_v1'), false);
});

test('tool loop exposes automatic meal writes and feeds actual persisted result back before model answer', async () => {
  const { personalChat, personalTools } = await import('../src/integrations/personalTools.mjs');
  const h = repositoryHarness(); await h.load(); let round = 0;
  assert.ok(personalTools.some(tool => tool.function.name === 'write_meal_records'));
  const answer = await personalChat({ date, messages: [{ role: 'user', content: '今早吃了两个鸡蛋' }],
    execute: async (name, args) => h.store().applyMealOperations(args, 'chat-sixteen'),
    client: { generate: async messages => {
      if (round++ === 0) {
        assert.match(messages[0].content, /无需用户另说/);
        return { role: 'assistant', content: null, tool_calls: [{ id: 'meal-call', type: 'function', function: { name: 'write_meal_records', arguments: JSON.stringify(batch(add())) } }] };
      }
      const result = JSON.parse(messages.at(-1).content);
      assert.equal(result.ok, true); assert.equal(h.store().nutritionJournal.entries.length, 1);
      return { content: '早餐已记录。' };
    } } });
  assert.equal(answer, '早餐已记录。');
});

test('meal UI is a read-only four-meal timeline without duplicate AI entry or manual food controls', () => {
  const ui = fs.readFileSync(path.join(__dirname, '../src/components/nutrition/MealTimeline.tsx'), 'utf8');
  const screen = fs.readFileSync(path.join(__dirname, '../src/screens/NutritionScreen.tsx'), 'utf8');
  assert.match(ui, /\['breakfast', 'lunch', 'dinner', 'snack'\]/);
  assert.doesNotMatch(ui + screen, /和 AI 记餐|对 AI 说说|name="edit"|name="trash"|添加早餐|添加午餐/);
  assert.match(screen, /<MealTimeline/); assert.match(screen, /<WeightTrendChart/);
});

test('unknown nutrition never qualifies for full-day calorie comparisons, even with an old completion flag', () => {
  const { journal } = applyMealOperations(emptyNutritionJournal(), batch(add('未知食物', 'lunch', { nutrients: null })), 'chat-seventeen', now);
  journal.days[date] = { targetHistory: [], confirmedSlots: ['breakfast', 'lunch', 'dinner', 'snack'], completedAt: now };
  const summary = summarizeNutritionWeek(journal, { age: 30, sex: 'male', height: 175, weight: 75, weightHistory: [] }, [], date);
  assert.equal(summary.recordedDays, 1); assert.equal(summary.completeDays, 0); assert.equal(summary.average, null);
});

test('queued canceled model writes do not land after another save completes', async () => {
  let unblock, entered;
  const started = new Promise(resolve => { entered = resolve; });
  const gate = new Promise(resolve => { unblock = resolve; });
  const h = repositoryHarness({ before: async event => { if (event.key === 'nutrition_journal_v1') { entered(); await gate; } } });
  await h.load();
  const first = h.store().applyMealOperations(batch(add()), 'chat-eighteen');
  await started;
  const controller = new AbortController();
  const second = h.store().applyMealOperations(batch(add('取消这项')), 'chat-nineteen', controller.signal);
  controller.abort(); unblock();
  await first; await assert.rejects(second, /取消/);
  assert.equal(h.store().nutritionJournal.entries.length, 1);
});

test('corrupt retry receipts are surfaced as a storage issue rather than silently discarded', async () => {
  const journal = emptyNutritionJournal(); journal.mealOperationReceipts = [{ id: 'bad receipt', requestId: 'chat', entryIds: [] }];
  const h = repositoryHarness({ initial: { nutrition_journal_v1: JSON.stringify(journal) } }); await h.load();
  assert.ok(h.store().nutritionStorageIssue); await assert.rejects(h.store().applyMealOperations(batch(add()), 'chat-twenty'));
  assert.equal(h.disk.get('nutrition_journal_v1'), JSON.stringify(journal));
});
