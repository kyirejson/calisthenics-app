const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { test } = require('node:test');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { FOODS } = require('../src/nutrition/catalog.ts');
const { emptyNutritionJournal, createIntakeEntry, createCustomFoodFromLabel, defaultNutritionPreferences, calculateTargets } = require('../src/nutrition/engine.ts');
const { localWeightDate } = require('../src/data/weightTrend.ts');
const { getNutritionTrainingContext } = require('../src/nutrition/training.ts');
const { prepareMealAdjustment } = require('../src/nutrition/adjustments.ts');
const filename = path.resolve(__dirname, '../src/store/AppStore.tsx');
const localRequire = createRequire(filename);
const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020 },
}).outputText;
const date = '2026-09-27';
const now = '2026-09-27T08:00:00.000Z';
const profile = { name: '隔离测试', age: 30, height: 175, weight: 75, sex: 'male', goal: 'street_mastery', nutritionGoal: 'maintain', dietPattern: 'balanced_cn', frequency: 3, levels: {}, experience: 'beginner', planStartedAt: now };
const input = id => ({ id, date, slot: 'lunch', name: '称重食物', source: 'manual', portions: [{ foodId: FOODS[0].id, grams: 100 }] });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const turn = () => new Promise(resolve => setImmediate(resolve));
const { assistantDataBasis } = require('../src/nutrition/assistantAuthorization.ts');

// Exercise the real provider callbacks with reusable hook state and isolated in-memory
// AsyncStorage. No browser, native runtime, user storage or extra test dependency is used.
function harness({ initial = {}, before = async () => {}, readBefore = async () => {}, deletePhotos, openURL = async () => {}, canOpenURL = async () => true } = {}) {
  const disk = new Map(Object.entries(initial));
  const { rankArchive, validatedTurn } = require('../src/nutrition/assistantArchiveCore.ts');
  const archiveKey = '__test_archive';
  const archived = () => JSON.parse(disk.get(archiveKey) || '{"imported":false,"rows":[]}');
  const writeArchive = value => disk.set(archiveKey, JSON.stringify(value));
  const assistantArchive = {
    async migrate(rows) { const a = archived(); if (!a.imported) writeArchive({ imported: true, rows: rows.map(validatedTurn) }); },
    async put(row) { const a = archived(); writeArchive({ ...a, rows: [...a.rows.filter(t => t.id !== row.id), validatedTurn(row)] }); },
    async list(query) { return rankArchive(archived().rows, query); },
    async forget(text) { const a = archived(); writeArchive({ ...a, rows: a.rows.filter(t => !t.question.includes(text) && !t.answer.includes(text)) }); },
    async clear() { writeArchive({ ...archived(), rows: [] }); },
    async exportAll() { return archived().rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt)); },
  };
  const storage = {
    getItem: async key => { await readBefore(key); return disk.get(key) ?? null; },
    multiGet: async keys => keys.map(key => [key, disk.get(key) ?? null]),
    setItem: async (key, value) => { await before({ kind: 'set', key, value }); disk.set(key, value); },
    multiSet: async pairs => { await before({ kind: 'multiSet', pairs }); pairs.forEach(([key, value]) => disk.set(key, value)); },
    multiRemove: async keys => { await before({ kind: 'remove', keys }); keys.forEach(key => disk.delete(key)); },
  };
  const cells = [], refs = [], effects = [], warnings = [];
  let stateIndex = 0, refIndex = 0, rendered = false;
  const react = {
    createContext: () => ({ Provider: 'Provider' }),
    useState: initialValue => {
      const index = stateIndex++;
      if (!(index in cells)) cells[index] = typeof initialValue === 'function' ? initialValue() : initialValue;
      return [cells[index], value => { cells[index] = typeof value === 'function' ? value(cells[index]) : value; }];
    },
    useRef: current => { const index = refIndex++; if (!(index in refs)) refs[index] = { current }; return refs[index]; },
    useMemo: fn => fn(), useCallback: fn => fn,
    useEffect: fn => { if (!rendered) effects.push(fn); },
    createElement: (type, props) => ({ type, props }),
  };
  const exportsObject = {};
  vm.runInNewContext(source, {
    exports: exportsObject, require: id => id === 'react' ? react : id === '@react-native-async-storage/async-storage' ? storage
      : id === 'react-native' ? { Platform: { OS: 'android' }, Linking: { openURL, canOpenURL } }
      : id === '../nutrition/assistantArchive' ? { assistantArchive }
      : id === '../nutrition/photoStorage' && deletePhotos ? { deleteStoredPhotos: deletePhotos } : localRequire(id),
    console: { warn: (...items) => warnings.push(items) }, Promise, Date,
  }, { filename });
  const store = () => {
    stateIndex = 0; refIndex = 0;
    const value = exportsObject.AppStoreProvider({ children: null }).props.value;
    rendered = true;
    return value;
  };
  store();
  return { disk, store, warnings,
    load: async () => {
      effects.forEach(effect => effect());
      for (let attempt = 0; attempt < 50 && !store().ready; attempt++) await turn();
      assert.equal(store().ready, true, 'initial storage loading must complete');
    },
  };
}

test('Harness V2 persists topic profiles and execution policy without mutating actual plans', async () => {
  const h = harness({ initial: { user_profile: JSON.stringify(profile) } }); await h.load();
  const before = JSON.stringify(h.store().profile);
  const personal = { version: 1, topic: 'street_mastery', updatedAt: now, objective: '自重技能', schedule: '每周三次', environment: '户外', baseline: '', priorities: '引体向上', restrictions: '', diet: '' };
  await h.store().savePersonalTrainingProfile(personal); await h.store().setAssistantAuthorization('full_access');
  assert.equal(JSON.stringify(h.store().profile), before);
  const restart = harness({ initial: Object.fromEntries(h.disk) }); await restart.load();
  assert.deepEqual(restart.store().nutritionJournal.assistant.personalProfiles.street_mastery, personal);
  assert.equal(restart.store().nutritionJournal.assistant.authorization.mode, 'full_access');
  await assert.rejects(restart.store().savePersonalTrainingProfile({ ...personal, topic: 'equipment' }), /专题/);
});
test('Harness V2 confirms or directly commits intake once, with persistent receipts and unchanged database math', async () => {
  const h = harness({ initial: { user_profile: JSON.stringify(profile) } }); await h.load();
  const basis = () => { const s = h.store(); return assistantDataBasis(s.nutritionJournal, s.profile, s.sessions, s.dailyEdits); };
  const operation = { id: 'intake-one', kind: 'log_intake', input: input('intake-one'), confirmed: false, policyVersion: 0, basis: basis() };
  await assert.rejects(h.store().executeAssistantOperation(operation), /确认/);
  assert.equal(h.store().nutritionJournal.entries.length, 0);
  await h.store().setAssistantAuthorization('full_access');
  const accepted = { ...operation, policyVersion: 1, basis: basis() };
  await Promise.all([h.store().executeAssistantOperation(accepted), h.store().executeAssistantOperation(accepted)]);
  assert.equal(h.store().nutritionJournal.entries.length, 1);
  assert.deepEqual(h.store().nutritionJournal.entries[0].nutrients, createIntakeEntry(input('intake-one'), emptyNutritionJournal()).nutrients);
  const restart = harness({ initial: Object.fromEntries(h.disk) }); await restart.load();
  await restart.store().executeAssistantOperation(accepted); assert.equal(restart.store().nutritionJournal.entries.length, 1);
  await assert.rejects(restart.store().executeAssistantOperation({ ...accepted, input: { ...accepted.input, name: '改写' } }), /重放/);
});

