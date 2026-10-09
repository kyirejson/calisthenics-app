const { test } = require('node:test');
const assert = require('node:assert/strict');
const { repositoryHarness } = require('./lib/app-repository-harness.cjs');
const { createObservable } = require('../src/store/observable.ts');
const profile = {
  name: '架构隔离',
  age: 30,
  height: 175,
  weight: 75,
  sex: 'male',
  goal: 'street_mastery',
  frequency: 3,
  levels: {},
  experience: 'beginner',
  planStartedAt: '2026-09-28T01:00:00Z',
};
const initial = { user_profile: JSON.stringify(profile) };
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const turn = () => new Promise((resolve) => setImmediate(resolve));
const session = (id) => ({
  id,
  kind: 'strength',
  workoutId: 'qa',
  workoutName: '隔离',
  trainingDate: '2026-10-09',
  startedAt: '2026-10-09T00:00:00Z',
  completedAt: '2026-10-09T00:01:00Z',
  durationSeconds: 60,
  completion: 'complete',
  exercises: [
    {
      exerciseId: 'squat_05',
      name: '标准深蹲',
      category: 'squat',
      sets: [{ reps: 10, unit: 'reps', completed: true }],
    },
  ],
});

test('selection subscriptions isolate domains, action identities stay stable and unsubscribe releases notifications', async () => {
  const h = repositoryHarness({ initial });
  await h.load();
  const counts = { training: 0, nutrition: 0, profile: 0, actions: 0 },
    original = h.store();
  const selectors = {
    training: (value) => ({ sessions: value.sessions, dailyEdits: value.dailyEdits }),
    nutrition: (value) => value.nutritionJournal,
    profile: (value) => value.profile,
    actions: (value) => ({ saveSession: value.saveSession, patchProfile: value.patchProfile }),
  };
  const unsubscribe = Object.keys(counts).map((key) =>
    h.repository.subscribeSelection(selectors[key], () => counts[key]++),
  );
  await h.store().setNutritionMealStatus('2026-10-09', 'breakfast', 'not_eaten');
  assert.deepEqual(counts, { training: 0, nutrition: 1, profile: 0, actions: 0 });
  await h.store().saveSession(session('one'));
  assert.deepEqual(counts, { training: 1, nutrition: 1, profile: 0, actions: 0 });
  await h.store().patchProfile({ weight: 76 });
  assert.deepEqual(counts, { training: 1, nutrition: 1, profile: 1, actions: 0 });
  assert.equal(original.saveSession, h.store().saveSession);
  assert.equal(original.patchProfile, h.store().patchProfile);
  unsubscribe.forEach((stop) => stop());
  await h.store().saveSession(session('two'));
  assert.deepEqual(counts, { training: 1, nutrition: 1, profile: 1, actions: 0 });
  assert.equal(original.profile.weight, 75, 'old snapshots stay immutable');
  assert.equal(original.sessions.length, 0);
  assert.equal(h.store(), h.store(), 'getSnapshot is referentially stable');
});

test('no-op patches do not notify and selection changes compare own keys, not inherited values', () => {
  const observable = createObservable({ a: 1, b: 2 });
  let total = 0,
    selected = 0;
  observable.subscribe(() => total++);
  observable.subscribeSelection(
    (state) => ({ a: state.a }),
    () => selected++,
  );
  observable.patch({ a: 1 });
  assert.equal(total, 0);
  observable.patch({ b: 3 });
  assert.equal(total, 1);
  assert.equal(selected, 0);
  observable.patch({ a: 2 });
  assert.equal(selected, 1);
  const { shallowEqual } = require('../src/store/observable.ts');
  assert.equal(shallowEqual({ a: undefined }, { b: undefined }), false);
});

test('startup deduplicates concurrent loads and blocks writes until persisted domains are ready', async () => {
  const gate = deferred();
  let reads = 0,
    retired = 0;
  const h = repositoryHarness({
    initial,
    readBefore: async () => {
      reads++;
      await gate.promise;
    },
    effects: { clearRetired: async () => retired++ },
  });
  await assert.rejects(h.store().patchProfile({ weight: 80 }), /正在加载/);
  const first = h.load(),
    second = h.load();
  await turn();
  await assert.rejects(h.store().saveSession(session('not-ready')), /正在加载/);
  gate.resolve();
  await Promise.all([first, second]);
  const loadedReads = reads;
  await h.load();
  assert.equal(reads, loadedReads);
  assert.equal(retired, 1);
  assert.equal(h.store().ready, true);
  assert.equal(h.store().sessions.length, 0);
});

test('a slow training write does not block unrelated nutrition writes, and export drains accepted work', async () => {
  const gate = deferred(),
    h = repositoryHarness({
      initial,
      before: async (op) => {
        if (op.kind === 'multiSet') await gate.promise;
      },
    });
  await h.load();
  const save = h.store().saveSession(session('accepted'));
  await turn();
  await h.store().setNutritionMealStatus('2026-10-09', 'breakfast', 'not_eaten');
  assert.equal(h.store().sessions.length, 0);
  assert.ok(h.store().nutritionJournal.days['2026-10-09']);
  let exported = false;
  const exporting = h
    .store()
    .exportData()
    .then((value) => {
      exported = true;
      return JSON.parse(value);
    });
  await turn();
  assert.equal(exported, false);
  gate.resolve();
  await save;
  const result = await exporting;
  assert.equal(result.data.sessions[0].id, 'accepted');
  assert.deepEqual(result.data.sessions, JSON.parse(h.disk.get('sessions')));
});

