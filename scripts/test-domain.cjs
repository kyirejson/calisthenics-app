const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const ts = require('typescript');

// Domain modules are dependency-free TypeScript; this small loader lets Node's
// built-in test runner exercise the same source used by the app.
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  module._compile(output, filename);
};

const { exercises, getWorkoutExercises, canAddExercise, canPlanNeckBridges } = require('../src/data/catalog.ts');
const progression = require('../src/data/progression.ts');
const plans = require('../src/data/trainingPlans.ts');
const { estimateStrengthSession } = require('../src/data/trainingPrescription.ts');
const { buildPlanDraft, generatePersonalPlan } = require('../src/data/personalPlan.ts');
const { getCalendarMonths, getDayTrainingState, getDisplayedSchedule } = require('../src/data/planProgress.ts');
const { calculateNutritionPlan } = require('../src/data/nutritionPlanner.ts');
const { trainingGoals } = require('../src/data/trainingGoals.ts');
const { recordWeight, suggestedPlanningWeight, summarizeWeightTrend } = require('../src/data/weightTrend.ts');
const { headstandReadiness, cleanSession, normalizeTrainingSessions, dailyWorkoutKey, withoutTrainingDay, trainingDateKey } = require('../src/data/sessionRecords.ts');
const { getWarmupActions, warmupDuration } = require('../src/data/trainingWarmup.ts');
const gateRecord = (id = 'gate', reps = 200, date = new Date(2026, 8, 20, 10)) => ({
  id, kind: 'strength', workoutId: 'prisonerA', startedAt: date.toISOString(), completedAt: date.toISOString(), completion: 'partial',
  exercises: [{ exerciseId: 'push_06', name: '窄距俯卧撑', category: 'push', sets: [{ completed: true, reps, unit: 'reps' }] }],
});
const gateContext = { sessions: [gateRecord()], date: new Date(2026, 8, 26, 23) };

test('history ignores unchecked strength visits but preserves checked sets and running', () => {
  const checked = gateRecord('checked', 10);
  const unchecked = gateRecord('unchecked', 20);
  unchecked.exercises[0].sets[0].completed = false;
  const empty = { ...gateRecord('empty'), exercises: [], durationSeconds: 600 };
  const zero = gateRecord('zero', 0);
  const running = { ...empty, id: 'running', kind: 'running', durationSeconds: 1200 };
  assert.deepEqual(normalizeTrainingSessions([unchecked, empty, checked, zero, running]).map(s => s.id), ['checked', 'running']);
  assert.equal(normalizeTrainingSessions([checked])[0].totalReps, 10);
  assert.equal(unchecked.exercises[0].sets.length, 1, 'normalization must not mutate the backup');
});

test('headstand gate counts only completed close-pushup reps on the same local day', () => {
  const now = new Date(2026, 8, 26, 23);
  const a = gateRecord('a', 199, new Date(2026, 8, 25, 9));
  const b = gateRecord('b', 1, new Date(2026, 8, 25, 18));
  assert.equal(headstandReadiness([a], now).unlocked, false);
  assert.equal(headstandReadiness([a, b], now).unlocked, true);
  assert.equal(headstandReadiness([a, a], now).bestDayReps, 199, 'duplicate session IDs must not multiply volume');
  assert.equal(headstandReadiness([a, gateRecord('other-day', 1, new Date(2026, 8, 26, 9))], now).unlocked, false);
  const unchecked = gateRecord('unchecked', 500);
  unchecked.exercises[0].sets[0].completed = false;
  const seconds = gateRecord('seconds', 500);
  seconds.exercises[0].sets[0].unit = 'seconds';
  const otherExercise = gateRecord('regular-push', 500);
  otherExercise.exercises[0].exerciseId = 'push_05';
  assert.equal(headstandReadiness([unchecked, seconds, otherExercise], now).unlocked, false);
  assert.equal(headstandReadiness([gateRecord('future', 200, new Date(2026, 8, 27))], now).unlocked, false);
  const midnight = gateRecord('midnight', 100, new Date(2026, 8, 25, 23, 59));
  midnight.exercises[0].sets.push({ completed: true, reps: 100, unit: 'reps', completedAt: new Date(2026, 8, 26, 0, 1).toISOString() });
  assert.equal(headstandReadiness([midnight], now).unlocked, false, 'new checked sets use their actual completion dates');
});

test('all prisoner stages gate inversions and replace locked slots with push and neck preparation', () => {
  for (const experience of ['beginner', 'intermediate', 'advanced', 'elite', 'supermax']) {
    for (const push of [1, 6, 7]) {
      const frequency = experience === 'beginner' ? 2 : experience === 'intermediate' ? 3 : 6;
      const selected = { ...profile, goal: 'street_mastery', frequency, experience, levels: { push, hspu: 1 }, planLevels: { hspu: 1 } };
      const id = experience === 'advanced' ? 'prisonerF' : 'prisonerC';
      const locked = getWorkoutExercises(id, selected, 1, 'volume', 1, { addedExerciseIds: ['hspu_01'] });
      assert.ok(!locked.some((item) => item.category === 'hspu'));
      assert.ok(locked.some((item) => item.category === 'push'));
      assert.ok(locked.some((item) => item.id === 'neck_handResistance'));
      assert.ok(!locked.some((item) => item.id === 'prep_scapula'));
      assert.equal(locked.find((item) => item.id === 'neck_handResistance').targetSets, 1);
      const unlocked = getWorkoutExercises(id, selected, 1, 'volume', 1, gateContext);
      assert.ok(unlocked.some((item) => item.id === 'hspu_01'));
      assert.ok(!unlocked.some((item) => item.id === 'prep_scapula'));
      assert.equal(headstandReadiness([], gateContext.date).unlocked, false, 'deleting qualifying evidence relocks the rule');
    }
  }
});

test('neck bridge preparation requires both reported bridge foundation and explicit consent', () => {
  const base = { ...profile, goal: 'street_mastery', frequency: 3, experience: 'intermediate' };
  for (const bridge of [1, 5, 6, 10]) for (const neckBridgeConsent of [false, true]) {
    const selected = { ...base, levels: { bridge }, neckBridgeConsent };
    const allowed = bridge >= 6 && neckBridgeConsent;
    assert.equal(canPlanNeckBridges(selected), allowed);
    const items = getWorkoutExercises('prisonerC', selected);
    const neck = items.filter((item) => item.category === 'neck');
    assert.equal(neck.length, allowed ? 2 : 0);
    assert.equal(canAddExercise(exercises.find((item) => item.id === 'neck_01'), selected), allowed);
    if (allowed) {
      assert.deepEqual(neck.map((item) => item.id), ['neck_01', 'neck_03']);
      assert.ok(neck.every((item) => item.targetSets === 1 && item.targetValue === 3));
      assert.ok(!items.some((item) => item.id === 'neck_handResistance'));
      assert.ok(items.findIndex((item) => item.category === 'bridge') < items.findIndex((item) => item.category === 'neck'));
    }
  }
});

