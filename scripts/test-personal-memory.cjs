const assert = require('node:assert/strict');
const { test } = require('node:test');
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const personal = require('../src/nutrition/personalKnowledge.ts');
const state = require('../src/nutrition/assistantState.ts');
const { assistantTrainingSnapshot } = require('../src/nutrition/assistantTraining.ts');
const auth = require('../src/nutrition/assistantAuthorization.ts');
const file = path.resolve(__dirname, '../src/nutrition/assistantArchive.ts');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
  { exports: exportsObject, require: id => id === 'expo-sqlite' ? { openDatabaseAsync: () => { throw Error('real native runtime not allowed in tests'); } } : createRequire(file)(id) });
function sqlite(t, intercept = () => {}) {
  const db = new DatabaseSync(':memory:'); t.after(() => db.close());
  const args = values => values.length === 1 && Array.isArray(values[0]) ? values[0] : values;
  const adapter = {
    async execAsync(sql) { await intercept(sql); db.exec(sql); },
    async runAsync(sql, ...values) { await intercept(sql); return db.prepare(sql).run(...args(values)); },
    async getFirstAsync(sql, ...values) { return db.prepare(sql).get(...args(values)); },
    async getAllAsync(sql, ...values) { return db.prepare(sql).all(...args(values)); },
    // Android can reject temporary connection teardown after FTS writes. The
    // archive must not open/close a second native connection for each message.
    async withExclusiveTransactionAsync() { throw Error('NativeDatabase.closeAsync: unable to close due to unfinalized statements'); },
  };
  let opens = 0;
  return { db, archive: exportsObject.createSQLiteArchive(async () => { opens++; return adapter; }), opens: () => opens };
}
const turn = (i, patch = {}) => ({ id: 'turn-' + i, createdAt: new Date(Date.UTC(2026, 8, 1, 0, i)).toISOString(), question: '普通训练问答', answer: '已整理训练需求。', topic: 'equipment', ...patch });
const profile = { name: 'DO_NOT_UPLOAD_NAME', goal: 'equipment', frequency: 6, equipmentSplit: 'ppl', planId: 'equipment_training_v2', age: 30, height: 175, weight: 75, sex: 'male', levels: {}, experience: 'advanced', planStartedAt: '2026-09-01T00:00:00.000Z' };
const draft = topic => ({ version: 1, topic, updatedAt: '2026-10-02T00:00:00.000Z', objective: '增肌', schedule: '每周六次', environment: '健身房', baseline: '持续训练中', priorities: '上胸', restrictions: '', diet: '不吃香菜' });