test('personal agent training overlay and receipt commit together, reload, invalidate stale cards and leave base history untouched', async () => {
  const { explicitTrainingIntent } = require('../src/agent/trainingIntent.mjs');
  const { prepareTrainingAdjustment } = require('../src/agent/trainingActions.ts');
  const { getPlanDay } = require('../src/data/trainingPlans.ts');
  const { equipmentSessionPlan, EQUIPMENT_PLAN_ID } = require('../src/data/equipmentTraining.ts');
  const p = { ...profile, goal: 'equipment', frequency: 6, equipmentSplit: 'ppl', experience: 'advanced', planId: EQUIPMENT_PLAN_ID, planStartedAt: new Date().toISOString() };
  const h = harness({ initial: { user_profile: JSON.stringify(p) } }); await h.load();
  const s = h.store(), base = h.disk.get('user_profile');
  const draft = prepareTrainingAdjustment(s.profile, s.sessions, s.dailyEdits, explicitTrainingIntent('今天训练减载'));
  const operation = { id: 'training_adjustment-qa', kind: 'training_adjustment', draft, confirmed: false, policyVersion: 0, basis: assistantDataBasis(s.nutritionJournal, s.profile, s.sessions, s.dailyEdits) };
  await assert.rejects(s.executeAssistantOperation(operation), /确认/);
  await s.executeAssistantOperation({ ...operation, confirmed: true });
  assert.equal(h.disk.get('user_profile'), base); assert.equal(h.store().sessions.length, 0);
  assert.ok(h.store().profile.agentTrainingOverlay); assert.ok(h.store().nutritionJournal.assistant.receipts[operation.id]);
  const next = h.store(), course = getPlanDay(next.profile).day.workoutId;
  assert.deepEqual(equipmentSessionPlan(course, next.profile).items.map(i => i.targetSets), equipmentSessionPlan(course, { ...next.profile, agentTrainingOverlay: undefined }).items.map(i => Math.max(1, Math.round(i.targetSets / 2))));
  const restarted = harness({ initial: Object.fromEntries(h.disk) }); await restarted.load();
  assert.deepEqual(restarted.store().profile.agentTrainingOverlay, next.profile.agentTrainingOverlay);
  await restarted.store().executeAssistantOperation(operation);
  await assert.rejects(restarted.store().executeAssistantOperation({ ...operation, id: 'training-stale', confirmed: true }), /变化/);
});

test('failed training tool write leaves both base plan and overlay untouched and later writes remain usable', async () => {
  const { explicitTrainingIntent } = require('../src/agent/trainingIntent.mjs');
  const { prepareTrainingAdjustment } = require('../src/agent/trainingActions.ts');
  let fail = false; const h = harness({ initial: { user_profile: JSON.stringify({ ...profile, goal: 'equipment', frequency: 6, equipmentSplit: 'ppl', planStartedAt: new Date().toISOString() }) }, before: async event => { if (fail && event.key === 'nutrition_journal_v1') throw Error('QA disk failure'); } }); await h.load();
  await h.store().setAssistantAuthorization('full_access');
  const s = h.store(), draft = prepareTrainingAdjustment(s.profile, [], {}, explicitTrainingIntent('今天训练减载'));
  const operation = { id: 'training-failed', kind: 'training_adjustment', draft, confirmed: false, policyVersion: 1, basis: assistantDataBasis(s.nutritionJournal, s.profile, [], {}) };
  fail = true; await assert.rejects(s.executeAssistantOperation(operation), /disk failure/); assert.equal(h.store().profile.agentTrainingOverlay, undefined); assert.equal(h.store().nutritionJournal.assistant.receipts?.[operation.id], undefined);
  fail = false; await h.store().executeAssistantOperation(operation); assert.ok(h.store().profile.agentTrainingOverlay);
});

for (const command of ['今天和明天训练交换', '今天训练移到明天']) test('manual additions follow ' + command + ', support writes, reload and undo without mutating base dates', async () => {
  const { explicitTrainingIntent } = require('../src/agent/trainingIntent.mjs');
  const { prepareTrainingAdjustment } = require('../src/agent/trainingActions.ts');
  const { getPlanDay } = require('../src/data/trainingPlans.ts');
  const { dailyWorkoutKey, trainingDateKey } = require('../src/data/sessionRecords.ts');
  const { exercises } = require('../src/data/catalog.ts');
  const today = new Date(), tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const p = { ...profile, goal: 'equipment', frequency: 6, equipmentSplit: 'ppl', planStartedAt: today.toISOString() };
  const h = harness({ initial: { user_profile: JSON.stringify(p) } }); await h.load();
  const a = trainingDateKey(today), b = trainingDateKey(tomorrow), course = getPlanDay(h.store().profile, today).day.workoutId;
  await h.store().addDailyExercise(a, course, exercises[0].id);
  const execute = async (store, text, id) => {
    const draft = prepareTrainingAdjustment(store.profile, store.sessions, store.dailyEdits, explicitTrainingIntent(text));
    await store.executeAssistantOperation({ id, kind: 'training_adjustment', draft, confirmed: true, policyVersion: 0, basis: assistantDataBasis(store.nutritionJournal, store.profile, store.sessions, store.dailyEdits) });
  };
  await execute(h.store(), command, 'move-additions');
  assert.equal(h.store().dailyEdits[dailyWorkoutKey(a, course)], undefined);
  assert.deepEqual([...h.store().dailyEdits[dailyWorkoutKey(b, course)].exerciseIds], [exercises[0].id]);
  await h.store().addDailyExercise(b, course, exercises[1].id);
  const raw = JSON.parse(h.disk.get('daily_workout_edits'));
  assert.deepEqual(raw[dailyWorkoutKey(a, course)].exerciseIds, [exercises[0].id, exercises[1].id]);
  assert.equal(raw[dailyWorkoutKey(b, course)], undefined);
  const restart = harness({ initial: Object.fromEntries(h.disk) }); await restart.load();
  assert.deepEqual([...restart.store().dailyEdits[dailyWorkoutKey(b, course)].exerciseIds], [exercises[0].id, exercises[1].id]);
  await restart.store().removeDailyExercise(b, course, exercises[0].id);
  await execute(restart.store(), '撤销今天训练调整', 'undo-additions');
  assert.deepEqual([...restart.store().dailyEdits[dailyWorkoutKey(a, course)].exerciseIds], [exercises[1].id]);
  assert.equal(restart.store().dailyEdits[dailyWorkoutKey(b, course)], undefined);
});

test('training write guard prevents manual edits during an overlay commit and releases after success or failure', async () => {
  const { explicitTrainingIntent } = require('../src/agent/trainingIntent.mjs');
  const { prepareTrainingAdjustment } = require('../src/agent/trainingActions.ts');
  const { exercises } = require('../src/data/catalog.ts');
  const gate = deferred(); let wait = false;
  const h = harness({ initial: { user_profile: JSON.stringify({ ...profile, goal: 'equipment', frequency: 6, equipmentSplit: 'ppl', planStartedAt: new Date().toISOString() }) }, before: async event => { if (wait && event.key === 'nutrition_journal_v1') await gate.promise; } });
  await h.load(); const s = h.store(), draft = prepareTrainingAdjustment(s.profile, [], {}, explicitTrainingIntent('今天训练减载'));
  wait = true;
  const task = s.executeAssistantOperation({ id: 'guarded-deload', kind: 'training_adjustment', draft, confirmed: true, policyVersion: 0, basis: assistantDataBasis(s.nutritionJournal, s.profile, [], {}) });
  await assert.rejects(h.store().addDailyExercise(date, 'custom_daily', exercises[0].id), /正在保存训练调整/);
  await assert.rejects(h.store().patchProfile({ weight: 80 }), /正在保存训练调整/);
  gate.resolve(); await task; wait = false;
  await h.store().addDailyExercise(date, 'custom_daily', exercises[0].id);
  assert.ok(h.store().dailyEdits['2026-9-27:custom_daily']);
});

