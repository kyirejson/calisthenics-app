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

// Exercise the real provider callbacks with reusable hook state and isolated in-memory
// AsyncStorage. No browser, native runtime, user storage or extra test dependency is used.
function harness({ initial = {}, before = async () => {}, deletePhotos } = {}) {
  const disk = new Map(Object.entries(initial));
  const storage = {
    getItem: async key => disk.get(key) ?? null,
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

test('assistant memory, history and food writes share one queue and survive reload/export', async () => {
  const h = harness(); const fact = { id: 'fact-test', kind: 'avoid', text: '香菜', createdAt: now };
  const conversation = { id: 'conversation-test', question: '记住我不吃香菜', answer: '确认后我会记住。', createdAt: now };
  await Promise.all([h.store().saveIntakeEntry(input('assistant-food')), h.store().saveAssistantFact(fact), h.store().appendAssistantConversation(conversation), h.store().setAssistantConsent(true)]);
  const saved = JSON.parse(h.disk.get('nutrition_journal_v1'));
  assert.equal(saved.entries.length, 1); assert.deepEqual(saved.assistant.facts, [fact]); assert.deepEqual(saved.assistant.conversations, [conversation]); assert.ok(saved.assistant.consentAt);
  await h.store().appendAssistantConversation(conversation); assert.equal(h.store().nutritionJournal.assistant.conversations.length, 1);
  const restored = harness({ initial: Object.fromEntries(h.disk) }); await restored.load();
  assert.deepEqual(JSON.parse(restored.store().exportData()).data.nutrition_journal_v1.assistant, saved.assistant);
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
  assert.deepEqual(Array.from(h.store().nutritionJournal.preferences.allergens), ['milk', 'peanut']);
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
  const backup = JSON.parse(h.store().exportData());
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
  await Promise.all([h.store().saveFavoriteMeal(original), h.store().setPlannedMealRevision(date, 'dinner', 3)]);
  await h.store().deleteCustomFood(food.id);
  await h.store().deleteIntakeEntry(original.id);
  const restored = harness({ initial: Object.fromEntries(h.disk) });
  await restored.load();
  const journal = restored.store().nutritionJournal;
  assert.equal(journal.customFoods.length, 0);
  assert.equal(journal.entries.length, 0);
  assert.equal(journal.mealRevisions[date + ':dinner'], 3);
  assert.equal(journal.savedMeals[0].nutrients.calories, 150);
  assert.equal(journal.savedMeals[0].customFoods[0].name, food.name);
  await restored.store().deleteFavoriteMeal(original.id);
  assert.equal(restored.store().nutritionJournal.savedMeals.length, 0);
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
  assert.equal(h.disk.size, 0, 'accepted writes must not resurrect storage after clear');
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
  assert.deepEqual(JSON.parse(store.exportData()).data.nutrition_journal_v1.entries, [entry]);
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
  assert.equal(JSON.parse(h.store().exportData()).recovery.nutritionRaw, bad);
});

test('target snapshots, completeness and training time persist without rewriting actual food', async () => {
  const h = harness();
  const today = localWeightDate(new Date());
  await h.store().saveProfile(profile);
  await h.store().saveNutritionPreferences({ ...defaultNutritionPreferences(profile), screeningCompletedAt: new Date().toISOString() });
  await h.store().captureNutritionTarget();
  await h.store().captureNutritionTarget();
  assert.equal(h.store().nutritionJournal.days[today].targetHistory.length, 1);
  await h.store().setNutritionTrainingTime('evening');
  await h.store().captureNutritionTarget();
  assert.equal(h.store().nutritionJournal.days[today].targetHistory.length, 2);
  await h.store().confirmNutritionLogging(today, 'day', true);
  assert.ok(h.store().nutritionJournal.days[today].completedAt);
  await h.store().saveIntakeEntry({ ...input('added'), date: today });
  assert.equal(h.store().nutritionJournal.days[today].completedAt, null);
  const restored = harness({ initial: Object.fromEntries(h.disk) });
  await restored.load();
  assert.deepEqual(JSON.parse(JSON.stringify(restored.store().nutritionJournal)), JSON.parse(JSON.stringify(h.store().nutritionJournal)));
  assert.equal(JSON.parse(h.store().exportData()).formatVersion, '2.3-mobile');
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
  const savingProfile = h.store().saveProfile({ ...refreshed.profile, weight: 85 });
  const applyingOld = h.store().applyNutritionMealDraft(next.draft);
  await savingProfile;
  await assert.rejects(applyingOld, /变化/);
  assert.deepEqual(h.store().nutritionJournal.mealOverrides, {});
});