test('native archive uses one persistent connection and reads wait for atomic writes', async t => {
  let release, entered;
  const blocked = new Promise(resolve => { entered = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  let hold = true;
  const { archive, opens } = sqlite(t, async sql => {
    if (hold && sql.startsWith('INSERT INTO turn_search')) { hold = false; entered(); await gate; }
  });
  const write = archive.put(turn(0)); await blocked;
  let readFinished = false;
  const read = archive.list().then(rows => { readFinished = true; return rows; });
  await new Promise(resolve => setImmediate(resolve)); assert.equal(readFinished, false);
  release(); await write; assert.equal((await read)[0].id, 'turn-0');
  await Promise.all(Array.from({ length: 50 }, (_, i) => archive.put(turn(i + 1))));
  assert.equal((await archive.exportAll()).length, 51); assert.equal(opens(), 1);
});

test('failed index write rolls back the turn, then the queue accepts another write', async t => {
  let fail = true;
  const { archive, db } = sqlite(t, sql => {
    if (fail && sql.startsWith('INSERT INTO turn_search')) { fail = false; throw Error('index write failed'); }
  });
  await assert.rejects(archive.put(turn(0)), /index write failed/);
  assert.equal(db.prepare('SELECT count(*) AS n FROM turns').get().n, 0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM turn_search').get().n, 0);
  await archive.put(turn(1)); assert.equal((await archive.exportAll()).length, 1);
});

test('rollback failure quarantines the connection rather than continuing or deleting data', async t => {
  let fail = false;
  const { archive, db } = sqlite(t, sql => {
    if (fail && (sql.startsWith('INSERT INTO turn_search') || sql === 'ROLLBACK')) throw Error('database failed');
  });
  await archive.put(turn(0)); fail = true;
  await assert.rejects(archive.put(turn(1)), /事务未能恢复/);
  await assert.rejects(archive.clear(), /事务未能恢复/);
  await assert.rejects(archive.put(turn(2)), /事务未能恢复/);
  assert.equal(db.prepare('SELECT count(*) AS n FROM turns WHERE id=?').get('turn-0').n, 1);
});
test('six focused questions normalize per-topic profiles without altering actual training settings', () => {
  assert.equal(personal.personalQuestions.length, 6);
  assert.equal(personal.normalizePersonalProfile(draft('equipment')).priorities, '上胸');
  assert.equal(personal.normalizePersonalProfile({ ...draft('equipment'), priorities: 'a'.repeat(241) }), null);
  assert.equal(personal.normalizePersonalProfile({ ...draft('equipment'), topic: 'unknown' }), null);
  assert.deepEqual(personal.prefillPersonalProfile(profile, draft('equipment')), draft('equipment'));
  const normalized = state.normalizeAssistantState({ version: 1, personalProfiles: { equipment: draft('equipment'), street_mastery: draft('street_mastery'), weight_loss: draft('weight_loss') } });
  assert.equal(Object.keys(normalized.personalProfiles).length, 3);
  assert.equal(profile.frequency, 6);
});
test('SQLite migration retains more than thirty turns and cursor paging never repeats or loses records', async t => {
  const { archive } = sqlite(t); const rows = Array.from({ length: 140 }, (_, i) => turn(i));
  await archive.migrate(rows); await archive.migrate([turn(999)]);
  assert.equal((await archive.exportAll()).length, 140);
  const first = await archive.list(); assert.equal(first.length, 30); assert.equal(first[0].id, 'turn-139');
  const tail = first.at(-1); const second = await archive.list({ before: tail.createdAt + '|' + tail.id });
  assert.equal(second[0].id, 'turn-109'); assert.equal(new Set([...first, ...second].map(r => r.id)).size, 60);
  await archive.put({ ...rows[0], answer: '已记录这一餐。' });
  assert.equal((await archive.exportAll()).length, 140);
  assert.equal((await archive.exportAll())[0].answer, '已记录这一餐。');
});
test('Chinese recall reaches old history, filters topics and treats SQL text as data', async t => {
  const { archive, db } = sqlite(t);
  await archive.migrate([turn(0, { question: '我的重点是上胸与胸部训练' }), ...Array.from({ length: 130 }, (_, i) => turn(i + 1)), turn(200, { topic: 'street_mastery', question: '上胸重点' })]);
  const recalled = await archive.list({ question: '你还记得我的上胸重点吗', topic: 'equipment', limit: 8 });
  assert.equal(recalled[0].id, 'turn-0'); assert.equal(recalled.some(r => r.topic === 'street_mastery'), false);
  await archive.put(turn(300, { question: "我喜欢 SQL' OR 1=1 --" }));
  await archive.forget("' OR 1=1 --"); assert.equal((await archive.exportAll()).length, 132);
  assert.equal(db.prepare('SELECT count(*) AS n FROM turn_search').get().n, 132);
});
test('forget purges matching turns and their index; clearing cannot resurrect legacy migration', async t => {
  const { archive, db } = sqlite(t); const old = turn(0, { question: '我不吃香菜' });
  await archive.migrate([old, turn(1)]); await archive.forget('香菜');
  assert.deepEqual(await archive.list({ question: '香菜' }), []);
  assert.equal(db.prepare('SELECT count(*) AS n FROM turn_search').get().n, 1);
  await archive.clear(); await archive.migrate([old]); assert.equal((await archive.exportAll()).length, 0);
});
test('calendar retrieval respects the current local week instead of a rolling seven days', async t => {
  const { archive } = sqlite(t); const now = new Date(2026, 9, 2, 12);
  const at = (day, hour = 12) => new Date(2026, 8, day, hour).toISOString();
  await archive.migrate([turn(0, { createdAt: at(20) }), turn(1, { createdAt: at(21) }), turn(2, { createdAt: at(27, 23) }), turn(3, { createdAt: at(28, 0) })]);
  assert.deepEqual((await archive.list({ question: '上周', now })).map(r => r.id), ['turn-2', 'turn-1']);
});
test('permissions default to confirmation, reject stale context, and idempotency survives policy changes', () => {
  const s = state.emptyAssistantState(); const fact = { id: 'fact-1', kind: 'need', text: '增肌', createdAt: '2026-10-02T00:00:00.000Z' };
  const op = { id: 'remember-1', policyVersion: 0, confirmed: false, basis: 'current', kind: 'remember', fact };
  assert.throws(() => auth.authorizeAssistantOperation(s, op, 'current'), /确认/);
  assert.equal(auth.authorizeAssistantOperation(s, { ...op, confirmed: true }, 'current'), 'execute');
  s.authorization = { mode: 'full_access', policyVersion: 1 };
  assert.throws(() => auth.authorizeAssistantOperation(s, op, 'current'), /权限/);
  assert.throws(() => auth.authorizeAssistantOperation(s, { ...op, policyVersion: 1 }, 'changed'), /变化/);
  assert.equal(auth.authorizeAssistantOperation(s, { ...op, policyVersion: 1 }, 'current'), 'execute');
  s.receipts = { [op.id]: { kind: op.kind, payload: auth.assistantOperationPayload(op), createdAt: fact.createdAt } };
  assert.equal(auth.authorizeAssistantOperation(s, op, 'changed'), 'replay');
  assert.throws(() => auth.authorizeAssistantOperation(s, { ...op, fact: { ...fact, text: '不同操作' } }, 'current'), /重放/);
});
test('mandatory constraints are not silently discarded when building a bounded model context', () => {
  const facts = Array.from({ length: 55 }, (_, i) => ({ id: 'f' + i, kind: i < 8 ? 'avoid' : 'like', text: '食品' + i, createdAt: '2026-10-02T00:00:00.000Z' }));
  assert.equal(personal.selectPersonalFacts(facts, '食品54').length, 40);
  assert.equal(personal.selectPersonalFacts(facts, '食品54').filter(f => f.kind === 'avoid').length, 8);
  assert.throws(() => personal.selectPersonalFacts(facts.map(f => ({ ...f, kind: 'avoid' })), '忌口'), /没有丢弃/);
  assert.equal(facts.length, 55);
});
async function serverTests() {
  const { validateAdviceRequest } = await import('../server/validation.mjs');
  const { guardAdvice, adviceSystemPrompt, validateAdviceResult } = await import('../server/knowledge.mjs');
  const harness = { version: 2, mode: 'full_access', policyVersion: 1, personalProfile: draft('equipment'), evidence: [], trainingSnapshot: null };
  const request = (topic, frequency, split) => ({ question: '本周训练安排是什么？', context: {}, assistantMode: true, history: [], memory: [], harness: { ...harness, trainingSnapshot: assistantTrainingSnapshot({ ...profile, goal: topic, frequency, equipmentSplit: split }, [], {}, new Date('2026-10-02T04:00:00Z')) } });
  test('all three actual training topics serialize to the same bounded backend contract without personal identity', () => {
    for (const [topic, frequency, split] of [['equipment', 6, 'ppl'], ['street_mastery', 3], ['weight_loss', 3]]) {
      const raw = request(topic, frequency, split); const normalized = validateAdviceRequest(raw);
      assert.equal(normalized.harness.trainingSnapshot.week.length, 7);
      assert.equal(normalized.harness.trainingSnapshot.topic, topic);
      assert.equal(normalized.harness.trainingSnapshot.recentActual.length, 0);
      assert.equal(JSON.stringify(normalized).includes(profile.name), false);
      assert.equal(guardAdvice(normalized), null, 'read-only plans do not require nutrition targets');
    }
  });
  test('V2 rejects forged fields and overlong evidence while memory-only answers remain concise', () => {
    const raw = { question: '你记得我的需求吗', context: {}, assistantMode: true, harness };
    assert.equal(validateAdviceRequest(raw).harness.version, 2);
    assert.throws(() => validateAdviceRequest({ ...raw, harness: { ...harness, deleteAll: true } }));
    assert.throws(() => validateAdviceRequest({ ...raw, harness: { ...harness, policyVersion: -1 } }));
    assert.throws(() => validateAdviceRequest({ ...raw, harness: { ...harness, evidence: Array(9).fill({}) } }));
    assert.ok(validateAdviceResult({ answer: '你的训练重点是上胸。', sourceIds: [] }, [], raw));
    assert.equal(validateAdviceResult({ answer: '长'.repeat(51), sourceIds: [] }, [], { harness }), null);
    assert.equal(validateAdviceResult({ answer: '你的训练重点是上胸。', sourceIds: [] }, [], {}), null);
    assert.equal(validateAdviceResult({ answer: '增肌需要充足蛋白。', sourceIds: [] }, [], { ...raw, question: '蛋白质有什么作用' }), null);
    const allergies = { ...raw, question: '你记得我的过敏吗', context: { preferences: { allergens: ['milk'] } }, memory: [{ kind: 'allergy', text: '牛奶' }] };
    assert.equal(guardAdvice(allergies), null);
    assert.ok(validateAdviceResult({ answer: '你记录了牛奶过敏，我会避开。', sourceIds: [] }, [], allergies));
    assert.equal(validateAdviceResult({ answer: '记得吃牛奶。', sourceIds: [] }, [], allergies), null);
    assert.match(adviceSystemPrompt([], { harness }), /过去助手声称完成不是执行回执/);
    assert.ok(guardAdvice({ ...raw, question: '帮我制定减脂食谱' }));
  });
}
serverTests().catch(error => { console.error(error); process.exitCode = 1; });