test('clear waits for accepted work, rejects late writes, and cannot erase unrelated local keys', async () => {
  const gate = deferred(),
    calls = [],
    h = repositoryHarness({
      initial: { ...initial, unrelated: 'keep' },
      before: async (op) => {
        if (op.kind === 'multiSet') await gate.promise;
      },
      effects: {
        clearRunning: async () => calls.push('running'),
        resetConnection: async () => calls.push('connection'),
        clearMemory: async () => calls.push('memory'),
      },
    });
  await h.load();
  const save = h.store().saveSession(session('accepted')),
    clearing = h.store().clearData();
  await assert.rejects(h.store().patchProfile({ weight: 80 }), /清除/);
  gate.resolve();
  await Promise.all([save, clearing]);
  assert.equal(h.store().profile, null);
  assert.deepEqual(h.store().sessions, []);
  assert.equal(h.disk.get('unrelated'), 'keep');
  assert.equal(h.disk.has('sessions'), false);
  assert.deepEqual(calls, ['running', 'connection', 'memory']);
  await h.store().saveProfile(profile);
  assert.equal(h.store().profile.name, profile.name);
});

test('a failure clearing a secondary memory store does not show already-deleted business data', async () => {
  const h = repositoryHarness({
    initial,
    effects: {
      clearMemory: async () => {
        throw Error('memory unavailable');
      },
    },
  });
  await h.load();
  await assert.rejects(h.store().clearData(), /memory unavailable/);
  assert.equal(h.store().profile, null);
  assert.equal(h.disk.has('user_profile'), false);
  await h.store().saveProfile(profile);
  assert.equal(h.store().ready, true);
});

test('the stable repository handle observes fresh data and captures targets after profile/training queues drain', async () => {
  const h = repositoryHarness({ initial });
  await h.load();
  const tools = h.repository,
    old = tools.getSnapshot(),
    patching = old.patchProfile({ weight: 80 });
  const target = old.captureNutritionTarget();
  await Promise.all([patching, target]);
  assert.equal(tools.getSnapshot().profile.weight, 80);
  assert.equal(old.profile.weight, 75);
  const date = require('../src/domain/weight/weightTrend.ts').localWeightDate(new Date());
  const targets = tools.getSnapshot().nutritionJournal.days[date].targetHistory.at(-1);
  assert.ok(targets);
  assert.equal(targets.body.weight, 80);
});

test('a partially persisted training reset rolls back both keys and later writes still work', async () => {
  const h = repositoryHarness({ initial });
  await h.load();
  await h.store().saveSession(session('one'));
  await h.store().addDailyExercise('2026-10-09', 'qa', 'push_05');
  const previous = new Map(h.disk),
    multiSet = h.storage.multiSet;
  h.storage.multiSet = async (pairs) => {
    if (pairs.length === 2) {
      h.disk.set(...pairs[0]);
      throw Error('half-written reset');
    }
    await multiSet(pairs);
  };
  await assert.rejects(h.store().resetTrainingDay('2026-10-09'), /half-written/);
  assert.deepEqual(h.disk, previous);
  assert.equal(h.store().sessions.length, 1);
  h.storage.multiSet = multiSet;
  await h.store().resetTrainingDay('2026-10-09');
  assert.deepEqual(h.store().sessions, []);
  assert.deepEqual(h.store().dailyEdits, {});
  assert.equal(h.disk.has('training_write_ahead_v1'), false);
});

test('startup restores an unfinished batch before loading domains and never touches unrelated keys', async () => {
  const before = JSON.stringify([session('one')]),
    edits = JSON.stringify({
      '2026-10-09__qa': { date: '2026-10-09', workoutId: 'qa', exerciseIds: ['push_05'] },
    });
  const intent = {
    version: 1,
    before: [
      ['sessions', before],
      ['daily_workout_edits', edits],
    ],
    after: [
      ['sessions', '[]'],
      ['daily_workout_edits', '{}'],
    ],
  };
  const h = repositoryHarness({
    initial: {
      ...initial,
      sessions: '[]',
      daily_workout_edits: edits,
      unrelated: 'keep',
      training_write_ahead_v1: JSON.stringify(intent),
    },
  });
  await h.load();
  assert.equal(h.store().sessions[0].id, 'one');
  assert.equal(h.disk.get('unrelated'), 'keep');
  assert.equal(h.disk.has('training_write_ahead_v1'), false);
  assert.deepEqual(h.store().storageIssues, {});
});

test('corrupt or unrecoverable intents protect only training and remain exportable until retry', async () => {
  let failed = true;
  const intent = JSON.stringify({
    version: 1,
    before: [
      ['sessions', JSON.stringify([session('one')])],
      ['daily_workout_edits', null],
    ],
    after: [
      ['sessions', '[]'],
      ['daily_workout_edits', '{}'],
    ],
  });
  const h = repositoryHarness({
    initial: { ...initial, training_write_ahead_v1: intent, sessions: '[]' },
    before: async (op) => {
      if (failed && op.key === 'sessions') throw Error('recovery disk full');
    },
  });
  await h.load();
  await assert.rejects(h.store().saveSession(session('two')), /暂停/);
  await h.store().patchProfile({ weight: 77 });
  assert.equal(
    JSON.parse(await h.store().exportData()).recovery.raw.training_write_ahead_v1,
    intent,
  );
  failed = false;
  await h.store().retryStorageLoading();
  assert.equal(h.store().sessions[0].id, 'one');
  const invalid = repositoryHarness({
    initial: {
      ...initial,
      training_write_ahead_v1: JSON.stringify({
        version: 1,
        before: [
          ['user_profile', 'erase'],
          ['sessions', '[]'],
        ],
        after: [
          ['user_profile', 'erase'],
          ['sessions', '[]'],
        ],
      }),
    },
  });
  await invalid.load();
  assert.equal(invalid.store().profile.name, profile.name);
  await assert.rejects(invalid.store().resetTrainingDay('2026-10-09'), /暂停/);
});