test('music opening checks permissions, uses configured scheme, persists receipt and replay does not launch twice', async () => {
  const opened = []; const h = harness({ initial: { user_profile: JSON.stringify(profile) }, openURL: async url => opened.push(url) }); await h.load();
  await h.store().setAgentPreferences({ musicPlaylist: '123456' });
  const s = h.store(), operation = { id: 'music-qa', kind: 'open_music', playlist: '123456', confirmed: false, policyVersion: 0, basis: assistantDataBasis(s.nutritionJournal, s.profile, s.sessions, s.dailyEdits) };
  await assert.rejects(s.executeAssistantOperation(operation), /确认/); assert.equal(opened.length, 0);
  await s.executeAssistantOperation({ ...operation, confirmed: true }); await h.store().executeAssistantOperation(operation);
  assert.deepEqual(opened, ['orpheus://playlist/123456']);
});

test('dispatched music with failed receipt reports partial success rather than pretending nothing happened', async () => {
  let fail = false; const opened = [];
  const h = harness({ initial: { user_profile: JSON.stringify(profile) }, openURL: async url => opened.push(url), before: async event => { if (fail && event.key === 'nutrition_journal_v1') throw Error('disk failed'); } });
  await h.load(); await h.store().setAgentPreferences({ musicPlaylist: '123456' });
  const s = h.store(), operation = { id: 'music-partial', kind: 'open_music', playlist: '123456', confirmed: true, policyVersion: 0, basis: assistantDataBasis(s.nutritionJournal, s.profile, s.sessions, s.dailyEdits) };
  fail = true; await assert.rejects(s.executeAssistantOperation(operation), /请求已发出.*不要重复/);
  assert.equal(opened.length, 1); assert.equal(h.store().nutritionJournal.assistant.receipts?.[operation.id], undefined);
});

test('an unavailable music scheme falls back to the official web URL without claiming an installed app', async () => {
  const opened = []; const h = harness({ initial: { user_profile: JSON.stringify(profile) }, canOpenURL: async () => false, openURL: async url => opened.push(url) });
  await h.load(); await h.store().setAgentPreferences({ musicPlaylist: '123456' });
  const s = h.store(); await s.executeAssistantOperation({ id: 'music-web', kind: 'open_music', playlist: '123456', confirmed: true, policyVersion: 0, basis: assistantDataBasis(s.nutritionJournal, s.profile, s.sessions, s.dailyEdits) });
  assert.deepEqual(opened, ['https://music.163.com/#/playlist?id=123456']);
});

test('a rejected music open call leaves no success receipt', async () => {
  const h = harness({ initial: { user_profile: JSON.stringify(profile) }, openURL: async () => { throw Error('OS rejected the link'); } });
  await h.load(); await h.store().setAgentPreferences({ musicPlaylist: '123456' });
  const s = h.store(), operation = { id: 'music-rejected', kind: 'open_music', playlist: '123456', confirmed: true, policyVersion: 0, basis: assistantDataBasis(s.nutritionJournal, s.profile, s.sessions, s.dailyEdits) };
  await assert.rejects(s.executeAssistantOperation(operation), /OS rejected/);
  assert.equal(h.store().nutritionJournal.assistant.receipts?.[operation.id], undefined);
});

test('concurrent proactive dismissals merge the latest preferences instead of restoring stale lists', async () => {
  const h = harness({ initial: { user_profile: JSON.stringify(profile) } }); await h.load();
  await Promise.all([h.store().setAgentPreferences(current => ({ dismissed: [...current.dismissed, 'review:2026-10-02'] })), h.store().setAgentPreferences(current => ({ dismissed: [...current.dismissed, 'training:qa-two'] }))]);
  assert.deepEqual(Array.from(h.store().nutritionJournal.assistant.agentPreferences.dismissed), ['review:2026-10-02', 'training:qa-two']);
});
test('meal state tool confirms or executes once under full access and survives restart without food entries', async () => {
  const h = harness({ initial: { user_profile: JSON.stringify(profile) } }); await h.load();
  const today = localWeightDate(new Date()), createdAt = new Date().toISOString();
  const basis = () => { const s = h.store(); return assistantDataBasis(s.nutritionJournal, s.profile, s.sessions, s.dailyEdits); };
  await h.store().appendAssistantConversation({ id: 'skip-qa', question: '早餐没吃', answer: '待确认早餐状态。', createdAt });
  const operation = { id: 'meal_status-skip-qa', kind: 'meal_status', date: today, slot: 'breakfast', status: 'not_eaten', confirmed: false, policyVersion: 0, basis: basis() };
  await assert.rejects(h.store().executeAssistantOperation(operation), /确认/);
  await h.store().executeAssistantOperation({ ...operation, confirmed: true });
  assert.deepEqual(h.store().nutritionJournal.days[today].skippedSlots, ['breakfast']);
  assert.equal(h.store().nutritionJournal.days[today].completedAt, null); assert.equal(h.store().nutritionJournal.entries.length, 0);
  assert.match((await h.store().readAssistantHistory({ limit: 1 }))[0].answer, /标为没吃/);
  const restored = harness({ initial: Object.fromEntries(h.disk) }); await restored.load();
  await restored.store().executeAssistantOperation(operation);
  assert.deepEqual(restored.store().nutritionJournal.days[today].skippedSlots, ['breakfast']);
  await restored.store().setAssistantAuthorization('full_access');
  const s = restored.store();
  await restored.store().executeAssistantOperation({ ...operation, id: 'meal_status-direct-qa', slot: 'dinner', policyVersion: 1, basis: assistantDataBasis(s.nutritionJournal, s.profile, s.sessions, s.dailyEdits) });
  assert.deepEqual(restored.store().nutritionJournal.days[today].skippedSlots, ['breakfast', 'dinner']);
  assert.equal(restored.store().nutritionJournal.entries.length, 0);
});

test('failed optional meal state persistence leaves UI state untouched and the next write remains usable', async () => {
  let fail = true;
  const h = harness({ before: async event => { if (fail && event.key === 'nutrition_journal_v1') throw Error('QA meal state disk full'); } });
  const today = localWeightDate(new Date());
  await assert.rejects(h.store().setNutritionMealStatus(today, 'breakfast', 'not_eaten'), /disk full/);
  assert.equal(h.store().nutritionJournal.days[today], undefined);
  fail = false; await h.store().setNutritionMealStatus(today, 'breakfast', 'not_eaten');
  assert.deepEqual(h.store().nutritionJournal.days[today].skippedSlots, ['breakfast']);
});