test('automatic neck work is deduplicated, capped at two days weekly and independent of cycle volume', () => {
  for (const [experience, frequency] of [['beginner', 2], ['intermediate', 3], ['advanced', 6], ['elite', 6], ['supermax', 6]]) {
    for (const neckBridgeConsent of [false, true]) {
      const selected = { ...profile, goal: 'street_mastery', experience, frequency, neckBridgeConsent, levels: { push: 5, bridge: 6 } };
      let neckDays = 0;
      for (let offset = 0; offset < 7; offset++) {
        const day = plans.getPlanDay(selected, new Date(2026, 8, 21 + offset)).day;
        if (!day.workoutId) continue;
        const items = getWorkoutExercises(day.workoutId, selected, 2);
        assert.ok(!items.some((item) => item.category === 'hspu'));
        assert.equal(new Set(items.map((item) => item.id)).size, items.length);
        const neck = items.filter((item) => item.category === 'neck' || item.id === 'neck_handResistance');
        if (neck.length) neckDays++;
        assert.ok(neck.every((item) => item.targetSets === 1 && item.targetUnit === 'reps'), '起步 in guidance must not be parsed as a step-count exercise');
      }
      assert.ok(neckDays <= 2);
      assert.equal(neckDays, frequency === 2 ? 0 : experience === 'elite' || experience === 'supermax' ? 2 : 1);
    }
  }
});

test('neck source sections contain exact original figures and hand resistance has no borrowed illustration', (t) => {
  const { recoveryOriginalTexts: resources } = require('../src/data/private/recoveryTexts.ts');
  if (!resources.neck_01) { t.skip('Private book excerpts are not included in public checkouts'); return; }
  const expected = { neck_01: ['image00851.jpeg', 'image00852.jpeg'], neck_03: ['image00855.jpeg', 'image00856.jpeg', 'image00857.jpeg', 'image00858.jpeg', 'image00859.jpeg'] };
  for (const [id, imageNames] of Object.entries(expected)) {
    assert.deepEqual([...resources[id].markdown.matchAll(/!\[\[([^\]]+)\]\]/g)].map((match) => match[1]), imageNames);
    assert.deepEqual(resources[id].missingImageNames, []);
    for (const filename of imageNames) assert.ok(fs.existsSync(require('node:path').join(__dirname, '../assets/original-images', filename)));
  }
  assert.equal(resources.neck_handResistance.primaryImageName, null);
  assert.ok(!resources.neck_handResistance.markdown.includes('![['));
  assert.ok(resources.neck_handResistance.markdown.includes('手阻抬头'));
  assert.ok(resources.neck_handResistance.markdown.includes('一周两次'));
  assert.ok(!exercises.some((item) => item.id === 'prep_scapula'));
  const neck = exercises.find((item) => item.id === 'neck_handResistance');
  assert.equal(neck.isHold, undefined);
  assert.ok(neck.keyPoints.some((point) => point.includes('原书热身')));
});

test('stage two has no scheduled fourth-week deload for the entire year', () => {
  const selected = { ...profile, goal: 'street_mastery', frequency: 3, experience: 'intermediate' };
  for (let day = 0; day < 365; day++) {
    const date = new Date(2026, 8, 21 + day);
    const cycle = plans.getCycleMeta(selected, date);
    assert.equal(cycle.isDeload, false);
    assert.equal(cycle.setMultiplier, 1);
    const items = getWorkoutExercises('prisonerA', selected, cycle.setMultiplier);
    assert.ok(items.every((item) => item.targetSets === 2));
  }
});

test('records contain only checked positive sets and reset touches only the specified day', () => {
  const record = gateRecord('clean', 10);
  record.exercises[0].sets.push({ completed: false, reps: 100, unit: 'reps' }, { completed: true, reps: 0, unit: 'reps' });
  record.exercises.push({ exerciseId: 'pull_01', name: '引体', category: 'pull', sets: [{ completed: false, reps: 999, unit: 'reps' }] });
  const cleaned = cleanSession(record);
  assert.equal(cleaned.totalReps, 10);
  assert.equal(cleaned.exercises.length, 1);
  assert.equal(cleaned.exercises[0].sets.length, 1);
  assert.equal(record.exercises.length, 2, 'does not mutate caller state');
  const previous = gateRecord('previous', 50, new Date(2026, 8, 19));
  const key = trainingDateKey(new Date(2026, 8, 20));
  const edits = { [dailyWorkoutKey(key, 'prisonerA')]: { date: key, workoutId: 'prisonerA', exerciseIds: ['push_06'] }, previous: { date: '2026-9-19', workoutId: 'prisonerA', exerciseIds: ['push_05'] } };
  const reset = withoutTrainingDay([record, previous], edits, key);
  assert.deepEqual(reset.sessions.map((item) => item.id), ['previous']);
  assert.deepEqual(Object.keys(reset.edits), ['previous']);
  assert.equal(getDayTrainingState({ date: new Date(2026, 8, 20), type: 'strength', workoutId: 'prisonerA' }, reset.sessions).complete, false);
});

test('daily extra exercises deduplicate and do not replace the base course', () => {
  const selected = { ...profile, goal: 'street_mastery', frequency: 2, experience: 'beginner' };
  const base = getWorkoutExercises('prisonerA', selected);
  const added = getWorkoutExercises('prisonerA', selected, 1, 'volume', 1, { addedExerciseIds: ['push_06', 'push_06', base[0].id] });
  assert.equal(added.length, base.length + 1);
  assert.deepEqual(added.slice(0, base.length), base);
  assert.equal(getWorkoutExercises('prisonerA', selected).length, base.length);
});

test('warmup actions and session estimate share the same duration and never use head-bearing inversion', () => {
  const selected = { ...profile, goal: 'street_mastery', frequency: 3, experience: 'intermediate' };
  for (const id of ['prisonerA', 'prisonerB', 'prisonerC', 'prisoner_recovery_phase1']) {
    const items = getWorkoutExercises(id, selected);
    const actions = getWarmupActions(items);
    assert.ok(actions.length >= 2);
    assert.equal(estimateStrengthSession(items, 45, true).warmupSeconds, actions.reduce((sum, action) => sum + action.seconds, 0));
    assert.ok(actions.every((action) => action.exercise?.category !== 'hspu'));
  }
});

test('corrected grip targets preserve both hold duration and number of sets', () => {
  const first = exercises.find((item) => item.id === 'hang_01');
  const second = exercises.find((item) => item.id === 'hang_02');
  const firstCriteria = progression.parseMasteryCriteria(first);
  const secondCriteria = progression.parseMasteryCriteria(second);
  assert.deepEqual([firstCriteria.sets, firstCriteria.value, firstCriteria.unit], [4, 30, 'seconds']);
  assert.deepEqual([secondCriteria.sets, secondCriteria.value, secondCriteria.unit], [4, 60, 'seconds']);
  assert.ok(first.keyPoints.some((point) => point.includes('脚跟')));
  assert.ok(second.keyPoints.some((point) => point.includes('双脚离地')));
  assert.equal(progression.parseMasteryCriteria(exercises.find((item) => item.id === 'recovery_bentHold')).unit, 'seconds');
});

test('newly unlocked automatic inversion starts at headstand rather than an unverified manual step', () => {
  const selected = { ...profile, goal: 'street_mastery', frequency: 6, experience: 'advanced', levels: { hspu: 1 }, planLevels: { hspu: 3 } };
  assert.equal(getWorkoutExercises('prisonerF', selected, 1, 'volume', 1, gateContext)[0].id, 'hspu_01');
});

