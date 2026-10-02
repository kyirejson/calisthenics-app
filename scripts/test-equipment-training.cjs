const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, f);
const training = require('../src/data/equipmentTraining.ts');
const { equipmentPlanReview } = require('../src/data/equipmentPlanReview.ts');
const { equipmentExecution } = require('../src/data/equipmentExecution.ts');
const { equipmentMovements } = require('../src/data/equipment.ts');
const { getWeekSchedule, getPlanDay } = require('../src/data/trainingPlans.ts');
const { getWorkoutExercises } = require('../src/data/catalog.ts');
const { estimateEquipmentSession } = require('../src/data/equipmentTimeline.ts');
const { getWarmupActions } = require('../src/data/trainingWarmup.ts');
const { cleanSession, normalizeTrainingSessions } = require('../src/data/sessionRecords.ts');
const { compareWithPrevious } = require('../src/data/trainingHistory.ts');
const start = new Date(2026, 9, 1, 12);
const profile = { name: 'QA', age: 30, sex: 'male', height: 175, weight: 75, goal: 'equipment', frequency: 6, equipmentSplit: 'ppl', experience: 'advanced', levels: {}, planStartedAt: start.toISOString(), planId: training.EQUIPMENT_PLAN_ID };
test('split boundaries remove only unsupported split structures, preserving low-frequency consolidation', () => {
  assert.deepEqual(training.equipmentSplitFrequencies, { bro: [5, 6], ppl: [3, 4, 5, 6], upper_lower: [2, 3, 4, 5, 6] });
  assert.equal(training.equipmentFrequency(2, 'bro'), 5);
  assert.equal(training.equipmentFrequency(1, 'ppl'), 3);
  assert.equal(training.equipmentFrequency(2, 'upper_lower'), 2);
  assert.equal(training.equipmentSplitConfig({ frequency: 3, equipmentSplit: 'balanced' }), 'upper_lower');
  assert.equal(training.equipmentSplitConfig({ frequency: 5 }), 'bro');
  assert.equal(training.EQUIPMENT_PLAN_ID, 'equipment_training_v2');
});
for (const [split, frequencies] of Object.entries(training.equipmentSplitFrequencies)) for (const frequency of frequencies) {
  test(split + '/' + frequency + ' has a complete, stable weekly prescription in every one of 12 weeks', () => {
    const p = { ...profile, equipmentSplit: split, frequency };
    const review = equipmentPlanReview(p, start);
    assert.equal(review.status, 'feasible', review.issues.join(';'));
    let signature;
    for (let index = 0; index < 12; index++) {
      const anchor = new Date(start); anchor.setDate(anchor.getDate() + index * 7);
      const week = equipmentPlanReview(p, anchor);
      assert.equal(week.courses.length, frequency);
      assert.deepEqual(week.deficits, []);
      assert.deepEqual(week.coverage.regionDeficits, []);
      assert.deepEqual(week.coverage.functionDeficits, []);
      assert.equal(Object.keys(week.coverage.regions).length, 28);
      assert.equal(new Set(week.courses.map(course => course.workoutId)).size, frequency);
      const current = week.courses.map(course => [course.workoutId, course.revision]);
      if (signature) assert.deepEqual(current, signature); else signature = current;
      for (const course of week.courses) {
        assert.equal(course.schemaVersion, 4); assert.equal(course.status, 'feasible');
        assert.equal(course.budgetSeconds, undefined); assert.equal(course.spec, undefined);
        assert.equal(new Set(course.items.map(item => item.id)).size, course.items.length);
        assert.ok(course.items.length);
        assert.deepEqual(course.estimate, estimateEquipmentSession(course.items));
        assert.equal(course.estimate.totalSeconds, course.estimate.events.reduce((sum, event) => sum + event.seconds, 0));
        assert.deepEqual(getWorkoutExercises(course.workoutId, p, 1, undefined, undefined, { date: week.date }), course.items);
        for (const item of course.items) {
          assert.ok(item.guide?.setup); assert.ok(item.targetSets > 0); assert.ok(item.repRange[0] > 0);
          assert.equal(item.perSide, equipmentExecution(item.id).unilateral);
          assert.ok(item.loadBasis); assert.ok(item.restSeconds >= 60);
        }
      }
    }
  });
}
test('all split/frequency options allocate the same declarative weekly movement bank', () => {
  let reference;
  for (const [split, frequencies] of Object.entries(training.equipmentSplitFrequencies)) for (const frequency of frequencies) {
    const p = { ...profile, equipmentSplit: split, frequency };
    const items = equipmentPlanReview(p, start).courses.flatMap(c => c.items);
    const sums = {};
    for (const item of items) sums[item.id] = (sums[item.id] || 0) + item.targetSets;
    if (reference) assert.deepEqual(sums, reference); else reference = sums;
    const expected = require('../src/data/equipmentDosePolicy.ts').equipmentWeeklyUnits.flatMap(unit => unit.doses);
    assert.equal(Object.values(sums).reduce((a, b) => a + b, 0), expected.reduce((sum, dose) => sum + dose.sets, 0));
  }
});
test('lower frequency increases single-session work without dropping or postponing weekly content', () => {
  const review = (split, frequency) => equipmentPlanReview({ ...profile, equipmentSplit: split, frequency }, start);
  const peak = r => Math.max(...r.courses.map(c => c.items.reduce((s, i) => s + i.targetSets, 0)));
  assert.ok(peak(review('upper_lower', 2)) > peak(review('upper_lower', 6)));
  assert.ok(peak(review('ppl', 3)) > peak(review('ppl', 6)));
  assert.ok(review('upper_lower', 2).courses[0].items.some(i => i.targetSets > 4), 'merging is not capped at the old four-set row limit');
  assert.ok(!review('bro', 6).courses.some(c => /轻量/.test(c.title)));
});
test('custom weekdays retain exact frequency and plan-week anchoring for a whole year', () => {
  const p = { ...profile, frequency: 4, equipmentTrainingDays: [0, 2, 4, 6] };
  for (let week = 0; week < 52; week++) {
    const at = new Date(start); at.setDate(at.getDate() + week * 7);
    const days = getWeekSchedule(p, at).filter(day => day.workoutId);
    assert.deepEqual(days.map(day => day.date.getDay()).sort(), [0, 2, 4, 6]);
    assert.equal(days.length, 4);
    for (const day of days) assert.equal(training.equipmentSessionPlan(day.workoutId, p, day.date).status, 'feasible');
  }
  assert.equal(training.equipmentTrainingDays({ ...p, equipmentTrainingDays: [1, 1, 99] }).length, 4);
  assert.equal(getPlanDay(p, new Date(2026, 8, 30, 12)).day.workoutId, undefined);
});
test('all catalog mechanics are recognized and unknown actions never become core', () => {
  for (const movement of equipmentMovements) assert.notEqual(equipmentExecution(movement.id).pattern, 'other', movement.id);
  assert.deepEqual(equipmentExecution('unknown').direct, []);
  assert.equal(equipmentExecution('equipment_legs_19').pattern, 'knee');
  assert.equal(equipmentExecution('equipment_legs_16').pattern, 'knee');
  assert.equal(equipmentExecution('equipment_legs_21').unilateral, true);
  assert.deepEqual(equipmentExecution('equipment_legs_21').direct, ['hamstrings', 'glutes']);
  for (const id of ['shoulders_15', 'shoulders_17', 'legs_09', 'legs_20', 'legs_22', 'arms_12']) assert.ok(!equipmentExecution('equipment_' + id).direct.includes('core'));
});
test('all historical time/experience fields cannot reduce or enlarge this trained-lifter prescription', () => {
  const id = training.equipmentWorkoutId(profile, 0), original = training.equipmentSessionPlan(id, profile);
  for (const spec of ['mini', 'light', 'standard', 'pro', 'ultra']) for (const sessionMinutes of [1, 20, 60, 300]) {
    assert.deepEqual(training.equipmentSessionPlan(id, { ...profile, equipmentSpec: spec, sessionMinutes, experience: 'beginner' }), original);
  }
  for (const priority of ['chest', 'back', 'shoulders', 'legs', 'arms', 'core']) {
    const items = training.equipmentSessionPlan(id, { ...profile, equipmentPriority: priority }).items;
    assert.deepEqual(items.map(i => [i.id, i.targetSets]).sort(), original.items.map(i => [i.id, i.targetSets]).sort());
  }
});
test('retired course IDs cannot start a live old planner; stored history stays readable', () => {
  assert.equal(training.equipmentSessionPlan('equipment_bro_1_0', profile).status, 'infeasible');
  assert.deepEqual(training.equipmentWorkoutItems('equipment_3_0', profile), []);
  const old = { id: 'old', workoutId: 'equipment_3_0', workoutName: '历史课程', startedAt: start.toISOString(), exercises: [{ exerciseId: 'equipment_chest_03', sets: [{ reps: 8, completed: true, loadKg: 30 }] }], planSnapshot: { schemaVersion: 2, spec: 'pro', budgetSeconds: 3600, revision: 'old' } };
  assert.deepEqual(cleanSession(old).planSnapshot, old.planSnapshot);
  assert.equal(normalizeTrainingSessions([old]).length, 1);
});
test('equipment warmups use actual course actions and never contribute to work-set totals', () => {
  const items = training.equipmentSessionPlan(training.equipmentWorkoutId(profile, 0), profile).items;
  const actions = getWarmupActions(items);
  assert.equal(actions.filter(a => a.exercise).length, items.length);
  assert.ok(actions.filter(a => a.exercise).every(a => items.some(i => i.id === a.exercise.id)));
});
test('checked records preserve load, optional actual effort, single-side units and historical comparison limits', () => {
  const session = { id: 'qa', kind: 'strength', startedAt: start.toISOString(), exercises: [{ exerciseId: 'equipment_shoulders_15', targetSnapshot: { perSide: true, loadBasis: 'machine' }, sets: [{ reps: 12, completed: true, loadKg: 5 }, { reps: 15, completed: false, loadKg: 7.5 }] }] };
  const cleaned = cleanSession(session);
  assert.equal(cleaned.exercises[0].sets.length, 1); assert.equal(cleaned.totalReps, 24); assert.equal(cleaned.exercises[0].sets[0].rir, undefined);
  const make = (id, reps, loadKg) => ({ id, kind: 'strength', workoutId: training.equipmentWorkoutId(profile, 0), startedAt: start.toISOString(), completedAt: start.toISOString(), exercises: [{ exerciseId: 'equipment_chest_03', name: '推胸', sets: [{ reps, completed: true, loadKg, unit: 'reps' }] }] });
  const old = make('old', 8, 40), current = make('current', 12, 20);
  assert.equal(compareWithPrevious(current, [old, current], new Date(2026, 9, 16))[0].delta, null);
});