test('full-access menu tool validates locally, commits once and never turns recommendations into intake', async () => {
  const h = harness(); await h.store().saveProfile(profile);
  await h.store().saveNutritionPreferences({ ...defaultNutritionPreferences(profile), screeningCompletedAt: new Date().toISOString() });
  await h.store().setAssistantAuthorization('full_access');
  const current = h.store(), today = localWeightDate(new Date());
  const training = getNutritionTrainingContext(current.profile, current.sessions, current.dailyEdits, today);
  const result = prepareMealAdjustment(current.profile, current.nutritionJournal, training, today, { type: 'swap_meal', slot: 'dinner', focus: 'balanced' });
  assert.equal(result.status, 'ready');
  const operation = { id: 'meal-once', kind: 'meal', draft: result.draft, confirmed: false, policyVersion: 1, basis: assistantDataBasis(current.nutritionJournal, current.profile, current.sessions, current.dailyEdits) };
  await h.store().executeAssistantOperation(operation); const saved = h.disk.get('nutrition_journal_v1');
  await h.store().executeAssistantOperation(operation); assert.equal(h.disk.get('nutrition_journal_v1'), saved);
  assert.ok(h.store().nutritionJournal.mealOverrides[today + ':dinner']); assert.equal(h.store().nutritionJournal.entries.length, 0);
});
test('failed memory deletion restores archived turns rather than leaving half-deleted memory', async () => {
  let fail = false;
  const h = harness({ before: async event => { if (fail && event.key === 'nutrition_journal_v1') throw Error('QA disk full'); } });
  const fact = { id: 'forget-one', kind: 'avoid', text: '香菜', createdAt: now };
  await h.store().saveAssistantFact(fact);
  await h.store().appendAssistantConversation({ id: 'forget-turn', createdAt: now, question: '我不吃香菜', answer: '已记住。' });
  fail = true; await assert.rejects(h.store().deleteAssistantFact(fact.id), /disk full/);
  assert.equal(h.store().nutritionJournal.assistant.facts.length, 1);
  assert.equal((await h.store().readAssistantHistory({ question: '香菜' })).length, 1);
  fail = false; await h.store().deleteAssistantFact(fact.id);
  assert.equal((await h.store().readAssistantHistory({ question: '香菜' })).length, 0);
});
test('archive exports and retrieves all old turns rather than only the latest display page', async () => {
  const old = { id: 'old', createdAt: now, question: '上胸是重点', answer: '已了解训练重点。', topic: 'equipment' };
  const h = harness();
  await h.store().appendAssistantConversation(old);
  for (let i = 0; i < 65; i++) await h.store().appendAssistantConversation({ id: 'archive-' + i, createdAt: new Date(Date.parse(now) + 1000 * (i + 1)).toISOString(), question: '普通问题', answer: '普通回答。', topic: 'equipment' });
  assert.equal(h.store().nutritionJournal.assistant.conversations.length, 30);
  assert.equal((await h.store().readAssistantHistory({ question: '记得上胸吗', topic: 'equipment' }))[0].id, 'old');
  assert.equal(JSON.parse(await h.store().exportData()).data.assistant_archive_v2.length, 66);
});
test('equipment goal persists across restart without overwriting nutrition settings or levels', async () => {
  const selected = { ...profile, goal: 'equipment', nutritionGoal: 'muscle_gain', dietPattern: 'keto', levels: { push: 7 }, planLevels: { push: 6 } };
  const journal = emptyNutritionJournal();
  const h = harness({ initial: { user_profile: JSON.stringify(selected), nutrition_journal: JSON.stringify(journal) } });
  await h.load();
  assert.equal(h.store().profile.goal, 'equipment'); assert.equal(h.store().profile.planId, 'equipment_training_v2');
  assert.equal(h.store().profile.nutritionGoal, 'muscle_gain'); assert.equal(h.store().profile.dietPattern, 'keto');
  await h.store().patchProfile({});
  const saved = JSON.parse(h.disk.get('user_profile'));
  assert.equal(saved.levels.push, 7); assert.equal(saved.planLevels.push, 6); assert.equal(saved.nutritionGoal, 'muscle_gain');
});
test('equipment split persists, obsolete time/spec fields are pruned and incompatible frequency is constrained', async () => {
  const selected = { ...profile, goal: 'equipment', equipmentSplit: 'bro', equipmentSpec: 'ultra', frequency: 6, sessionMinutes: 75, planId: 'equipment_training_v1' };
  const h = harness({ initial: { user_profile: JSON.stringify(selected) } });
  await h.load();
  assert.equal(h.store().profile.frequency, 6); assert.equal(h.store().profile.equipmentSpec, undefined);
  assert.equal(h.store().profile.sessionMinutes, undefined);
  await h.store().patchProfile({ equipmentSplit: 'ppl', frequency: 6, sessionMinutes: 75, equipmentSpec: 'mini' });
  const saved = JSON.parse(h.disk.get('user_profile'));
  assert.equal(saved.equipmentSplit, 'ppl'); assert.equal(saved.frequency, 6); assert.equal(saved.sessionMinutes, undefined); assert.equal(saved.equipmentSpec, undefined);
  const restart = harness({ initial: { user_profile: JSON.stringify(saved) } }); await restart.load();
  assert.equal(restart.store().profile.equipmentSplit, 'ppl'); assert.equal(restart.store().profile.frequency, 6);
  await restart.store().patchProfile({ frequency: 1 });
  assert.equal(restart.store().profile.frequency, 3, 'PPL cannot use one session weekly');
});

test('removed equipment starter setting is pruned when loading and saving the profile', async () => {
  const selected = { ...profile, goal: 'equipment', equipmentFoundation: true };
  const h = harness({ initial: { user_profile: JSON.stringify(selected) } }); await h.load();
  assert.equal('equipmentFoundation' in h.store().profile, false);
  await h.store().patchProfile({});
  assert.equal('equipmentFoundation' in JSON.parse(h.disk.get('user_profile')), false);
});

test('equipment low-frequency upper/lower, weekdays, gear, priority and replacements survive restart', async () => {
  const selected = { ...profile, goal: 'equipment', equipmentSplit: 'upper_lower', frequency: 2,
    equipmentTrainingDays: [1, 4], equipmentAvailableGear: ['dumbbell', 'bodyweight'], equipmentPriority: 'chest',
    equipmentMovementOverrides: { equipment_v2_upper_lower_2_0: { equipment_chest_03: 'equipment_chest_05' } } };
  const h = harness({ initial: { user_profile: JSON.stringify(selected) } }); await h.load();
  await h.store().patchProfile({});
  const saved = JSON.parse(h.disk.get('user_profile'));
  assert.equal(saved.frequency, 2); assert.deepEqual(saved.equipmentTrainingDays, [1, 4]);
  assert.deepEqual(saved.equipmentAvailableGear, selected.equipmentAvailableGear);
  assert.equal(saved.equipmentPriority, 'chest'); assert.deepEqual(saved.equipmentMovementOverrides, selected.equipmentMovementOverrides);
  const restart = harness({ initial: { user_profile: JSON.stringify(saved) } }); await restart.load();
  assert.equal(restart.store().profile.frequency, 2); assert.equal(restart.store().profile.equipmentTrainingDays[0], 1);
  assert.equal(restart.store().profile.equipmentMovementOverrides.equipment_v2_upper_lower_2_0.equipment_chest_03, 'equipment_chest_05');
});

test('malformed equipment preferences cannot introduce unsupported weekdays, gear or override values', async () => {
  const selected = { ...profile, goal: 'equipment', equipmentSplit: 'bro', frequency: 2,
    equipmentTrainingDays: [8, '3', -1], equipmentAvailableGear: ['dumbbell', 'unknown'], equipmentPriority: 'unknown',
    equipmentMovementOverrides: { bad: { equipment_chest_03: 'equipment_chest_05' }, equipment_v2_bro_5_0: { bad: 'equipment_chest_05', equipment_chest_03: 12 } } };
  const h = harness({ initial: { user_profile: JSON.stringify(selected) } }); await h.load();
  await h.store().patchProfile({});
  const saved = JSON.parse(h.disk.get('user_profile'));
  assert.equal(saved.frequency, 5); assert.equal(saved.equipmentTrainingDays.length, 5);
  assert.ok(saved.equipmentTrainingDays.every(day => Number.isInteger(day) && day >= 0 && day <= 6));
  assert.deepEqual(saved.equipmentAvailableGear, ['dumbbell']); assert.equal(saved.equipmentPriority, 'balanced');
  assert.deepEqual(saved.equipmentMovementOverrides, { equipment_v2_bro_5_0: {} });
});

test('topic switching preserves equipment split, frequency, weekdays, start, gear and substitutions across restart', async () => {
  const selected = { ...profile, goal: 'equipment', planId: 'equipment_training_v2', frequency: 4, equipmentSplit: 'ppl',
    equipmentTrainingDays: [1, 2, 4, 6], equipmentAvailableGear: ['machine', 'cable', 'dumbbell'],
    equipmentMovementOverrides: { equipment_v2_ppl_4_0: { equipment_chest_03: 'equipment_chest_05' } } };
  const h = harness({ initial: { user_profile: JSON.stringify(selected) } }); await h.load();
  const original = JSON.parse(h.disk.get('user_profile'));
  await h.store().switchTrainingGoal('street_mastery');
  assert.equal(h.store().profile.frequency, 3);
  await h.store().patchProfile({ frequency: 2, planStartedAt: '2026-09-28T08:00:00.000Z' });
  await h.store().switchTrainingGoal('weight_loss');
  await h.store().switchTrainingGoal('equipment');
  const equipment = JSON.parse(h.disk.get('user_profile'));
  for (const key of ['frequency', 'planStartedAt', 'equipmentSplit', 'equipmentTrainingDays', 'equipmentAvailableGear', 'equipmentMovementOverrides']) {
    assert.deepEqual(equipment[key], original[key], key);
  }
  const restart = harness({ initial: { user_profile: h.disk.get('user_profile') } }); await restart.load();
  await restart.store().switchTrainingGoal('street_mastery');
  assert.equal(restart.store().profile.frequency, 2);
  assert.equal(restart.store().profile.planStartedAt, '2026-09-28T08:00:00.000Z');
  await restart.store().switchTrainingGoal('equipment');
  assert.equal(restart.store().profile.frequency, 4);
  assert.deepEqual(JSON.parse(restart.disk.get('user_profile')).equipmentTrainingDays, [1, 2, 4, 6]);
});