test('adding a new daily action invalidates completion until that action has a record', () => {
  const record = { ...gateRecord(), completion: 'complete' };
  const day = { date: new Date(record.startedAt), type: 'strength', workoutId: record.workoutId };
  assert.equal(getDayTrainingState(day, [record]).complete, true);
  assert.equal(getDayTrainingState(day, [record], ['push_05']).complete, false);
  assert.equal(getDayTrainingState(day, [record], ['push_05']).partial, true);
});

test('stage five qualified courses preserve their existing endurance prescription', () => {
  const selected = { ...profile, goal: 'street_mastery', frequency: 6, experience: 'supermax', levels: { push: 1, pull: 1, squat: 1, legRaise: 1, bridge: 1, hspu: 1 } };
  for (const week of [1, 4]) for (const id of ['prisonerA', 'prisonerB', 'prisonerC', 'prisonerD', 'prisonerE', 'prisonerF']) {
    const items = getWorkoutExercises(id, selected, week === 4 ? .65 : 1, 'volume', week, gateContext);
    assert.equal(items.length, 2);
    assert.ok(items.every((item) => item.targetSets === 10 && item.targetValue === 10 && item.restSeconds === 45));
  }
  const recovery = getWorkoutExercises('prisoner_recovery_elite', selected);
  assert.deepEqual(recovery.map((item) => [item.id, item.targetSets, item.targetValue, item.restSeconds]), [['hang_01', 10, 30, 45], ['trifecta_bridge', 10, 10, 45], ['trifecta_lHold', 10, 5, 45], ['trifecta_twist', 10, 15, 45]]);
});

const profile = {
  name: '测试者', sex: 'male', age: 28, height: 175, weight: 70,
  goal: 'weight_loss', nutritionGoal: 'rapid_loss', dietPattern: 'balanced_cn',
  frequency: 3, experience: 'beginner', planId: 'balanced_3',
  planStartedAt: new Date(2026, 8, 21).toISOString(),
  levels: { push: 1 },
};

test('book actions and labelled app support actions belong to the catalogue', () => {
  assert.equal(exercises.length, 223);
  const statuses = progression.getAllProgressionStatuses(profile, []);
  assert.equal(statuses.length, 23);
  assert.equal(statuses.reduce((sum, status) => sum + status.totalLevels, 0), 179);
  assert.equal(progression.getSeriesExercises('push').length, 16, 'later variants remain browsable');
  assert.equal(progression.getProgressionStatus('push', profile, []).totalLevels, 10);
});

test('overall unlock counts final forms, not all intermediate stages', () => {
  const starting = progression.getFinalFormProgress(progression.getAllProgressionStatuses(profile, []));
  assert.deepEqual(starting, { unlocked: 0, total: 23, percent: 0 });
  const oneFinal = progression.getFinalFormProgress(progression.getAllProgressionStatuses({ ...profile, levels: { push: 11 } }, []));
  assert.deepEqual(oneFinal, { unlocked: 1, total: 23, percent: 4 });
  const finalPending = progression.getProgressionStatus('push', { ...profile, levels: { push: 10 } }, []);
  assert.equal(finalPending.complete, false);
  assert.equal(finalPending.next, undefined);
  assert.equal(finalPending.current.name, '单臂俯卧撑');
  assert.equal(getWorkoutExercises('fullA', { ...profile, levels: { push: 11 }, planLevels: {} }).find((item) => item.category === 'push').step, 10);
});

test('four browse groups cover every action exactly once', () => {
  const statuses = progression.getAllProgressionStatuses(profile, []);
  assert.equal(progression.progressionGroups.length, 4);
  const groupedIds = progression.progressionGroups.flatMap((group) => [
    ...statuses.filter((status) => status.series.group === group.key)
      .flatMap((status) => progression.getSeriesExercises(status.series.key).map((exercise) => exercise.id)),
    ...(group.key === '关节与支援' ? exercises.filter((exercise) => exercise.category === 'auxiliary').map((exercise) => exercise.id) : []),
  ]);
  assert.equal(groupedIds.length, exercises.length);
  assert.equal(new Set(groupedIds).size, exercises.length);
});

test('progression needs two qualified sessions at least 24 hours apart', () => {
  const status = progression.getProgressionStatus('push', profile, []);
  const exercise = status.current;
  const criteria = status.criteria;
  const session = (completedAt, quality = 'solid') => ({
    id: completedAt, kind: 'strength', workoutId: `single_${exercise.id}`,
    completedAt, quality, completion: 'complete',
    exercises: [{
      exerciseId: exercise.id,
      constraintsConfirmed: true,
      sets: Array.from({ length: criteria.sets }, () => ({
        completed: true, reps: criteria.value, unit: criteria.unit,
      })),
    }],
  });
  const older = session('2026-09-21T09:00:00Z');
  const sameDay = session('2026-09-22T08:59:00Z');
  const later = session('2026-09-22T10:00:00Z');
  assert.equal(progression.getProgressionStatus('push', profile, [older, sameDay]).eligible, false);
  assert.equal(progression.getProgressionStatus('push', profile, [older, later]).eligible, true);
  assert.equal(progression.getProgressionStatus('push', profile, [older, session(later.completedAt, 'pain')]).eligible, false);
});

test('unilateral actions require explicit full-standard confirmation', () => {
  const oneArm = exercises.find((exercise) => exercise.id === 'push_08');
  assert.ok(oneArm);
  const criteria = progression.parseMasteryCriteria(oneArm);
  assert.equal(criteria.manual, true);
  assert.match(criteria.confirmationHint, /左右两侧/);
});

test('verified progression advances only the matching training variant', () => {
  const status = progression.getProgressionStatus('push', { ...profile, planLevels: { push: 1 } }, []);
  const next = progression.applyProgressionUnlock({ ...profile, planLevels: { push: 1 } }, status);
  assert.equal(next.levels.push, 2);
  assert.equal(next.planLevels.push, 2);
  const manual = progression.applyProgressionUnlock({ ...profile, planLevels: { push: 5 } }, status);
  assert.equal(manual.levels.push, 2);
  assert.equal(manual.planLevels.push, 5);
});

test('new weight-loss users receive a recurring plan for their experience', () => {
  const selected = { ...profile, frequency: 4, experience: 'beginner' };
  selected.planId = plans.recommendPlanId(selected);
  assert.equal(selected.planId, plans.PERSONAL_PLAN_ID);
  assert.equal(plans.getWeekSchedule(selected, new Date(2026, 8, 21)).filter((day) => day.type !== 'recovery').length, 4);
  const activation = new Date(2026, 8, 23);
  const firstDay = plans.getPlanDay({ ...selected, planStartedAt: activation.toISOString() }, activation);
  assert.equal(firstDay.day.type, 'strength', 'a new plan should begin with a planned workout on activation day');
});

test('personal plan progress reflects completed stages and persists one generated plan', async () => {
  const updates = [];
  const saved = [];
  const summary = await generatePersonalPlan({ ...profile, sessionMinutes: 45 }, async (next) => { saved.push(next); }, (step) => updates.push(step));
  assert.deepEqual(updates.map((step) => step.progress), [15, 40, 75, 90, 100]);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].planId, plans.PERSONAL_PLAN_ID);
  assert.equal(summary.strengthDays + summary.cardioDays, profile.frequency);
});

