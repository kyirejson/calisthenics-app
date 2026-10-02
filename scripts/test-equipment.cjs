const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { test } = require('node:test');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { equipmentMovements } = require('../src/data/equipmentMovements.ts');
const { recommendPlanId, getPlanDay, getWeekSchedule } = require('../src/data/trainingPlans.ts');
const { EQUIPMENT_PLAN_ID } = require('../src/data/equipmentTraining.ts');
const { generatePersonalPlan } = require('../src/data/personalPlan.ts');
const profile = { goal: 'equipment', planId: EQUIPMENT_PLAN_ID, planStartedAt: '2026-09-30T00:00:00.000Z', experience: 'intermediate', frequency: 3, levels: { push: 5 }, nutritionGoal: 'maintain', dietPattern: 'balanced_cn' };

test('equipment catalogue has 112 unique entries without invented progression levels or doses', () => {
  assert.equal(equipmentMovements.length, 112); assert.equal(new Set(equipmentMovements.map(m => m.id)).size, 112);
  assert.deepEqual(['chest', 'shoulders', 'back', 'legs', 'core', 'arms'].map(group => equipmentMovements.filter(m => m.group === group).length), [20, 17, 17, 22, 14, 22]);
  for (const m of equipmentMovements) { assert.ok(m.targetMuscles && m.nameEn); assert.equal(m.step, undefined); assert.equal(m.standards, undefined); assert.equal(m.defaultPrescription, undefined); }
  for (const m of equipmentMovements) { assert.equal(m.imageMatch, undefined); assert.equal(m.imageNote, undefined); }
});
test('equipment uses its own plan, not the weight-loss plan generator', async () => {
  assert.equal(recommendPlanId(profile), EQUIPMENT_PLAN_ID);
  const current = getPlanDay(profile, new Date(2026, 8, 30));
  assert.equal(current.plan.frequency, 3); assert.equal(current.day.workoutId, 'equipment_v2_upper_lower_3_0'); assert.equal(current.day.title, '上肢训练 A');
  assert.equal(getWeekSchedule(profile, new Date(2026, 8, 30)).filter(day => day.workoutId).length, 3);
  await assert.rejects(generatePersonalPlan(profile, () => { throw Error('must not save'); }, () => {}), /暂无训练计划/);
});
test('retired book resources and import paths stay removed without changing the modern catalogue', () => {
  for (const file of ['src/data/private/equipmentResources.ts', 'src/data/private/equipmentImageMap.ts',
    'scripts/prepare-equipment-resources.cjs', 'docs/arnold-movement-image-matching-report.md', 'server/private/arnold-index.json']) {
    assert.equal(fs.existsSync(path.resolve(__dirname, '..', file)), false, file);
  }
  assert.equal(fs.existsSync(path.resolve(__dirname, '../assets/equipment-images')), false);
  for (const movement of equipmentMovements) assert.equal(movement.bookAnchor, undefined, movement.id);
  const original = fs.readFileSync(path.resolve(__dirname, '../src/data/originalResources.ts'), 'utf8');
  assert.doesNotMatch(original, /equipmentResources|private\/equipment/);
  assert.match(original, /recoveryOriginalTexts\[exerciseId\] \|\| originalTexts\[exerciseId\]/);
  assert.doesNotMatch(fs.readFileSync(path.resolve(__dirname, 'prepare-public-resources.cjs'), 'utf8'), /equipmentResources|EquipmentResource/);
  assert.equal(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8')).scripts['prepare:equipment'], undefined);
});

test('all 112 movements have unique full-size demo/thumbnail pairs with explicit generated provenance', () => {
  const crypto = require('node:crypto');
  const directory = path.resolve(__dirname, '../assets/equipment-demos');
  const provenance = JSON.parse(fs.readFileSync(path.join(directory, 'provenance.json'), 'utf8'));
  assert.equal(provenance.entries.length, 112);
  assert.deepEqual(provenance.entries.map(item => item.id).sort(), equipmentMovements.map(item => item.id).sort());
  const hashes = new Set();
  for (const entry of provenance.entries) {
    const movement = equipmentMovements.find(item => item.id === entry.id);
    assert.ok(movement, entry.id);
    assert.ok(entry?.variant, movement.id);
    assert.match(entry.provenance, /AI-generated.*not a photograph/);
    assert.ok(entry.width >= 1000 && entry.height >= 750, movement.id + ' full-size clarity');
    assert.ok(Math.abs(entry.width / entry.height - 4 / 3) < .02, movement.id + ' aspect ratio');
    for (const suffix of ['.jpg', '-thumb.jpg']) {
      const bytes = fs.readFileSync(path.join(directory, movement.id + suffix));
      assert.equal(bytes.readUInt16BE(0), 0xffd8);
      assert.ok(bytes.length > 10000, movement.id + suffix);
      if (suffix === '.jpg') hashes.add(crypto.createHash('sha256').update(bytes).digest('hex'));
    }
  }
  assert.equal(hashes.size, 112, 'no image reused for a different exercise');
  const map = fs.readFileSync(path.resolve(__dirname, '../src/data/equipmentArtwork.ts'), 'utf8');
  assert.equal((map.match(/source: require\(/g) || []).length, 112);
  assert.doesNotMatch(map, /arnold_image|https?:\/\//);
});
test('prisoner retrieval stays separate from equipment and rejects retired references', async t => {
  const { loadAssistantBooks } = await import('../server/book-knowledge.mjs');
  const { guardAdvice, adviceSystemPrompt, validateAdviceResult } = await import('../server/knowledge.mjs');
  const { createNutritionServer } = await import('../server/index.mjs');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'uncover-equipment-kb-'));
  t.after(() => fs.rmSync(directory, { recursive: true }));
  const knowledgeIndex = path.join(directory, 'cc.json');
  const arnoldId = 'arnold-' + 'a'.repeat(24), ccId = 'cc-' + 'b'.repeat(24);
  fs.writeFileSync(knowledgeIndex, JSON.stringify({ version: 1, chunks: [{ id: ccId, title: '囚徒健身 · 训练计划', text: '六艺训练与休息，循序练习俯卧撑。', path: 'cc.md', lineStart: 30, lineEnd: 32 }] }));
  const books = loadAssistantBooks({ knowledgeIndex });
  assert.deepEqual(books.counts, { prisoner: 1 });
  assert.deepEqual(books.retrieve('施瓦辛格卧推动作要点'), []);
  assert.equal(books.retrieve('囚徒六艺训练计划')[0].id, ccId);
  assert.deepEqual(books.retrieve('杠铃卧推要点'), []);
  assert.equal(books.retrieve('囚徒六艺训练计划\n施瓦辛格卧推', '囚徒六艺训练计划')[0].id, ccId);
  assert.deepEqual(books.retrieve('施瓦辛格和囚徒训练区别'), []);
  assert.equal(guardAdvice({ question: '施瓦辛格卧推动作要点', context: {} }), null);
  assert.ok(guardAdvice({ question: '施瓦辛格帮我制定减脂菜单', context: {} }));
  assert.ok(guardAdvice({ question: '施瓦辛格卧推动作要点', context: { age: 16 } }));
  assert.match(adviceSystemPrompt([]), /不得擅自生成或更改训练计划/);
  assert.doesNotMatch(adviceSystemPrompt([]), /施瓦辛格|两本书|两套原书|仅开放动作库/);
  assert.equal(validateAdviceResult({ answer: '控制动作。', sourceIds: [arnoldId] }, [], {}), null);
  let calls = 0;
  const server = createNutritionServer({ knowledgeIndex, apiKey: 'offline-fixture-key', fetchImpl: async (_, init) => {
    calls++; const messages = JSON.parse(init.body).messages;
    assert.ok(messages[0].content.includes(ccId)); assert.ok(!messages[0].content.includes(arnoldId));
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ answer: '原书强调循序练习，兼顾训练与休息。', sourceIds: [ccId] }) } }] }), { headers: { 'content-type': 'application/json' } });
  } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/v1/nutrition/advice`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: '囚徒六艺俯卧撑动作要点', context: {}, assistantMode: true }) });
  const result = await response.json(); assert.equal(response.status, 200); assert.equal(calls, 1); assert.equal(result.references[0].id, ccId); assert.equal(result.references[0].lineStart, 30); assert.ok(result.answer.length <= 50); assert.equal(result.action, undefined); assert.equal(result.intent, undefined);
});

test('removed Arnold knowledge returns no invented quote or paid call', async t => {
  const { createNutritionServer } = await import('../server/index.mjs');
  const server = createNutritionServer({ apiKey: 'offline-fixture-key', fetchImpl: () => { throw Error('must not call'); } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/v1/nutrition/advice`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: '施瓦辛格卧推动作要点', context: {} }) });
  const result = await response.json(); assert.equal(response.status, 200); assert.match(result.answer, /知识库已移除/); assert.equal(result.references, undefined); assert.deepEqual(result.sources, []);
});