test('topic switching shares the profile write queue and failed persistence rolls back', async () => {
  let fail = false;
  const h = harness({ initial: { user_profile: JSON.stringify(profile) },
    before: async op => { if (fail && op.key === 'user_profile') throw new Error('isolated switch failure'); } });
  await h.load();
  const original = h.disk.get('user_profile');
  fail = true;
  await assert.rejects(h.store().switchTrainingGoal('equipment'), /isolated switch failure/);
  assert.equal(h.store().profile.goal, 'street_mastery'); assert.equal(h.disk.get('user_profile'), original);
  fail = false;
  const store = h.store();
  await Promise.all([store.patchProfile({ weight: 80 }), store.switchTrainingGoal('equipment')]);
  assert.equal(h.store().profile.goal, 'equipment'); assert.equal(h.store().profile.weight, 80);
});

test('explicitly enabling a retired topic creates an active plan rather than restoring retired configuration', async () => {
  const h = harness({ initial: { user_profile: JSON.stringify({ ...profile, planId: 'retired_no_plan' }) } });
  await h.load();
  assert.equal(h.store().profile.planId, 'retired_no_plan');
  await h.store().switchTrainingGoal('street_mastery');
  assert.equal(h.store().profile.planId, require('../src/data/trainingPlans.ts').PRISONER_PLAN_ID);
});

test('retired equipment overrides are pruned without removing current courses or historical records', async () => {
  const selected = { ...profile, goal: 'equipment', equipmentSplit: 'ppl', frequency: 6,
    equipmentMovementOverrides: {
      equipment_ppl_6_0: { equipment_chest_03: 'equipment_chest_05' },
      equipment_v2_ppl_6_0: { equipment_chest_03: 'equipment_chest_05', equipment_arms_22: 'equipment_arms_12' },
    } };
  const h = harness({ initial: { user_profile: JSON.stringify(selected) } }); await h.load();
  assert.deepEqual(JSON.parse(h.disk.get('user_profile')).equipmentMovementOverrides,
    { equipment_v2_ppl_6_0: { equipment_chest_03: 'equipment_chest_05' } });
});

test('profile load and save prune removed routes without changing remaining levels', async () => {
  const removed = { front_lever: 5, planche: 5, back_lever: 4, muscle_up: 5, l_sit: 5, human_flag: 4 };
  const selected = { ...profile, levels: { push: 8, flag_press: 3, power_pull: 4, ...removed }, planLevels: { push: 6, ...removed } };
  const h = harness({ initial: { user_profile: JSON.stringify(selected) } });
  await h.load();
  const loaded = JSON.parse(h.disk.get('user_profile'));
  for (const key of Object.keys(removed)) {
    assert.equal(Object.hasOwn(loaded.levels, key), false);
    assert.equal(Object.hasOwn(loaded.planLevels, key), false);
  }
  assert.equal(loaded.levels.push, 8); assert.equal(loaded.planLevels.push, 6);
  assert.equal(loaded.levels.flag_press, 3); assert.equal(loaded.levels.power_pull, 4);
  await h.store().patchProfile(selected);
  const saved = JSON.parse(h.disk.get('user_profile'));
  assert.deepEqual(Object.keys(saved.levels).filter(key => key in removed), []);
  assert.equal(saved.levels.push, 8); assert.equal(saved.planLevels.push, 6);
});

test('removed daily action references are cleared while retained additions stay usable', async () => {
  const entries = { retained: { date, workoutId: 'prisonerA', exerciseIds: ['push_05', 'fl_01'] }, removed: { date, workoutId: 'custom_daily', exerciseIds: ['pl_01'] } };
  const h = harness({ initial: { user_profile: JSON.stringify(profile), daily_workout_edits: JSON.stringify(entries) } });
  await h.load();
  const stored = JSON.parse(h.disk.get('daily_workout_edits'));
  assert.deepEqual(stored.retained.exerciseIds, ['push_05']);
  assert.equal(Object.hasOwn(stored, 'removed'), false);
  const before = h.disk.get('daily_workout_edits');
  await assert.rejects(h.store().addDailyExercise(date, 'prisonerA', 'fl_01'), /动作已不在动作库/);
  assert.equal(h.disk.get('daily_workout_edits'), before);
});

test('assistant memory, history and food writes share one queue and survive reload/export', async () => {
  const h = harness(); const fact = { id: 'fact-test', kind: 'avoid', text: '香菜', createdAt: now };
  const conversation = { id: 'conversation-test', question: '记住我不吃香菜', answer: '确认后我会记住。', createdAt: now };
  await Promise.all([h.store().saveIntakeEntry(input('assistant-food')), h.store().saveAssistantFact(fact), h.store().appendAssistantConversation(conversation), h.store().setAssistantConsent(true)]);
  const saved = JSON.parse(h.disk.get('nutrition_journal_v1'));
  assert.equal(saved.entries.length, 1); assert.deepEqual(saved.assistant.facts, [fact]); assert.deepEqual(saved.assistant.conversations, []); assert.ok(saved.assistant.consentAt);
  await h.store().appendAssistantConversation(conversation); assert.equal(h.store().nutritionJournal.assistant.conversations.length, 1);
  const restored = harness({ initial: Object.fromEntries(h.disk) }); await restored.load();
  const backup = JSON.parse(await restored.store().exportData());
  assert.deepEqual(backup.data.nutrition_journal_v1.assistant, saved.assistant);
  assert.deepEqual(backup.data.assistant_archive_v2, [conversation]);
  await restored.store().clearAssistantHistory(); assert.equal(restored.store().nutritionJournal.assistant.conversations.length, 0);
  assert.equal(restored.store().nutritionJournal.entries.length, 1); assert.equal(restored.store().nutritionJournal.assistant.facts.length, 1);
  await restored.store().deleteAssistantFact(fact.id); await restored.store().setAssistantConsent(false);
  assert.equal(restored.store().nutritionJournal.assistant.facts.length, 0); assert.equal(restored.store().nutritionJournal.assistant.consentAt, null);
});
test('photo network consent saves immediately, survives reload, and can be revoked independently', async () => {
  const h = harness();
  assert.equal(h.store().nutritionJournal.photoConsentAt, null);
  await h.store().setPhotoConsent(true);
  const saved = JSON.parse(h.disk.get('nutrition_journal_v1'));
  assert.ok(saved.photoConsentAt);
  assert.equal(saved.assistant.consentAt, null);
  const restored = harness({ initial: Object.fromEntries(h.disk) }); await restored.load();
  assert.equal(restored.store().nutritionJournal.photoConsentAt, saved.photoConsentAt);
  await restored.store().setPhotoConsent(false);
  assert.equal(restored.store().nutritionJournal.photoConsentAt, null);
  assert.equal(JSON.parse(restored.disk.get('nutrition_journal_v1')).photoConsentAt, null);
  const legacy = { ...saved }; delete legacy.photoConsentAt;
  const migrated = harness({ initial: { nutrition_journal_v1: JSON.stringify(legacy) } }); await migrated.load();
  assert.equal(migrated.store().nutritionJournal.photoConsentAt, null);
});
test('failed photo consent write does not grant access in memory or on disk', async () => {
  let fail = true;
  const h = harness({ before: async ({ key }) => { if (fail && key === 'nutrition_journal_v1') throw new Error('disk full'); } });
  await assert.rejects(h.store().setPhotoConsent(true), /disk full/);
  assert.equal(h.store().nutritionJournal.photoConsentAt, null);
  assert.equal(h.disk.has('nutrition_journal_v1'), false);
  fail = false; await h.store().setPhotoConsent(true);
  assert.ok(h.store().nutritionJournal.photoConsentAt);
});
test('failed assistant writes roll back; confirmed allergy unions rather than weakening existing exclusions', async () => {
  let fail = false; const h = harness({ before: async ({ key }) => { if (fail && key === 'nutrition_journal_v1') throw new Error('disk full'); } });
  await h.store().saveProfile(profile); await h.store().saveNutritionPreferences({ ...defaultNutritionPreferences(profile), allergens: ['milk'], screeningCompletedAt: now });
  const fact = { id: 'allergy-test', kind: 'allergy', text: '花生', createdAt: now };
  fail = true; await assert.rejects(h.store().saveAssistantFact(fact), /disk full/);
  assert.equal(h.store().nutritionJournal.assistant.facts.length, 0); assert.deepEqual(Array.from(h.store().nutritionJournal.preferences.allergens), ['milk']);
  fail = false; await h.store().saveAssistantFact(fact);
  assert.deepEqual(Array.from(h.store().nutritionJournal.preferences.allergens), ['milk', 'peanut']);
  await h.store().deleteAssistantFact(fact.id);
  assert.deepEqual(Array.from(h.store().nutritionJournal.preferences.allergens), ['milk']);
});
test('confirmed assistant operations persist their outcome with the same successful commit', async () => {
  const h = harness(); const turn = { id: 'assistant-operation', question: '早餐吃了鸡蛋，请记录', answer: '请确认记餐草案。', createdAt: now };
  await h.store().appendAssistantConversation(turn);
  await h.store().saveIntakeEntry(input('intake-' + turn.id));
  assert.equal(h.store().nutritionJournal.assistant.conversations[0].answer, '已记录这一餐，可在今日饮食中查看。');
  await h.store().appendAssistantConversation({ ...turn, id: 'assistant-memory' });
  await h.store().saveAssistantFact({ id: 'fact-assistant-memory', kind: 'avoid', text: '香菜', createdAt: now });
  assert.equal(h.store().nutritionJournal.assistant.conversations[1].answer, '已记住，可在“记忆”中查看或删除。');
});