test('weight-loss training frequency produces exactly that many planned days', () => {
  const anchor = new Date(2026, 8, 21);
  for (const experience of ['beginner', 'intermediate', 'advanced']) {
      for (const frequency of [2, 3, 4, 5, 6]) {
        const selected = { ...profile, experience, frequency, planId: plans.recommendPlanId(profile), planStartedAt: anchor.toISOString() };
        const week = plans.getWeekSchedule(selected, anchor);
        assert.equal(week.filter((day) => day.type !== 'recovery').length, frequency, `${experience}/${frequency} training days`);
        const comingDays = getDisplayedSchedule(selected, new Date(2026, 8, 23));
        assert.equal(comingDays.length, 7);
        assert.equal(comingDays[0].date.getDate(), 23);
        assert.equal(comingDays.filter((day) => day.type !== 'recovery').length, frequency, `${experience}/${frequency} upcoming days`);
        assert.equal(plans.getPlanDay(selected, anchor).plan.frequency, frequency);
      }
  }
});

test('retired goals cannot schedule or generate old courses', async () => {
  const anchor = new Date(2026, 8, 23);
  assert.deepEqual(trainingGoals.map((item) => item.key), ['weight_loss', 'street_mastery']);
  for (const goal of ['fat_loss', 'gain', 'strength']) {
    const selected = { ...profile, goal, planStartedAt: anchor.toISOString() };
    assert.equal(plans.recommendPlanId(selected), plans.RETIRED_PLAN_ID);
    assert.equal(plans.getPlanDay(selected, anchor).plan.frequency, 0);
    assert.equal(plans.getPlanDay(selected, anchor).day.title, '暂无训练计划');
    assert.ok(plans.getWeekSchedule(selected, anchor).every((day) => day.type === 'recovery' && !day.workoutId));
    assert.deepEqual(getWorkoutExercises('fullA', selected), []);
    await assert.rejects(generatePersonalPlan(selected, async () => {}, () => {}), /暂无训练计划/);
  }
  assert.deepEqual(Object.keys(require('../src/data/legacy/templates.js').workouts).sort(), [
    'fullA', 'fullB', 'fullComprehensive',
    'prisonerA', 'prisonerB', 'prisonerC', 'prisonerD', 'prisonerE', 'prisonerF',
    'prisoner_recovery_phase1', 'prisoner_recovery_trifecta', 'prisoner_recovery_elite',
  ].sort());
  assert.equal(require('../src/data/catalog.ts').getWorkout('splitUpper'), undefined);
  assert.equal(require('../src/data/catalog.ts').getWorkout('pplPush'), undefined);
  const retiredPrisoner = { ...profile, goal: 'street_mastery', planId: plans.RETIRED_PLAN_ID };
  assert.equal(plans.getPlanDay(retiredPrisoner, anchor).day.title, '暂无训练计划');
  assert.deepEqual(getWorkoutExercises('prisonerA', retiredPrisoner), []);
});

test('prisoner six arts offers original-book two, three and six day splits', () => {
  const anchor = new Date(2026, 8, 21, 12);
  const base = { ...profile, goal: 'street_mastery', nutritionGoal: 'performance', experience: 'intermediate', frequency: 3, sessionMinutes: 45, planStartedAt: anchor.toISOString(), levels: { push: 1, pull: 1, squat: 1, legRaise: 1, bridge: 1, hspu: 1 } };
  assert.equal(plans.recommendPlanId(base), plans.PRISONER_PLAN_ID);
  for (const frequency of [2, 3, 6]) {
    const selected = { ...base, frequency, experience: 'beginner' };
    const strengthDays = plans.getWeekSchedule(selected, anchor).filter((day) => day.type === 'strength');
    assert.equal(strengthDays.length, frequency);
    assert.equal(new Set(strengthDays.map((day) => day.workoutId)).size, frequency);
  }
  assert.equal(getDisplayedSchedule(base, anchor, 365).length, 365);
  assert.equal(plans.getCycleMeta(base, new Date(2026, 9, 12)).isDeload, false);
  assert.equal(progression.getProgressionStatus('hspu', base, []).complete, false);
  const two = { ...base, frequency: 2 };
  const twoArts = ['prisonerA', 'prisonerB'].flatMap((id) => getWorkoutExercises(id, two).map((item) => item.category));
  assert.deepEqual(new Set(twoArts), new Set(['push', 'pull', 'squat', 'legRaise']));
  const six = { ...base, frequency: 6, levels: { ...base.levels, hspu: 3 }, planLevels: { hspu: 3 } };
  const sixArts = ['prisonerA', 'prisonerB', 'prisonerC', 'prisonerD', 'prisonerE', 'prisonerF'].map((id) => getWorkoutExercises(id, six, 1, 'volume', 8, gateContext).map((item) => item.category));
  assert.deepEqual(sixArts, [['push'], ['squat'], ['pull'], ['legRaise'], ['bridge'], ['hspu']]);
});

test('prisoner stage four solitary confinement implements double cycle 3-day split with support arts', () => {
  const anchor = new Date(2026, 8, 21, 12);
  const elite = { ...profile, goal: 'street_mastery', experience: 'elite', frequency: 6, sessionMinutes: 45, planStartedAt: anchor.toISOString(), levels: { push: 1, pull: 1, squat: 1, legRaise: 1, bridge: 1, hspu: 3 }, planLevels: { hspu: 3 } };
  assert.equal(plans.getCycleMeta(elite, anchor).label.includes('闭关修炼'), true);
  const week = plans.getWeekSchedule(elite, anchor);
  const strengthDays = week.filter((d) => d.type === 'strength');
  assert.equal(strengthDays.length, 6);
  assert.equal(strengthDays[0].title.includes('拉力与下肢'), true);
  assert.equal(strengthDays[1].title.includes('推力与腹部'), true);
  assert.equal(strengthDays[2].title.includes('垂直推与后链'), true);
  assert.equal(strengthDays[3].title.includes('拉力与下肢'), true);
  assert.equal(strengthDays[4].title.includes('推力与腹部'), true);
  assert.equal(strengthDays[5].title.includes('垂直推与后链'), true);
  const day1Exercises = getWorkoutExercises(strengthDays[0].workoutId, elite, 1, 'volume', 1);
  assert.deepEqual(day1Exercises.map((e) => e.category), ['pull', 'squat', 'hang_grip']);
  const day2Exercises = getWorkoutExercises(strengthDays[1].workoutId, elite, 1, 'volume', 1);
  assert.deepEqual(day2Exercises.map((e) => e.category), ['push', 'legRaise', 'auxiliary']);
  assert.equal(day2Exercises[2].name, '单腿提踵');
  const day3Exercises = getWorkoutExercises(strengthDays[2].workoutId, elite, 1, 'volume', 1, gateContext);
  assert.deepEqual(day3Exercises.map((e) => e.category), ['hspu', 'bridge', 'auxiliary']);
});

test('prisoner rejects old four/five day choices instead of silently changing the saved plan', async () => {
  for (const frequency of [4, 5]) {
    await assert.rejects(generatePersonalPlan({ ...profile, goal: 'street_mastery', frequency }, async () => {}, () => {}), /2、3 或 6 练/);
  }
});

