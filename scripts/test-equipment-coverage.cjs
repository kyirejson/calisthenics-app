const assert = require('node:assert/strict'), { test } = require('node:test');
const fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, f);
const { equipmentSessionPlan, equipmentReplacementIds, equipmentVolumeLedger, equipmentCoverage, equipmentProgressionSuggestion, EQUIPMENT_PLAN_ID } = require('../src/data/equipmentTraining.ts');
const { equipmentPlanReview } = require('../src/data/equipmentPlanReview.ts');
const { equipmentExecution } = require('../src/data/equipmentExecution.ts');
const { equipmentRecoveryAfterSet, equipmentTransitionSeconds } = require('../src/data/equipmentTimeline.ts');
const { getWeekSchedule } = require('../src/data/trainingPlans.ts');
const { getDayTrainingState, localDateKey } = require('../src/data/planProgress.ts');
const { getNutritionTrainingContext } = require('../src/nutrition/training.ts');
const start = new Date(2026, 9, 1, 12);
const profile = { name: 'QA', age: 30, sex: 'male', height: 175, weight: 75, goal: 'equipment', frequency: 6, equipmentSplit: 'ppl', experience: 'advanced', levels: {}, planStartedAt: start.toISOString(), planId: EQUIPMENT_PLAN_ID };
const id = 'equipment_v2_ppl_6_0';
test('replacement candidates preserve regional emphasis, function and direct contribution', () => {
  assert.ok(!equipmentReplacementIds('equipment_chest_07', profile).includes('equipment_chest_11'));
  assert.ok(!equipmentReplacementIds('equipment_legs_04', profile).includes('equipment_legs_16'));
  assert.ok(!equipmentReplacementIds('equipment_legs_06', profile).includes('equipment_legs_19'));
  assert.ok(!equipmentReplacementIds('equipment_arms_01', profile).includes('equipment_arms_06'));
  for (const course of equipmentPlanReview(profile, start).courses) for (const item of course.items) {
    const source = equipmentExecution(item.id);
    for (const replacement of equipmentReplacementIds(item.id, profile)) {
      const meta = equipmentExecution(replacement);
      assert.ok(source.regions.every(region => meta.regions.includes(region)));
      assert.ok(source.functions.every(fn => meta.functions.includes(fn)));
      assert.ok(source.direct.every(muscle => meta.direct.includes(muscle)));
      const p = { ...profile, equipmentMovementOverrides: { [course.workoutId]: { [item.id]: replacement } } };
      assert.equal(equipmentPlanReview(p, start).status, 'feasible', item.id + ' -> ' + replacement);
    }
  }
});
test('unsupported saved replacement, missing gear and duplicate replacement block saving', () => {
  const invalid = { ...profile, equipmentMovementOverrides: { equipment_v2_ppl_6_3: { equipment_chest_07: 'equipment_chest_11' } } };
  const review = equipmentPlanReview(invalid, start);
  assert.equal(review.status, 'infeasible'); assert.ok(review.coverage.regionDeficits.includes('chest_lower'));
  assert.equal(equipmentPlanReview({ ...profile, equipmentAvailableGear: [] }, start).status, 'infeasible');
  const duplicate = { ...profile, equipmentSplit: 'bro', frequency: 5, equipmentMovementOverrides: { equipment_v2_bro_5_2: { equipment_shoulders_01: 'equipment_shoulders_14' } } };
  assert.equal(equipmentPlanReview(duplicate, start).status, 'infeasible');
});
test('replacing unilateral RDL retains function, changes load units, and does not become a squat', () => {
  const p = { ...profile, equipmentMovementOverrides: { equipment_v2_ppl_6_5: { equipment_legs_04: 'equipment_legs_21' } } };
  const item = equipmentSessionPlan('equipment_v2_ppl_6_5', p).items.find(i => i.id === 'equipment_legs_21');
  assert.equal(item.perSide, true); assert.equal(item.loadBasis, 'per_hand');
  assert.equal(item.targetSets, 4);
  assert.equal(equipmentPlanReview(p, start).status, 'feasible');
});

test('a conflicting replacement never silently substitutes a different source row', () => {
  const id = 'equipment_v2_bro_5_4';
  const p = { ...profile, equipmentSplit: 'bro', frequency: 5,
    equipmentMovementOverrides: { [id]: { equipment_arms_08: 'equipment_arms_07' } } };
  const course = equipmentSessionPlan(id, p);
  assert.equal(course.status, 'infeasible');
  assert.ok(course.issues.some(issue => issue.includes('冲突')));
  assert.equal(course.items.find(item => item.equipmentSourceId === 'equipment_arms_07').id, 'equipment_arms_07');
  const reverse = equipmentSessionPlan(id, { ...p, equipmentMovementOverrides: { [id]: { equipment_arms_07: 'equipment_arms_08' } } });
  assert.equal(reverse.status, 'infeasible');
  assert.equal(reverse.items.find(item => item.equipmentSourceId === 'equipment_arms_08').id, 'equipment_arms_08');
  assert.equal(equipmentPlanReview({ ...p, equipmentMovementOverrides: {} }, start).status, 'feasible');
});