test('queued meal saves and deletes preserve all later records and export the persisted snapshot', async () => {
  const h = harness();
  const store = h.store();
  await Promise.all([store.saveIntakeEntry(input('a')), store.saveIntakeEntry(input('b')), store.saveIntakeEntry(input('c')), store.deleteIntakeEntry('b')]);
  const persisted = JSON.parse(h.disk.get('nutrition_journal_v1'));
  assert.deepEqual(persisted.entries.map(entry => entry.id), ['c', 'a']);
  const backup = JSON.parse(await h.store().exportData());
  assert.deepEqual(backup.data.nutrition_journal_v1, persisted);
});

test('personal image cleanup runs after persisted removal, never before a failed write or while historical snapshots use it', async () => {
  let failWrite = false; const deleted = [];
  const h = harness({ before: async ({ key }) => { if (failWrite && key === 'nutrition_journal_v1') throw new Error('photo commit failed'); },
    deletePhotos: async ids => { const disk = JSON.parse(h.disk.get('nutrition_journal_v1'));
      assert.ok(!disk.customFoods.some(food => ids.includes(food.photo?.id)));
      deleted.push(...ids); } });
  const photo = { id: 'nutrition-photo-1234567890', kind: 'food', capturedAt: now };
  const food = { ...createCustomFoodFromLabel({ id: 'custom-photo-store', name: '测试包装', basisGrams: 100, energyUnit: 'kcal',
    calories: 200, protein: 10, carbs: 20, fat: 8, allergens: [] }), photo, artworkCategory: 'mixed' };
  await h.store().saveCustomFood(food);
  failWrite = true; await assert.rejects(h.store().deleteCustomFood(food.id), /photo commit failed/);
  assert.deepEqual(deleted, []); assert.equal(h.store().nutritionJournal.customFoods[0].photo.id, photo.id);
  failWrite = false;
  await h.store().saveIntakeEntry({ ...input('photo-history'), portions: [{ foodId: food.id, grams: 30 }] });
  await h.store().deleteCustomFood(food.id);
  assert.deepEqual(deleted, []);
  const restored = harness({ initial: Object.fromEntries(h.disk), deletePhotos: async ids => deleted.push(...ids) });
  await restored.load();
  assert.equal(restored.store().nutritionJournal.entries[0].customFoods[0].photo.id, photo.id);
  await restored.store().deleteIntakeEntry('photo-history');
  assert.deepEqual(deleted, [photo.id]);
});

test('custom food, favorite and selected recipe persist through provider queues and restart', async () => {
  const h = harness();
  const food = createCustomFoodFromLabel({ id: 'custom-store-test', name: '包装测试', basisGrams: 100, energyUnit: 'kcal', calories: 100, protein: 10, carbs: 12, fat: 1, allergens: [] });
  await h.store().saveCustomFood(food);
  await h.store().saveIntakeEntry({ ...input('custom-entry'), portions: [{ foodId: food.id, grams: 150 }] });
  const original = h.store().nutritionJournal.entries[0];
  await h.store().setPlannedMealRevision(date, 'dinner', 3);
  const legacy = { ...h.store().nutritionJournal, savedMeals: [original] };
  h.disk.set('nutrition_journal_v1', JSON.stringify(legacy));
  const resumed = harness({ initial: Object.fromEntries(h.disk) }); await resumed.load();
  await resumed.store().deleteCustomFood(food.id);
  await resumed.store().deleteIntakeEntry(original.id);
  const restored = harness({ initial: Object.fromEntries(resumed.disk) });
  await restored.load();
  const journal = restored.store().nutritionJournal;
  assert.equal(journal.customFoods.length, 0);
  assert.equal(journal.entries.length, 0);
  assert.equal(journal.mealRevisions[date + ':dinner'], 3);
  assert.equal(journal.savedMeals[0].nutrients.calories, 150);
  assert.equal(journal.savedMeals[0].customFoods[0].name, food.name);
});

test('failed nutrition persistence leaves state untouched and does not poison the next queued save', async () => {
  let fail = true;
  const h = harness({ before: async ({ key }) => { if (key === 'nutrition_journal_v1' && fail) { fail = false; throw new Error('disk full'); } } });
  const store = h.store();
  const failed = store.saveIntakeEntry(input('failed'));
  const succeeding = store.saveIntakeEntry(input('saved'));
  await assert.rejects(failed, /disk full/);
  await succeeding;
  assert.deepEqual(h.store().nutritionJournal.entries.map(entry => entry.id), ['saved']);
  assert.deepEqual(JSON.parse(h.disk.get('nutrition_journal_v1')).entries.map(entry => entry.id), ['saved']);
});