test('prisoner stage one and two workouts strictly follow original book structure without variant padding', () => {
  const stage1 = { ...profile, goal: 'street_mastery', frequency: 2, experience: 'beginner', levels: { push: 5, pull: 3, squat: 5, legRaise: 4 } };
  const stage1Day1 = getWorkoutExercises('prisonerA', stage1, 1, 'volume', 1);
  const stage1Day2 = getWorkoutExercises('prisonerB', stage1, 1, 'volume', 1);
  assert.equal(stage1Day1.length, 2, 'stage 1 should have exactly 2 exercises per workout');
  assert.deepEqual(stage1Day1.map((item) => item.category), ['push', 'legRaise']);
  assert.equal(stage1Day2.length, 2);
  assert.deepEqual(stage1Day2.map((item) => item.category).sort(), ['pull', 'squat']);

  const stage2 = { ...profile, goal: 'street_mastery', frequency: 3, experience: 'intermediate', levels: { push: 5, pull: 3, squat: 5, legRaise: 4, bridge: 2, hspu: 1 } };
  const stage2A = getWorkoutExercises('prisonerA', stage2, 1, 'volume', 1);
  const stage2B = getWorkoutExercises('prisonerB', stage2, 1, 'volume', 1);
  const stage2C = getWorkoutExercises('prisonerC', stage2, 1, 'volume', 1, gateContext);
  assert.equal(stage2A.length, 2);
  assert.deepEqual(stage2A.map((item) => item.category).sort(), ['legRaise', 'push']);
  assert.equal(stage2B.length, 2);
  assert.deepEqual(stage2B.map((item) => item.category).sort(), ['pull', 'squat']);
  assert.equal(stage2C.length, 2);
  assert.deepEqual(stage2C.map((item) => item.category).sort(), ['bridge', 'hspu']); // CC1 Stage II: authentic Handstand Pushup + Bridge
  assert.ok(stage2A.every((item) => item.targetSets === 2), 'stage 2 exercises have 2 work sets');
  assert.ok(stage2C.every((item) => item.targetSets === 2), 'stage 2 Friday exercises have 2 work sets');
});

test('stage four preserves main volume and starts corrected support work at an appropriate level', () => {
  const elite = { ...profile, goal: 'street_mastery', experience: 'elite', frequency: 6, sessionMinutes: 45, levels: { push: 5, pull: 5, squat: 5, legRaise: 5, bridge: 5, hspu: 5 } };
  const day1 = getWorkoutExercises('prisonerB', elite, 1, 'volume', 1); // pull, squat, hang_grip
  const pullEx = day1.find((item) => item.category === 'pull');
  const gripEx = day1.find((item) => item.category === 'hang_grip');
  assert.equal(pullEx.targetSets, 4, 'main arts have 4 sets');
  assert.equal(pullEx.restSeconds, 120, 'main arts have 120s rest');
  assert.equal(gripEx.targetSets, 3, 'grip has 3 sets');
  assert.equal(gripEx.restSeconds, 90, 'grip has 90s rest');

  const day2 = getWorkoutExercises('prisonerA', elite, 1, 'volume', 1); // push, legRaise, calf
  const calfEx = day2.find((item) => item.id === 'aux_singleLegCalf');
  assert.ok(calfEx);
  assert.equal(calfEx.targetSets, 2, 'application single-leg calf dose has 2 sets');
  assert.equal(calfEx.restSeconds, 60, 'calf has 60s rest');
  assert.equal(calfEx.targetValue, 20, 'single-leg dose is 10 per side, recorded as 20 total');

  const day3 = getWorkoutExercises('prisonerC', elite, 1, 'volume', 1); // hspu, bridge, neck
  const neckEx = day3.find((item) => item.id === 'neck_handResistance');
  assert.ok(neckEx);
  assert.equal(neckEx.targetSets, 1, 'neck alternative is low-dose and explicitly not a book neck bridge');
  assert.equal(neckEx.restSeconds, 120, 'neck recovery can be extended');
});

test('prisoner natural week alignment anchors strictly to Monday-Sunday with zero date drift', () => {
  // Test starting on Wednesday (2026-09-23) - schedule must still map to Mon/Wed/Fri, not drift!
  const wednesdayStart = new Date(2026, 8, 23, 10);
  const stage2 = { ...profile, goal: 'street_mastery', frequency: 3, experience: 'intermediate', planStartedAt: wednesdayStart.toISOString() };

  // Monday of that week (2026-09-21)
  const mondayPlan = plans.getPlanDay(stage2, new Date(2026, 8, 21));
  assert.equal(mondayPlan.day.type, 'strength');
  assert.equal(mondayPlan.day.workoutId, 'prisonerA');
  assert.ok(mondayPlan.day.title.includes('俯卧撑与举腿'));

  // Wednesday of that week (2026-09-23)
  const wednesdayPlan = plans.getPlanDay(stage2, new Date(2026, 8, 23));
  assert.equal(wednesdayPlan.day.type, 'strength');
  assert.equal(wednesdayPlan.day.workoutId, 'prisonerB');
  assert.ok(wednesdayPlan.day.title.includes('引体向上与深蹲'));

  // Friday of that week (2026-09-25)
  const fridayPlan = plans.getPlanDay(stage2, new Date(2026, 8, 25));
  assert.equal(fridayPlan.day.type, 'strength');
  assert.equal(fridayPlan.day.workoutId, 'prisonerC');
  assert.ok(fridayPlan.day.title.includes('倒立撑与桥'));

  // Tuesday and Sunday must be recovery
  assert.equal(plans.getPlanDay(stage2, new Date(2026, 8, 22)).day.type, 'recovery');
  assert.equal(plans.getPlanDay(stage2, new Date(2026, 8, 27)).day.type, 'recovery');

  // getWeekSchedule from any anchor in the week returns Monday through Sunday
  const week = plans.getWeekSchedule(stage2, wednesdayStart);
  assert.equal(week.length, 7);
  assert.equal(week[0].type, 'strength'); // Mon
  assert.equal(week[1].type, 'recovery'); // Tue
  assert.equal(week[2].type, 'strength'); // Wed
  assert.equal(week[3].type, 'recovery'); // Thu
  assert.equal(week[4].type, 'strength'); // Fri
  assert.equal(week[5].type, 'recovery'); // Sat
  assert.equal(week[6].type, 'recovery'); // Sun
});

test('prisoner stage three micro-sessions estimate 8-12 minutes without under-target penalty', async () => {
  const anchor = new Date(2026, 8, 21);
  const veterano = { ...profile, goal: 'street_mastery', frequency: 6, experience: 'advanced', sessionMinutes: 45, planStartedAt: anchor.toISOString() };
  const items = getWorkoutExercises('prisonerA', veterano, 1, 'volume', 1);
  assert.equal(items.length, 1, 'Veterano trains single art per day');
  const estimate = estimateStrengthSession(items, 45, true);
  assert.ok(estimate.totalMinutes >= 7 && estimate.totalMinutes <= 14, `estimate was ${estimate.totalMinutes}m`);

  const summary = await generatePersonalPlan(veterano, async () => {}, () => {});
  assert.equal(summary.underTargetDays, 0, 'no under-target penalty for prisoner plans');
  assert.equal(summary.overBudgetDays, 0, 'no over-budget penalty for prisoner plans');
});