test('unknown directions, unknown functions and invalid doses fail closed', () => {
  const library = require('../src/data/equipmentLibrary.ts');
  const { trainingFunctionLabels } = require('../src/data/equipmentExecution.ts');
  const { equipmentFunctionTargets, equipmentRegionTargets } = require('../src/data/equipmentDosePolicy.ts');
  const all = equipmentPlanReview(profile, start).courses.flatMap(course => course.items);
  library.equipmentMuscleRegions.push({ key: 'new_untrained_region', label: '未配置测试', group: 'core' });
  trainingFunctionLabels.new_function = '未配置功能';
  try {
    const review = equipmentPlanReview(profile, start);
    assert.equal(review.status, 'infeasible');
    assert.ok(review.coverage.regionDeficits.includes('new_untrained_region'));
    assert.ok(review.coverage.functionDeficits.includes('new_function'));
    assert.ok(review.issues.some(issue => issue.includes('规则')));
  } finally {
    library.equipmentMuscleRegions.pop(); delete trainingFunctionLabels.new_function;
  }
  for (const targetSets of [NaN, Infinity, -1, 0, .5]) {
    const coverage = equipmentCoverage(all.map(item => ({ ...item, targetSets })));
    assert.ok(coverage.issues.length); assert.ok(coverage.regionDeficits.length); assert.ok(coverage.functionDeficits.length);
    const ledger = equipmentVolumeLedger([{ id: 'equipment_chest_03', targetSets }]);
    assert.equal(ledger.chest.direct, 0);
  }
  assert.ok(equipmentCoverage([{ id: 'unknown', targetSets: 3 }]).issues.length);
  const old = equipmentRegionTargets.chest_upper.sets;
  equipmentRegionTargets.chest_upper.sets = NaN;
  try { assert.equal(equipmentPlanReview(profile, start).status, 'infeasible'); }
  finally { equipmentRegionTargets.chest_upper.sets = old; }
  assert.ok(Object.values(equipmentFunctionTargets).every(value => Number.isInteger(value) && value > 0));
});

test('browsing emphasis changes cannot change training credit and standing calf trains soleus too', () => {
  const { equipmentFocus } = require('../src/data/equipmentLibrary.ts');
  const original = equipmentExecution('equipment_chest_03');
  const regions = equipmentFocus.equipment_chest_03.regions;
  equipmentFocus.equipment_chest_03.regions = ['shoulders_side'];
  try { assert.deepEqual(equipmentExecution('equipment_chest_03'), original); }
  finally { equipmentFocus.equipment_chest_03.regions = regions; }
  const ledger = equipmentVolumeLedger([{ id: 'equipment_legs_06', targetSets: 4 }]);
  assert.equal(ledger.gastrocnemius.direct, 4); assert.equal(ledger.soleus.direct, 4);
  const all = equipmentPlanReview(profile, start).courses.flatMap(course => course.items);
  const removedGrowth = equipmentCoverage(all.filter(item => item.id !== 'equipment_core_06'));
  assert.ok(removedGrowth.regionDeficits.includes('core_obliques'), 'Pallof control cannot replace oblique hypertrophy');
});

