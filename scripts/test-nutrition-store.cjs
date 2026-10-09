const assert = require('node:assert/strict');
const { test } = require('node:test');
const ts = require('typescript');

require('./lib/register-typescript.cjs')({ compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, extensions: ['.ts'] });
const { FOODS, getFood } = require('./fixtures/user-food.cjs');
const { FOOD_DATA_VERSION } = require('../src/nutrition/foodData.ts');
const { emptyNutritionJournal, createIntakeEntry, createCustomFoodFromLabel, defaultNutritionPreferences, calculateTargets } = require('../src/nutrition/engine.ts');
const { localWeightDate } = require('../src/domain/weight/weightTrend.ts');
const { getNutritionTrainingContext } = require('../src/nutrition/training.ts');
const { repositoryHarness: harness } = require('./lib/app-repository-harness.cjs');
const date = '2026-09-27';
const now = '2026-09-27T08:00:00.000Z';
const profile = { name: '隔离测试', age: 30, height: 175, weight: 75, sex: 'male', goal: 'street_mastery', nutritionGoal: 'maintain', dietPattern: 'balanced_cn', frequency: 3, levels: {}, experience: 'beginner', planStartedAt: now };
const input = id => ({ id, date, slot: 'lunch', name: '称重食物', source: 'manual', customFoods: FOODS, portions: [{ foodId: FOODS[0].id, grams: 100 }] });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const turn = () => new Promise(resolve => setImmediate(resolve));

test('failed optional meal state persistence leaves UI state untouched and the next write remains usable', async () => {
  let fail = true;
  const h = harness({ before: async event => { if (fail && event.key === 'nutrition_journal_v1') throw Error('QA meal state disk full'); } }); await h.load();
  const today = localWeightDate(new Date());
  await assert.rejects(h.store().setNutritionMealStatus(today, 'breakfast', 'not_eaten'), /disk full/);
  assert.equal(h.store().nutritionJournal.days[today], undefined);
  fail = false; await h.store().setNutritionMealStatus(today, 'breakfast', 'not_eaten');
  assert.deepEqual(h.store().nutritionJournal.days[today].skippedSlots, ['breakfast']);
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
  assert.equal(h.store().profile.planId, require('../src/domain/training/trainingPlans.ts').PRISONER_PLAN_ID);
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

test('failed photo consent write does not grant access in memory or on disk', async () => {
  let fail = true;
  const h = harness({ before: async ({ key }) => { if (fail && key === 'nutrition_journal_v1') throw new Error('disk full'); } }); await h.load();
  await assert.rejects(h.store().setPhotoConsent(true), /disk full/);
  assert.equal(h.store().nutritionJournal.photoConsentAt, null);
  assert.equal(h.disk.has('nutrition_journal_v1'), false);
  fail = false; await h.store().setPhotoConsent(true);
  assert.ok(h.store().nutritionJournal.photoConsentAt);
});
test('queued meal saves and deletes preserve all later records and export the persisted snapshot', async () => {
  const h = harness(); await h.load();
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
      deleted.push(...ids); } }); await h.load();
  const photo = { id: 'nutrition-photo-1234567890', kind: 'food', capturedAt: now };
  const food = { ...createCustomFoodFromLabel({ id: 'custom-photo-store', name: '测试包装', basisGrams: 100, energyUnit: 'kcal',
    calories: 200, protein: 10, carbs: 20, fat: 8, allergens: [] }), photo, artworkCategory: 'mixed' };
  await h.store().saveCustomFood(food);
  failWrite = true; await assert.rejects(h.store().deleteCustomFood(food.id), /photo commit failed/);
  assert.deepEqual(deleted, []); assert.equal(h.store().nutritionJournal.customFoods[0].photo.id, photo.id);
  failWrite = false;
  await h.store().saveIntakeEntry({ ...input('photo-history'), customFoods: FOODS, portions: [{ foodId: food.id, grams: 30 }] });
  await h.store().deleteCustomFood(food.id);
  assert.deepEqual(deleted, []);
  const restored = harness({ initial: Object.fromEntries(h.disk), deletePhotos: async ids => deleted.push(...ids) });
  await restored.load();
  assert.equal(restored.store().nutritionJournal.entries[0].customFoods[0].photo.id, photo.id);
  await restored.store().deleteIntakeEntry('photo-history');
  assert.deepEqual(deleted, [photo.id]);
});

test('failed nutrition persistence leaves state untouched and does not poison the next queued save', async () => {
  let fail = true;
  const h = harness({ before: async ({ key }) => { if (key === 'nutrition_journal_v1' && fail) { fail = false; throw new Error('disk full'); } } }); await h.load();
  const store = h.store();
  const failed = store.saveIntakeEntry(input('failed'));
  const succeeding = store.saveIntakeEntry(input('saved'));
  await assert.rejects(failed, /disk full/);
  await succeeding;
  assert.deepEqual(h.store().nutritionJournal.entries.map(entry => entry.id), ['saved']);
  assert.deepEqual(JSON.parse(h.disk.get('nutrition_journal_v1')).entries.map(entry => entry.id), ['saved']);
});

test('a failed clear preserves journal state and releases the write guard', async () => {
  let fail = true;
  const h = harness({ before: async ({ kind }) => { if (kind === 'remove' && fail) { fail = false; throw new Error('remove failed'); } } }); await h.load();
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
  delete entry.customFoods;
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
  assert.ok(h.store().storageIssues.nutrition_journal_v1);
  assert.ok(h.store().nutritionStorageIssue);
  await assert.rejects(h.store().captureNutritionTarget(), /暂停保存/);
  await assert.rejects(h.store().saveIntakeEntry(input('would-overwrite')), /暂停保存/);
  assert.equal(h.disk.get('nutrition_journal_v1'), bad);
  assert.equal(JSON.parse(await h.store().exportData()).recovery.nutritionRaw, bad);
});

test('target snapshots, completeness and training time persist without rewriting actual food', async () => {
  const h = harness(); await h.load();
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