test('verified inverted route joins the chosen weekly split without overexposure', () => {
  for (const frequency of [2, 3, 6]) {
    const selected = { ...profile, goal: 'street_mastery', experience: 'advanced', frequency, sessionMinutes: 45, levels: { hspu: 3 }, planLevels: { hspu: 3 } };
    const ids = ['prisonerA', 'prisonerB', 'prisonerC', 'prisonerD', 'prisonerE', 'prisonerF'].slice(0, frequency);
    const inverted = ids.flatMap((id) => getWorkoutExercises(id, selected, 1, 'volume', 8, gateContext)).filter((item) => item.category === 'hspu');
    assert.equal(inverted.length, frequency === 2 ? 0 : 1, `${frequency} weekly days`);
    assert.ok(inverted.every((item) => item.step >= 3));
  }
});

test('prisoner stage five supermax implements high-volume endurance cycles', () => {
  const anchor = new Date(2026, 8, 21, 12);
  const supermax = { ...profile, goal: 'street_mastery', experience: 'supermax', frequency: 6, planStartedAt: anchor.toISOString(), levels: { push: 5, pull: 3, squat: 5, legRaise: 4, bridge: 2, hspu: 3 }, planLevels: { hspu: 3 } };
  assert.ok(plans.getCycleMeta(supermax, anchor).label.includes('登峰造极'));
  const week = plans.getWeekSchedule(supermax, anchor);
  const strengthDays = week.filter((d) => d.type === 'strength');
  assert.equal(strengthDays.length, 6);
  assert.ok(strengthDays[0].title.includes('引体向上与深蹲'));
  assert.ok(strengthDays[1].title.includes('俯卧撑与举腿'));
  assert.ok(strengthDays[2].title.includes('倒立撑与桥'));
  assert.ok(strengthDays[3].title.includes('引体向上与深蹲'));
  assert.ok(strengthDays[4].title.includes('俯卧撑与举腿'));
  assert.ok(strengthDays[5].title.includes('倒立撑与桥'));

  const day1 = getWorkoutExercises(strengthDays[0].workoutId, supermax, 1, 'volume', 1);
  assert.deepEqual(day1.map((item) => item.category).sort(), ['pull', 'squat']);
  assert.ok(day1.every((item) => item.targetSets === 10 && item.targetValue === 10 && item.restSeconds === 45));

  const day2 = getWorkoutExercises(strengthDays[1].workoutId, supermax, 1, 'volume', 1);
  assert.deepEqual(day2.map((item) => item.category).sort(), ['legRaise', 'push']);
  assert.ok(day2.every((item) => item.targetSets === 10 && item.targetValue === 10 && item.restSeconds === 45));
});

test('weight-loss schedule preserves strength, fits cardio time, and avoids automatic high impact', () => {
  const anchor = new Date(2026, 8, 21, 12);
  for (const frequency of [2, 3, 4, 5, 6]) {
    for (const experience of ['beginner', 'advanced']) {
      const selected = { ...profile, goal: 'weight_loss', nutritionGoal: 'rapid_loss', experience, frequency, weight: 105, sessionMinutes: 30, planStartedAt: anchor.toISOString() };
      const week = plans.getWeekSchedule(selected, anchor);
      const summary = plans.weightLossWeekSummary(selected);
      assert.equal(summary.strengthDays + summary.cardioDays, frequency);
      assert.ok(summary.strengthDays >= 2 && summary.strengthDays <= 3);
      assert.equal(summary.plannedCardioMinutes, summary.cardioDays * plans.plannedCardioMinutes(selected));
      assert.ok(week.filter((day) => day.type === 'cardio').every((day) => day.title === '低冲击有氧' && day.targetMinutes + 8 <= selected.sessionMinutes));
      assert.ok(week.filter((day) => day.type === 'strength').every((day) => day.title.includes('保肌')));
    }
  }
  const short = { ...profile, goal: 'weight_loss', sessionMinutes: 20, frequency: 2, planStartedAt: anchor.toISOString() };
  const covered = new Set();
  for (const day of getDisplayedSchedule(short, anchor, 14).filter((item) => item.type === 'strength')) {
    const cycle = plans.getPlanDay(short, day.date).cycle;
    assert.ok(cycle.rirTarget >= 2);
    for (const exercise of getWorkoutExercises(day.workoutId, short, cycle.setMultiplier, cycle.dupDay, cycle.week)) covered.add(exercise.category);
  }
  for (const category of ['push', 'pull', 'squat', 'bridge', 'legRaise']) assert.ok(covered.has(category), `${category} should rotate through short weight-loss sessions`);
  const highRiskChoice = { ...short, weight: 105, sessionMinutes: 60, planLevels: { squat: 11, push: 10, pull: 10 } };
  const autoCourse = getWorkoutExercises('fullA', highRiskChoice);
  assert.ok(autoCourse.every((exercise) => exercise.riskLevel !== 'high'));
  assert.ok(autoCourse.every((exercise) => !exercise.id.includes('_demon_')));
});

test('year calendar projects exactly 365 distinct local dates from today', () => {
  const anchor = new Date(2026, 8, 24, 12);
  const days = getDisplayedSchedule({ ...profile, planStartedAt: anchor.toISOString() }, anchor, 365);
  const last = new Date(anchor);
  last.setDate(last.getDate() + 364);
  assert.equal(days.length, 365);
  assert.equal(new Set(days.map((day) => `${day.date.getFullYear()}-${day.date.getMonth()}-${day.date.getDate()}`)).size, 365);
  assert.equal(days[0].date.getDate(), anchor.getDate());
  assert.equal(days[364].date.getFullYear(), last.getFullYear());
  assert.equal(days[364].date.getMonth(), last.getMonth());
  assert.equal(days[364].date.getDate(), last.getDate());
  const months = getCalendarMonths(days);
  assert.equal(months.length, 13);
  assert.equal(months[0].title, '2026年9月');
  assert.equal(months[1].title, '2026年10月');
  const october14 = months[1].cells.find((cell) => cell?.number === 14)?.day;
  assert.ok(october14, '2026-10-14 must remain selectable on the October page');
  assert.equal(october14.date.getDate(), 14);
  assert.equal(october14.title, plans.getPlanDay({ ...profile, planStartedAt: anchor.toISOString() }, october14.date).day.title);
});