test('a course from another split or frequency is rejected', () => {
  assert.equal(equipmentSessionPlan('equipment_v2_ppl_6_0', { ...profile, equipmentSplit: 'bro', frequency: 5 }).status, 'infeasible');
});
test('control and stabilization never masquerade as hypertrophy sets or calf/core muscle credit', () => {
  const ledger = equipmentVolumeLedger([{ id: 'equipment_shoulders_15', targetSets: 2 }, { id: 'equipment_legs_04', targetSets: 4 }]);
  assert.equal(ledger.rotator.direct, 2); assert.equal(ledger.rotator.control, 2); assert.equal(ledger.rotator.estimated, 0);
  assert.equal(ledger.erectors.stabilizing, 4); assert.equal(ledger.erectors.direct, 0); assert.equal(ledger.erectors.estimated, 0);
  assert.equal(ledger.core.direct, 0);
  assert.equal(equipmentVolumeLedger([{ id: 'equipment_back_01', targetSets: 3 }]).rearDelts.indirect, 0);
});
test('one broad muscle cannot substitute for distinct chest, calf, core or cuff directions', () => {
  const all = equipmentPlanReview(profile, start).courses.flatMap(c => c.items);
  for (const [removed, region, fn] of [
    ['equipment_chest_07', 'chest_lower', 'lowerChest'],
    ['equipment_legs_11', 'legs_soleus', 'bentKneeCalf'],
    ['equipment_arms_22', 'arms_wrist_extensors', 'wristExtension'],
    ['equipment_shoulders_15', 'shoulders_rotator', 'externalRotation'],
    ['equipment_core_13', 'core_stability', 'antiExtension'],
  ]) {
    const review = equipmentCoverage(all.filter(item => item.id !== removed));
    assert.ok(review.functionDeficits.includes(fn), removed + ' function');
    if (!['equipment_core_13', 'equipment_legs_11'].includes(removed)) assert.ok(review.regionDeficits.includes(region), removed + ' region');
  }
});
test('actual course completion requires current revision, prescribed actions, set counts and load units', () => {
  const day = getWeekSchedule(profile, start)[0], plan = equipmentSessionPlan(day.workoutId, profile);
  const record = {
    id: 'record', workoutId: day.workoutId, kind: 'strength', completion: 'complete', durationSeconds: 3600, startedAt: start.toISOString(), trainingDate: localDateKey(start),
    planSnapshot: { schemaVersion: 4, revision: plan.revision, workoutId: plan.workoutId, targets: plan.items.map(i => ({ id: i.id, sets: i.targetSets, loadBasis: i.loadBasis, perSide: i.perSide })) },
    exercises: plan.items.map(item => ({ exerciseId: item.id, targetSnapshot: { loadBasis: item.loadBasis, perSide: item.perSide }, sets: Array.from({ length: item.targetSets }, () => ({ reps: item.repRange[0], loadKg: item.loadBasis === 'bodyweight' ? undefined : 20, completed: true })) })),
  };
  const state = r => getDayTrainingState(day, [r], [], plan);
  assert.equal(state(record).complete, true);
  assert.equal(state({ ...record, exercises: record.exercises.slice(0, 1) }).complete, false);
  assert.equal(state({ ...record, exercises: record.exercises.map((ex, i) => i ? ex : { ...ex, sets: ex.sets.slice(1) }) }).complete, false);
  assert.equal(state({ ...record, planSnapshot: { ...record.planSnapshot, revision: 'old' } }).complete, false);
  assert.equal(state({ ...record, planSnapshot: { ...record.planSnapshot, schemaVersion: 3 } }).complete, false);
  assert.equal(state({ ...record, completion: 'partial' }).complete, false);
  assert.equal(state({ ...record, planSnapshot: undefined }).complete, false);
  const changed = equipmentSessionPlan(day.workoutId, { ...profile, equipmentMovementOverrides: { [day.workoutId]: { equipment_chest_01: 'equipment_chest_19' } } });
  assert.equal(getDayTrainingState(day, [record], [], changed).complete, false);
  const nutritionProfile = { ...profile, equipmentMovementOverrides: { [day.workoutId]: { equipment_chest_01: 'equipment_chest_19' } } };
  assert.equal(getNutritionTrainingContext(nutritionProfile, [record], {}, '2026-10-01').status, 'partial');
});
test('snapshot ownership, replacement units and recovery timeline stay coherent', () => {
  const plan = equipmentSessionPlan(id, profile), original = JSON.stringify(plan);
  equipmentSessionPlan(id, { ...profile, equipmentAvailableGear: [] });
  assert.equal(JSON.stringify(plan), original);
  const states = Object.fromEntries(plan.items.map(item => [item.id, Array(item.targetSets).fill(false)]));
  for (let index = 0; index < plan.items.length; index++) {
    const item = plan.items[index]; states[item.id].fill(true);
    const recovery = equipmentRecoveryAfterSet(plan.items, states, item.id);
    assert.equal(recovery.seconds, equipmentTransitionSeconds(item, plan.items[index + 1]));
  }
  const unilateralPlan = equipmentSessionPlan('equipment_v2_ppl_6_1', profile);
  const oneSide = unilateralPlan.items.find(i => i.perSide);
  assert.ok(oneSide); assert.ok(unilateralPlan.estimate.events.some(e => e.kind === 'side_switch' && e.exerciseId === oneSide.id));
});
test('optional progression still requires two comparable completed sessions rather than plan presence', () => {
  const item = equipmentSessionPlan(id, profile).items.find(i => i.loadBasis === 'per_hand');
  // A fixed clock keeps the two samples exactly one day apart even under load.
  const anchor = Date.now() - 172800000;
  const make = (key, offset = 0) => ({ id: key, startedAt: new Date(anchor - offset).toISOString(), completedAt: new Date(anchor - offset).toISOString(), quality: 'solid', completion: 'complete', exercises: [{ exerciseId: item.id, targetSnapshot: { loadBasis: item.loadBasis }, sets: Array.from({ length: item.targetSets }, () => ({ completed: true, reps: item.repRange[1], loadKg: 10, rir: 2 })) }] });
  assert.equal(equipmentProgressionSuggestion(item, [make('one')]), '');
  assert.ok(equipmentProgressionSuggestion(item, [make('one'), make('two', 86400000)]));
  assert.equal(equipmentProgressionSuggestion(item, [make('one'), { ...make('two', 86400000), quality: 'pain' }]), '');
});