test('clear drains profile, settings, training and nutrition queues and blocks late writes', async () => {
  const gate = deferred();
  const h = harness({ before: async ({ kind }) => { if (kind !== 'remove') await gate.promise; } });
  const store = h.store();
  const writes = [store.saveProfile(profile), store.updateSettings({ vibration: false }), store.saveIntakeEntry(input('before-clear')), store.addDailyExercise(date, 'fullA', 'push_01')];
  let cleared = false;
  const clearing = store.clearData().then(() => { cleared = true; });
  const lateWrites = [
    store.saveProfile(profile), store.updateSettings({ restSeconds: 90 }),
    store.saveIntakeEntry(input('late')), store.deleteIntakeEntry('before-clear'),
    store.addDailyExercise(date, 'fullA', 'push_02'), store.setPlannedMealRevision(date, 'lunch', 1),
  ];
  await Promise.all(lateWrites.map(promise => assert.rejects(promise, /正在清除数据/)));
  await turn();
  assert.equal(cleared, false, 'clear must wait for previously accepted writes');
  gate.resolve();
  await Promise.all([...writes, clearing]);
  assert.equal([...h.disk.keys()].filter(k => k !== '__test_archive').length, 0, 'accepted writes must not resurrect storage after clear');
  assert.equal(h.store().profile, null);
  assert.equal(h.store().nutritionJournal.entries.length, 0);
  await h.store().saveIntakeEntry(input('fresh'));
  assert.deepEqual(h.store().nutritionJournal.entries.map(entry => entry.id), ['fresh']);
});

test('a failed clear preserves journal state and releases the write guard', async () => {
  let fail = true;
  const h = harness({ before: async ({ kind }) => { if (kind === 'remove' && fail) { fail = false; throw new Error('remove failed'); } } });
  await h.store().saveIntakeEntry(input('old'));
  await assert.rejects(h.store().clearData(), /remove failed/);
  assert.equal(h.store().nutritionJournal.entries.length, 1);
  assert.equal(JSON.parse(h.disk.get('nutrition_journal_v1')).entries.length, 1);
  await h.store().saveIntakeEntry(input('new'));
  assert.deepEqual(h.store().nutritionJournal.entries.map(entry => entry.id), ['new', 'old']);
});

test('initial loading preserves historical nutrition snapshots and invalid body data stays unconfirmed', async () => {
  const entry = createIntakeEntry({ ...input('history'), now });
  entry.foodDataVersion = 'older-food-version';
  entry.portions[0].foodId = 'retired-food';
  entry.nutrients = { calories: 120, protein: 8, carbs: 14, fat: 4, fiber: 1 };
  const preferences = { ...defaultNutritionPreferences(profile), screeningCompletedAt: now };
  const journal = { ...emptyNutritionJournal(), preferences, entries: [entry] };
  const h = harness({ initial: { user_profile: JSON.stringify({ ...profile, age: null, height: 0, weight: 0, sex: 'unknown' }), nutrition_journal_v1: JSON.stringify(journal) } });
  await h.load();
  const store = h.store();
  assert.equal(calculateTargets(store.profile, store.nutritionJournal.preferences).status, 'needs_setup');
  assert.deepEqual(JSON.parse(JSON.stringify(store.nutritionJournal.entries)), [entry]);
  assert.deepEqual(JSON.parse(await store.exportData()).data.nutrition_journal_v1.entries, [entry]);
});

test('malformed nutrition JSON cannot prevent other data from loading or overwrite its recovery copy', async () => {
  const bad = '{broken-json';
  const h = harness({ initial: { user_profile: JSON.stringify(profile), nutrition_journal_v1: bad } });
  await h.load();
  assert.equal(h.store().profile.name, profile.name);
  assert.equal(h.store().nutritionJournal.entries.length, 0);
  assert.equal(h.disk.get('nutrition_journal_v1'), bad);
  assert.ok(h.warnings.length > 0);
  assert.ok(h.store().nutritionStorageIssue);
  await assert.rejects(h.store().captureNutritionTarget(), /暂停保存/);
  await assert.rejects(h.store().saveIntakeEntry(input('would-overwrite')), /暂停保存/);
  assert.equal(h.disk.get('nutrition_journal_v1'), bad);
  assert.equal(JSON.parse(await h.store().exportData()).recovery.nutritionRaw, bad);
});

test('target snapshots, completeness and training time persist without rewriting actual food', async () => {
  const h = harness();
  const today = localWeightDate(new Date());
  await h.store().saveProfile(profile);
  await h.store().saveNutritionPreferences({ ...defaultNutritionPreferences(profile), screeningCompletedAt: new Date().toISOString() });
  await h.store().captureNutritionTarget();
  await h.store().captureNutritionTarget();
  assert.equal(h.store().nutritionJournal.days[today].targetHistory.length, 1);
  await h.store().patchProfile({ weight: 80 });
  await h.store().captureNutritionTarget();
  assert.equal(h.store().nutritionJournal.days[today].targetHistory.length, 2);
  await h.store().confirmNutritionLogging(today, 'day', true);
  assert.ok(h.store().nutritionJournal.days[today].completedAt);
  await h.store().saveIntakeEntry({ ...input('added'), date: today });
  assert.equal(h.store().nutritionJournal.days[today].completedAt, null);
  const restored = harness({ initial: Object.fromEntries(h.disk) });
  await restored.load();
  assert.deepEqual(JSON.parse(JSON.stringify(restored.store().nutritionJournal)), JSON.parse(JSON.stringify(h.store().nutritionJournal)));
  assert.equal(JSON.parse(await h.store().exportData()).formatVersion, '2.3-mobile');
});

test('queued action uses the latest accepted profile and failed writes leave drafts unapplied', async () => {
  let failWrite = false;
  const h = harness({ before: async ({ key }) => { if (failWrite && key === 'nutrition_journal_v1') { failWrite = false; throw new Error('disk full'); } } });
  await h.store().saveProfile(profile);
  await h.store().saveNutritionPreferences({ ...defaultNutritionPreferences(profile), screeningCompletedAt: new Date().toISOString() });
  const today = localWeightDate(new Date());
  const current = h.store();
  const training = getNutritionTrainingContext(current.profile, current.sessions, current.dailyEdits, today);
  const result = prepareMealAdjustment(current.profile, current.nutritionJournal, training, today, { type: 'swap_meal', slot: 'dinner', focus: 'balanced' });
  assert.equal(result.status, 'ready');
  failWrite = true;
  await assert.rejects(h.store().applyNutritionMealDraft(result.draft), /disk full/);
  assert.deepEqual(h.store().nutritionJournal.mealOverrides, {});
  await h.store().applyNutritionMealDraft(result.draft);
  assert.ok(h.store().nutritionJournal.mealOverrides[today + ':dinner']);
  assert.equal(h.store().nutritionJournal.entries.length, 0);
  await h.store().resetNutritionMeal(today, 'dinner');
  const refreshed = h.store();
  const next = prepareMealAdjustment(refreshed.profile, refreshed.nutritionJournal, training, today, { type: 'swap_meal', slot: 'dinner', focus: 'balanced' });
  assert.equal(next.status, 'ready');
  const savingProfile = h.store().patchProfile({ weight: 85 });
  const applyingOld = h.store().applyNutritionMealDraft(next.draft);
  await savingProfile;
  await assert.rejects(applyingOld, /变化/);
  assert.deepEqual(h.store().nutritionJournal.mealOverrides, {});
});
const runSession = id => ({ id, kind: 'running', workoutId: 'run', startedAt: now, completedAt: now, trainingDate: date, durationSeconds: 600, exercises: [], totalReps: 0 });

test('profile migration failure cannot hide or overwrite training history, edits or settings', async () => {
  let fail = true;
  const h = harness({ initial: { user_profile: JSON.stringify(profile), sessions: JSON.stringify([runSession('old')]),
    settings: JSON.stringify({ vibration: false, restSeconds: 180 }), daily_workout_edits: JSON.stringify({ keep: { date, workoutId: 'fullA', exerciseIds: ['push_01'] } }) },
    before: async ({ key }) => { if (fail && key === 'user_profile') throw Error('migration failed'); } });
  await h.load();
  assert.equal(h.store().profile.name, profile.name);
  assert.equal(h.store().sessions[0].id, 'old');
  assert.equal(h.store().settings.vibration, false);
  assert.equal(h.store().dailyEdits.keep.exerciseIds[0], 'push_01');
  assert.ok(h.store().storageIssues.user_profile);
  await assert.rejects(h.store().patchProfile({ name: 'would overwrite' }), /暂停/);
  await h.store().saveSession(runSession('new'));
  assert.deepEqual(JSON.parse(h.disk.get('sessions')).map(s => s.id), ['new', 'old']);
  assert.equal(JSON.parse(await h.store().exportData()).recovery.raw.user_profile, JSON.stringify(profile));
  fail = false; await h.store().retryStorageLoading();
  assert.deepEqual(Object.keys(h.store().storageIssues), []);
  await h.store().patchProfile({ name: 'recovered' });
  assert.equal(h.store().profile.name, 'recovered');
});