test('plan uses practical doses, adequate rest and independent variant selection', () => {
  const beginner = { ...profile, experience: 'beginner', sessionMinutes: 45 };
  const course = getWorkoutExercises('fullA', beginner);
  const push = course.find((item) => item.category === 'push');
  assert.ok(push);
  assert.ok(push.targetValue <= 12, 'easy variants should prompt progression instead of endless repetitions');
  assert.ok(course.every((item) => item.targetSets <= 3 && item.targetSets >= 2));
  assert.ok(course.every((item) => item.restSeconds >= 90));
  assert.equal(course.length, 4, 'a 45-minute plan should preserve movement coverage');
  const assessed = getWorkoutExercises('fullA', { ...beginner, levels: { ...beginner.levels, push: 5 } });
  assert.equal(assessed.find((item) => item.category === 'push').name, '标准俯卧撑');
  const manual = { ...beginner, planLevels: { push: 5, squat: 5, pull: 2 }, trainingRestSeconds: 180 };
  assert.equal(getWorkoutExercises('fullA', manual).find((item) => item.category === 'squat').name, '标准深蹲');
  assert.equal(getWorkoutExercises('fullB', manual).find((item) => item.category === 'pull').step, 2);
  assert.ok(getWorkoutExercises('fullB', manual).every((item) => item.restSeconds >= 180));
  assert.equal(progression.getProgressionStatus('push', manual, []).current.step, 1, 'manual selection must not fake mastery');
  assert.equal(getWorkoutExercises('fullB', { ...beginner, planLevels: { hspu: 1, planche: 1 }, sessionMinutes: 60 }).some((item) => ['hspu', 'planche'].includes(item.category)), false, 'removed skill plans must not reappear in weight-loss courses');
});

test('all five time choices change workout content without silently shortening rest', () => {
    for (const experience of ['beginner', 'intermediate', 'advanced']) {
      const counts = [];
      for (const sessionMinutes of [20, 30, 45, 60, 75]) {
        const selected = { ...profile, experience, sessionMinutes, trainingRestSeconds: 120, planLevels: { squat: 5 } };
        const items = getWorkoutExercises('fullA', selected);
        const estimate = estimateStrengthSession(items, sessionMinutes);
        counts.push(items.length);
        assert.ok(items.every((item) => item.restSeconds >= 120), `${experience}/${sessionMinutes}: rest`);
        assert.ok(estimate.totalMinutes <= sessionMinutes, `${experience}/${sessionMinutes}: fit`);
      }
      assert.deepEqual(counts, [2, 3, 4, 5, 6], `${experience}: content should visibly vary`);
    }
  assert.equal(estimateStrengthSession([], 20).warmupSeconds, warmupDuration([]));
  assert.equal(estimateStrengthSession([], 75).warmupSeconds, warmupDuration([]));
});

test('weight-loss experience, frequency and time combinations stay within the default time budget', () => {
  const anchor = new Date(2026, 8, 23);
    for (const experience of ['beginner', 'intermediate', 'advanced']) {
      for (const frequency of [2, 3, 4, 5, 6]) {
        for (const sessionMinutes of [20, 30, 45, 60, 75]) {
          const selected = { ...profile, experience, frequency, sessionMinutes, trainingRestSeconds: 120, planLevels: { squat: 5 }, planStartedAt: anchor.toISOString() };
          const week = plans.getWeekSchedule(selected, anchor);
          assert.equal(week.filter((day) => day.type !== 'recovery').length, frequency);
          for (const day of week.filter((item) => item.type === 'strength')) {
            const cycle = plans.getPlanDay(selected, day.date).cycle;
            const items = getWorkoutExercises(day.workoutId, selected, cycle.setMultiplier, cycle.dupDay, cycle.week);
            const estimate = estimateStrengthSession(items, sessionMinutes);
            assert.ok(items.length >= 2, `${experience}/${frequency}/${sessionMinutes} should keep core movements`);
            assert.ok(estimate.totalMinutes <= sessionMinutes, `${experience}/${frequency}/${sessionMinutes}: ${estimate.totalMinutes}m`);
          }
        }
      }
    }
});

test('cardio target follows available time and short records stay partial', () => {
  const anchor = new Date(2026, 8, 23);
  const shortPlan = { ...profile, goal: 'weight_loss', frequency: 4, sessionMinutes: 20, planStartedAt: anchor.toISOString() };
  const longPlan = { ...shortPlan, sessionMinutes: 75 };
  const shortDay = plans.getWeekSchedule(shortPlan, anchor).find((day) => day.type === 'cardio');
  const longDay = plans.getWeekSchedule(longPlan, anchor).find((day) => day.type === 'cardio');
  assert.equal(shortDay.targetMinutes, 12);
  assert.equal(longDay.targetMinutes, 60);
  const completedAt = new Date(shortDay.date.getFullYear(), shortDay.date.getMonth(), shortDay.date.getDate(), 12).toISOString();
  const record = (durationSeconds) => ({ id: `${durationSeconds}`, kind: 'running', completedAt, durationSeconds, completion: 'complete' });
  assert.equal(getDayTrainingState(shortDay, [record(60)]).partial, true);
  assert.equal(getDayTrainingState(shortDay, [record(720)]).complete, true);
});

test('changing time preserves manually chosen intermediate action steps', () => {
  const existing = { ...profile, levels: { push: 1, pull: 1, squat: 1 }, planLevels: { push: 3, pull: 2, squat: 5 } };
  const draft = buildPlanDraft(existing, 4, 60, 'intermediate', 120, { push: false, pull: false, squat: true });
  assert.deepEqual(draft.planLevels, existing.planLevels);
  assert.equal(getWorkoutExercises('fullA', draft).find((item) => item.category === 'push').step, 3);
});

test('session estimate counts warmup, work, rest, transitions and cooldown', () => {
  const items = getWorkoutExercises('fullComprehensive', { ...profile, sessionMinutes: 30 });
  const estimate = estimateStrengthSession(items);
  assert.equal(estimate.totalSeconds, estimate.warmupSeconds + estimate.workSeconds + estimate.restSeconds + estimate.transitionsSeconds + estimate.cooldownSeconds);
  assert.ok(estimate.restSeconds > 0);
  assert.equal(estimate.totalMinutes, Math.ceil(estimate.totalSeconds / 60));
});

test('nutrition blocks restrictive targets for minors and low BMI', () => {
  assert.equal(calculateNutritionPlan({ ...profile, age: 16, nutritionGoal: 'rapid_loss' }, true).safetyLevel, 'blocked');
  assert.equal(calculateNutritionPlan({ ...profile, weight: 45, dietPattern: 'keto' }, false).safetyLevel, 'blocked');
});

test('nutrition day comparison uses the same personalized calorie targets shown for each day', () => {
  const training = calculateNutritionPlan({ ...profile, nutritionGoal: 'performance', frequency: 4 }, true);
  const recovery = calculateNutritionPlan({ ...profile, nutritionGoal: 'performance', frequency: 4 }, false);
  assert.equal(training.targetCalories, training.trainingDayCalories);
  assert.equal(recovery.targetCalories, recovery.restDayCalories);
  assert.equal(training.trainingDayCalories, recovery.trainingDayCalories);
  assert.equal(training.restDayCalories, recovery.restDayCalories);
  assert.ok(training.trainingDayCalories >= training.restDayCalories);
});

