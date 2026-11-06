const { test } = require('node:test');
const assert = require('node:assert/strict');
const { repositoryHarness } = require('./lib/app-repository-harness.cjs');
const { applyTrainingVolume, editedTrainingVolume } = require('../src/domain/training/trainingVolume.ts');
const { restoreCourseSets } = require('../src/domain/training/sessionResume.ts');
const { getWorkoutExercises } = require('../src/domain/training/catalog.ts');
const profile = { name: 'QA', age: 30, height: 175, weight: 75, sex: 'male', goal: 'street_mastery', frequency: 3, levels: {}, experience: 'beginner' };
const squat = { id: 'squat_05', targetSets: 3, targetValue: 10, targetUnit: 'reps' };

test('explicit per-set targets survive profile reload and seed a fresh workout without completion flags', async () => {
  const h = repositoryHarness({ initial: { user_profile: JSON.stringify(profile) } }); await h.load();
  let volume = editedTrainingVolume(squat, undefined, 4, { index: 0, value: 15 });
  volume = editedTrainingVolume(squat, volume, 4, { index: 1, value: 20 });
  await h.store().patchProfile({ trainingVolumes: { squat_05: volume } });
  const reloaded = repositoryHarness({ initial: Object.fromEntries(h.disk) }); await reloaded.load();
  const item = applyTrainingVolume(squat, reloaded.store().profile);
  assert.equal(item.targetSets, 4);
  assert.deepEqual(restoreCourseSets([item]).squat_05.map(set => [set.reps, set.completed]), [['15', false], ['20', false], ['10', false], ['10', false]]);
  assert.equal(applyTrainingVolume({ ...squat, id: 'squat_06' }, reloaded.store().profile).targetSets, 3);
  assert.equal(applyTrainingVolume({ ...squat, targetUnit: 'seconds' }, reloaded.store().profile).targetSets, 3);
});

test('daily prescription uses the saved volume after template fitting, even on a different day', async () => {
  const h = repositoryHarness({ initial: { user_profile: JSON.stringify(profile) } }); await h.load();
  const p = h.store().profile;
  const original = getWorkoutExercises('prisonerB', p);
  assert.ok(original.length);
  const selected = original[0];
  const remembered = { ...p, trainingVolumes: { [selected.id]: { unit: selected.targetUnit, values: [15, 20, 25, 30] } } };
  const next = getWorkoutExercises('prisonerB', remembered, .5, undefined, 2, { date: new Date('2026-11-10T12:00:00') });
  assert.deepEqual(next.find(item => item.id === selected.id).setTargets, [15, 20, 25, 30]);
  assert.equal(next.find(item => item.id === selected.id).targetSets, 4);
});

test('hold targets and reduced groups persist; changing group count does not infer actual completed volume', () => {
  const hold = { ...squat, id: 'hold', targetUnit: 'seconds', targetValue: 30 };
  const volume = editedTrainingVolume(hold, undefined, 2, { index: 1, value: 45 });
  assert.deepEqual(restoreCourseSets([applyTrainingVolume(hold, { trainingVolumes: { hold: volume } })]).hold.map(row => row.reps), ['30', '45']);
  assert.deepEqual(editedTrainingVolume(squat, { unit: 'reps', values: [15, 20, 25] }, 2).values, [15, 20]);
  assert.deepEqual(editedTrainingVolume(squat, { unit: 'reps', values: [15, 20] }, 3).values, [15, 20, 10]);
});