test('malformed domain blocks only its own writes and remains exportable until recovery', async () => {
  const bad = '{bad';
  for (const key of ['sessions', 'daily_workout_edits', 'settings', 'user_profile']) {
    const h = harness({ initial: { user_profile: JSON.stringify(profile), [key]: bad } }); await h.load();
    assert.ok(h.store().storageIssues[key], key);
    assert.equal(JSON.parse(await h.store().exportData()).recovery.raw[key], bad);
    if (key === 'sessions') await assert.rejects(h.store().saveSession(runSession('new')), /暂停/);
    if (key === 'daily_workout_edits') {
      await assert.rejects(h.store().addDailyExercise(date, 'fullA', 'push_01'), /暂停/);
      await h.store().saveSession(runSession('allowed'));
    }
    if (key === 'settings') await assert.rejects(h.store().updateSettings({ vibration: false }), /暂停/);
    if (key === 'user_profile') await assert.rejects(h.store().saveProfile(profile), /暂停/);
    assert.equal(h.disk.get(key), bad);
    await h.store().saveIntakeEntry(input('independent'));
    assert.equal(h.store().nutritionJournal.entries.length, 1);
  }
});

test('read failures are isolated and retry closes the write window while draining accepted work', async () => {
  let readFail = true, writeGate = false;
  const gate = deferred();
  const h = harness({ initial: { user_profile: JSON.stringify(profile) },
    readBefore: async key => { if (readFail && key === 'sessions') throw Error('read failed'); },
    before: async ({ key }) => { if (writeGate && key === 'user_profile') await gate.promise; } });
  await h.load(); assert.ok(h.store().storageIssues.sessions);
  writeGate = true;
  const accepted = h.store().patchProfile({ weight: 80 });
  const retry = h.store().retryStorageLoading();
  await assert.rejects(h.store().patchProfile({ name: 'late' }), /重新加载/);
  await assert.rejects(h.store().clearData(), /正在处理/);
  readFail = false; gate.resolve();
  await Promise.all([accepted, retry]);
  assert.equal(h.store().profile.weight, 80);
  assert.deepEqual(Object.keys(h.store().storageIssues), []);
});

test('queued field patches and functional merges cannot restore stale profile snapshots', async () => {
  const h = harness({ initial: { user_profile: JSON.stringify(profile) } }); await h.load();
  const old = h.store().profile;
  await Promise.all([h.store().patchProfile({ weight: 80 }), h.store().patchProfile({ name: 'new name' }),
    h.store().patchProfile(current => ({ levels: { ...current.levels, push: 7 } })),
    h.store().patchProfile(current => ({ levels: { ...current.levels, pull: 6 } }))]);
  assert.equal(h.store().profile.weight, 80); assert.equal(h.store().profile.name, 'new name');
  assert.equal(h.store().profile.levels.push, 7); assert.equal(h.store().profile.levels.pull, 6);
  await assert.rejects(h.store().saveProfile(old), /档案已存在/);
  await assert.rejects(h.store().patchProfile({ goal: 'equipment' }), /专题切换/);
});

test('training topic round trip never rewrites an independent legacy nutrition goal', async () => {
  const h = harness({ initial: { user_profile: JSON.stringify({ ...profile, goal: 'equipment', nutritionGoal: 'muscle_gain' }) } }); await h.load();
  await h.store().switchTrainingGoal('street_mastery'); await h.store().switchTrainingGoal('equipment');
  assert.equal(h.store().profile.nutritionGoal, 'muscle_gain');
});

test('allergy sources are order independent, survive restart and preserve manual exclusions', async () => {
  const allergy = { id: 'milk-memory', kind: 'allergy', text: '牛奶', createdAt: now };
  for (const memoryFirst of [true, false]) {
    const h = harness(); await h.store().saveProfile(profile);
    const preferences = { ...defaultNutritionPreferences(profile), allergens: ['peanut'], screeningCompletedAt: now };
    if (memoryFirst) await h.store().saveAssistantFact(allergy);
    await h.store().saveNutritionPreferences(preferences);
    if (!memoryFirst) await h.store().saveAssistantFact(allergy);
    assert.deepEqual(Array.from(h.store().nutritionJournal.preferences.allergens).sort(), ['milk', 'peanut']);
    const restart = harness({ initial: Object.fromEntries(h.disk) }); await restart.load();
    await restart.store().deleteAssistantFact(allergy.id);
    assert.deepEqual(Array.from(restart.store().nutritionJournal.preferences.allergens), ['peanut']);
    await restart.store().saveAssistantFact(allergy);
    await restart.store().saveNutritionPreferences({ ...preferences, allergens: ['milk', 'peanut'] });
    await restart.store().deleteAssistantFact(allergy.id);
    assert.deepEqual(Array.from(restart.store().nutritionJournal.preferences.allergens), ['milk', 'peanut']);
  }
});

test('legacy exclusions are retained conservatively and negated old memories do not add exclusions', async () => {
  const journal = { ...emptyNutritionJournal(), preferences: { ...defaultNutritionPreferences(profile), allergens: ['peanut'], screeningCompletedAt: now } };
  delete journal.manualAllergens;
  journal.assistant.facts = [{ id: 'bad-negative', kind: 'allergy', text: '牛奶不', createdAt: now }];
  const h = harness({ initial: { nutrition_journal_v1: JSON.stringify(journal) } }); await h.load();
  assert.deepEqual(Array.from(h.store().nutritionJournal.preferences.allergens), ['peanut']);
  await h.store().deleteAssistantFact('bad-negative');
  assert.deepEqual(Array.from(h.store().nutritionJournal.preferences.allergens), ['peanut']);
});

test('assistant preference tool obeys actual permissions and persists one atomic receipt', async () => {
  const h = harness({ initial: { user_profile: JSON.stringify(profile) } }); await h.load();
  const basis = () => { const s = h.store(); return assistantDataBasis(s.nutritionJournal, s.profile, s.sessions, s.dailyEdits); };
  const operation = { id: 'set_preferences-one', kind: 'set_preferences', patch: { objective: 'muscle_gain', allergens: ['peanut'] }, confirmed: false, policyVersion: 0, basis: basis() };
  await assert.rejects(h.store().executeAssistantOperation(operation), /确认/);
  assert.equal(h.store().nutritionJournal.preferences, null);
  await h.store().executeAssistantOperation({ ...operation, confirmed: true });
  assert.equal(h.store().nutritionJournal.preferences.objective, 'muscle_gain');
  assert.equal(h.store().nutritionJournal.preferences.screeningCompletedAt, null);
  await h.store().setAssistantAuthorization('full_access');
  const next = { ...operation, id: 'set_preferences-two', patch: { pattern: 'vegetarian' }, policyVersion: 1, basis: basis() };
  await Promise.all([h.store().executeAssistantOperation(next), h.store().executeAssistantOperation(next)]);
  const restart = harness({ initial: Object.fromEntries(h.disk) }); await restart.load();
  assert.equal(restart.store().nutritionJournal.preferences.pattern, 'vegetarian');
  assert.deepEqual(Array.from(restart.store().nutritionJournal.preferences.allergens), ['peanut']);
  assert.equal(Object.keys(restart.store().nutritionJournal.assistant.receipts).length, 2);
  await assert.rejects(restart.store().executeAssistantOperation({ ...next, patch: { pattern: 'balanced' } }), /重放/);
});