test('weight-loss energy uses a modest BMI and age-sensitive deficit with safety guards', () => {
  const base = { ...profile, goal: 'weight_loss', nutritionGoal: 'rapid_loss', dietPattern: 'balanced_cn', frequency: 4 };
  const nearNormal = calculateNutritionPlan(base, true);
  const higherBmi = calculateNutritionPlan({ ...base, weight: 105 }, true);
  const older = calculateNutritionPlan({ ...base, weight: 105, age: 65 }, true);
  const lean = calculateNutritionPlan({ ...base, weight: 65 }, true);
  assert.ok(nearNormal.weeklyMeanCalories <= nearNormal.tdee * 0.91 && nearNormal.weeklyMeanCalories >= nearNormal.tdee * 0.89);
  assert.ok(higherBmi.weeklyMeanCalories <= higherBmi.tdee * 0.83 && higherBmi.weeklyMeanCalories >= higherBmi.tdee * 0.81);
  assert.ok(older.weeklyMeanCalories >= older.tdee * 0.89);
  assert.equal(lean.goal, 'maintain');
  assert.equal(lean.safetyLevel, 'warning');
  assert.ok(higherBmi.protein >= 1.3 * higherBmi.referenceWeight);
  assert.ok(higherBmi.fat >= 0.6 * higherBmi.referenceWeight);
});

test('weight trend replaces same-day entries and waits for two reliable weeks', () => {
  const today = new Date(2026, 8, 24, 12);
  let history = [];
  for (let offset = 13; offset >= 0; offset--) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    history = recordWeight(history, offset >= 7 ? 80 : 79.6, date);
  }
  history = recordWeight(history, 79.5, today);
  assert.equal(history.length, 14);
  const trend = summarizeWeightTrend(history, today);
  assert.equal(trend.currentAverage, 79.6);
  assert.equal(trend.previousAverage, 80);
  assert.equal(trend.changeKg, -0.4);
  assert.equal(suggestedPlanningWeight(80, trend), 79.6);
  assert.equal(suggestedPlanningWeight(79.6, trend), null);
  assert.equal(summarizeWeightTrend(history.slice(-6), today).changeKg, undefined);
  assert.equal(suggestedPlanningWeight(80, summarizeWeightTrend(history.slice(-6), today)), null);
  assert.equal(suggestedPlanningWeight(80, { ...trend, changePercent: -1.1 }), null);
});

test('stage one uses adapted beginner recovery while other recovery schedules stay in place', () => {
  const anchor = new Date(2026, 8, 21, 12); // Monday
  const baseProfile = {
    ...profile,
    goal: 'street_mastery',
    nutritionGoal: 'performance',
    planStartedAt: anchor.toISOString(),
    levels: { push: 1, pull: 1, squat: 1, legRaise: 1, bridge: 1, hspu: 1 },
  };

  // 1. 阶段 I (初试身手 · 2练)
  const p1 = { ...baseProfile, frequency: 2, experience: 'beginner' };
  const week1 = plans.getWeekSchedule(p1, anchor);
  // Mon(1) & Fri(5) are strength
  assert.equal(week1[0].type, 'strength');
  assert.equal(week1[4].type, 'strength');
  // Tue(2) & Thu(4) are active recovery with prisoner_recovery_phase1
  assert.equal(week1[1].type, 'recovery');
  assert.equal(week1[1].workoutId, 'prisoner_recovery_phase1');
  assert.equal(week1[3].type, 'recovery');
  assert.equal(week1[3].workoutId, 'prisoner_recovery_phase1');
  // Wed(3), Sat(6), Sun(0) are complete rest
  assert.equal(week1[2].type, 'recovery');
  assert.equal(week1[2].workoutId, undefined);
  assert.equal(week1[5].type, 'recovery');
  assert.equal(week1[5].workoutId, undefined);
  assert.equal(week1[6].type, 'recovery');
  assert.equal(week1[6].workoutId, undefined);

  // Beginner recovery is an app adaptation, not the CC1 weekly book table.
  const p1Exercises = getWorkoutExercises('prisoner_recovery_phase1', p1);
  assert.equal(p1Exercises.length, 3);
  assert.deepEqual(p1Exercises.map((e) => e.id), ['recovery_shortBridge', 'recovery_bentHold', 'recovery_easyTwist']);
  assert.deepEqual(p1Exercises.map((e) => [e.targetSets, e.targetValue, e.targetUnit]), [[2, 10, 'seconds'], [4, 5, 'seconds'], [2, 10, 'seconds']]);

  // 2. 阶段 II (渐入佳境 · 3练)
  const p2 = { ...baseProfile, frequency: 3, experience: 'intermediate' };
  const week2 = plans.getWeekSchedule(p2, anchor);
  // Mon(1), Wed(3), Fri(5) are strength
  assert.equal(week2[0].type, 'strength');
  assert.equal(week2[2].type, 'strength');
  assert.equal(week2[4].type, 'strength');
  // Tue(2), Thu(4), Sat(6) are active recovery with prisoner_recovery_trifecta
  assert.equal(week2[1].workoutId, 'prisoner_recovery_trifecta');
  assert.equal(week2[3].workoutId, 'prisoner_recovery_trifecta');
  assert.equal(week2[5].workoutId, 'prisoner_recovery_trifecta');
  // Sun(0) is complete rest
  assert.equal(week2[6].workoutId, undefined);

  // Exercises for prisoner_recovery_trifecta: 2 sets each
  const p2Exercises = getWorkoutExercises('prisoner_recovery_trifecta', p2);
  assert.equal(p2Exercises.length, 4);
  assert.deepEqual(p2Exercises.map((e) => e.id), ['hang_01', 'trifecta_bridge', 'trifecta_lHold', 'trifecta_twist']);
  assert.ok(p2Exercises.every((e) => e.targetSets === 2));

  // 3. 阶段 III (炉火纯青 · 6练)
  const p3 = { ...baseProfile, frequency: 6, experience: 'advanced' };
  const week3 = plans.getWeekSchedule(p3, anchor);
  for (let i = 0; i < 6; i++) {
    assert.equal(week3[i].type, 'strength');
  }
  // Sun(0) is recovery with prisoner_recovery_trifecta
  assert.equal(week3[6].type, 'recovery');
  assert.equal(week3[6].workoutId, 'prisoner_recovery_trifecta');

  // 4. 阶段 IV (闭关修炼 · 6练)
  const p4 = { ...baseProfile, frequency: 6, experience: 'elite' };
  const week4 = plans.getWeekSchedule(p4, anchor);
  assert.equal(week4[6].type, 'recovery');
  assert.equal(week4[6].workoutId, 'prisoner_recovery_elite');
  const p4Exercises = getWorkoutExercises('prisoner_recovery_elite', p4);
  assert.equal(p4Exercises.length, 4);
  assert.ok(p4Exercises.every((e) => e.targetSets === 2));

  // 5. 阶段 V (登峰造极 · 6练)
  const p5 = { ...baseProfile, frequency: 6, experience: 'supermax' };
  const week5 = plans.getWeekSchedule(p5, anchor);
  assert.equal(week5[6].type, 'recovery');
  assert.equal(week5[6].workoutId, 'prisoner_recovery_elite');

  // 6. 恢复日打卡闭环测试
  const tuesday = week1[1]; // Tuesday of phase 1
  const session = {
    id: 'rec_sess_1',
    workoutId: tuesday.workoutId,
    workoutName: '初试身手 · 主动恢复与关节养护',
    completedAt: tuesday.date.toISOString(),
    durationSeconds: 600,
    completion: 'full',
  };
  const { getDayTrainingState } = require('../src/data/planProgress.ts');
  const stateBefore = getDayTrainingState(tuesday, []);
  assert.equal(stateBefore.complete, false);
  const stateAfter = getDayTrainingState(tuesday, [session]);
  assert.equal(stateAfter.complete, true);
});
