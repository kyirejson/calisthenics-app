const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
for (const ext of ['.png', '.jpeg', '.jpg']) require.extensions[ext] = (module, filename) => { module.exports = filename; };
const { exercises, categories, selectExercise, getWorkoutExercises } = require('../src/data/catalog.ts');
const { getProgressionStatus, getProgressionStageState, getAllProgressionStatuses, getFinalFormProgress, applyProgressionUnlock, progressionGroups, progressionSeries } = require('../src/data/progression.ts');
const { getExerciseArtwork, rejectedArtwork } = require('../src/data/exerciseArtwork.ts');
const { getOriginalActionFrames, getOriginalActionImage } = require('../src/data/originalResources.ts');
const { originalTexts } = require('../src/data/private/originalTexts.ts');
const { originalImageMap } = require('../src/data/private/imageMap.ts');
const privateBookTest = { skip: Object.keys(originalTexts).length === 0 || Object.keys(originalImageMap).length === 0 ? 'Private book resources are not distributed in public checkouts' : false };
const { loadedImageDimensions } = require('../src/utils/imageDimensions.ts');
const { getSubjectFrame, fitSubjectFrame, photoAspect } = require('../src/utils/exerciseFraming.ts');
const profile = { levels: { push: 5 }, planLevels: { push: 5 } };
const now = new Date('2026-09-28T12:00:00Z');
function exam(id, at, key = 'push', selected = profile) {
  const status = getProgressionStatus(key, selected, [], now), criteria = status.criteria;
  return { id, kind: 'strength', workoutId: 'single_' + status.current.id, startedAt: at, completedAt: at, completion: 'complete', quality: 'solid',
    exercises: [{ exerciseId: status.current.id, name: status.current.name, constraintsConfirmed: true,
      sets: Array.from({ length: criteria.sets }, () => ({ completed: true, reps: criteria.value, unit: criteria.unit })) }] };
}
const exams = () => [exam('a', '2026-09-25T10:00:00Z'), exam('b', '2026-09-27T10:00:00Z')];

test('removed module cannot reappear in routes, search catalogue, progress or daily extras', () => {
  const removedCategories = ['front_lever', 'planche', 'back_lever', 'muscle_up', 'l_sit', 'human_flag'];
  assert.deepEqual(progressionGroups.map(group => group.key), ['六艺基础', '关节与支援', '爆发六功']);
  assert.equal(categories.some(category => category.key === 'skills'), false);
  assert.equal(exercises.some(exercise => removedCategories.includes(exercise.category)), false);
  const saved = { ...profile, goal: 'street_mastery', levels: { push: 5, ...Object.fromEntries(removedCategories.map(key => [key, 100])) } };
  assert.deepEqual(getFinalFormProgress(getAllProgressionStatuses(saved, [])), { unlocked: 0, total: 17, percent: 0 });
  for (const key of removedCategories) {
    assert.equal(progressionSeries.some(series => series.key === key), false);
    assert.equal(getProgressionStatus(key, saved, []), null);
    assert.equal(selectExercise(key, saved), undefined);
  }
  assert.deepEqual(getWorkoutExercises('custom_daily', saved, 1, undefined, 1, { addedExerciseIds: ['fl_01', 'pl_01', 'bl_01', 'mu_01', 'ls_01', 'hf_01'] }), []);
  for (const key of ['flag_clutch', 'flag_press', 'trifecta', 'power_pull']) assert.ok(getProgressionStatus(key, saved, []), key);
});

test('manual high-step selection passes earlier levels without invented exams or records', () => {
  const sessions = [], selected = { levels: { push: 8 }, planLevels: { push: 8 } };
  const before = JSON.stringify({ selected, sessions });
  const status = getProgressionStatus('push', selected, sessions, now);
  assert.deepEqual(Array.from({ length: 10 }, (_, index) => getProgressionStageState(status, index)), [
    'passed', 'passed', 'passed', 'passed', 'passed', 'passed', 'passed', 'current', 'upcoming', 'upcoming',
  ]);
  assert.equal(status.current.id, 'push_08');
  assert.equal(status.qualifiedSessions, 0);
  assert.equal(status.eligible, false);
  assert.equal(JSON.stringify({ selected, sessions }), before);
});
test('choosing a core extension acknowledges the core final, not a new final', () => {
  const statuses = getAllProgressionStatuses({ levels: { push: 16 } }, []);
  assert.deepEqual(getFinalFormProgress(statuses), { unlocked: 1, total: 17, percent: 6 });
  const status = statuses.find(item => item.series.key === 'push');
  assert.equal(status.current.id, 'push_10');
  assert.equal(status.complete, true);
  assert.equal(getProgressionStageState(status, 9), 'passed');
});
test('selecting the final itself still leaves its own verification pending', () => {
  const status = getProgressionStatus('push', { levels: { push: 10 } }, [], now);
  assert.equal(status.complete, false);
  assert.equal(getProgressionStageState(status, 8), 'passed');
  assert.equal(getProgressionStageState(status, 9), 'current');
});
test('plan-only choice does not silently change the separate current-level field', () => {
  assert.equal(getProgressionStatus('push', { levels: { push: 1 }, planLevels: { push: 8 } }, [], now).current.id, 'push_01');
});
test('invalid level values are safe and cannot forge final completion', () => {
  for (const level of [NaN, Infinity, -1, 0, 5.5, '8']) {
    const status = getProgressionStatus('push', { levels: { push: level } }, [], now);
    assert.equal(status.level, 1); assert.equal(status.complete, false);
  }
});
test('real spaced completed exams still qualify', () => {
  assert.equal(getProgressionStatus('push', profile, exams(), now).eligible, true);
});
test('same-day exams never become two spaced successes', () => {
  assert.equal(getProgressionStatus('push', profile, [exam('a', '2026-09-27T09:00:00Z'), exam('b', '2026-09-27T11:00:00Z')], now).qualifiedSessions, 1);
});
test('duplicate record IDs cannot manufacture two exam successes', () => {
  const records = exams(); records[1].id = records[0].id;
  assert.equal(getProgressionStatus('push', profile, records, now).qualifiedSessions, 1);
});
test('future or malformed record times are not qualifying evidence', () => {
  for (const at of ['2099-01-01T00:00:00Z', 'not-a-date']) {
    const records = exams(); records[1].completedAt = at;
    assert.equal(getProgressionStatus('push', profile, records, now).eligible, false);
  }
});
test('completed-before-start and future checked-set times are not qualifying evidence', () => {
  const records = exams(); records[1].startedAt = '2026-09-27T12:00:00Z';
  assert.equal(getProgressionStatus('push', profile, records, now).eligible, false);
  const futureSet = exams(); futureSet[1].exercises[0].sets.forEach(set => { set.completedAt = '2099-01-01T00:00:00Z'; });
  assert.equal(getProgressionStatus('push', profile, futureSet, now).eligible, false);
});
test('unchecked, infinite, fractional, zero or wrong-unit sets cannot pass an exam', () => {
  for (const patch of [{ completed: false }, { reps: Infinity }, { reps: 100.5 }, { reps: 0 }, { unit: 'seconds' }]) {
    const records = exams(); records[1].exercises[0].sets.forEach(set => Object.assign(set, patch));
    assert.equal(getProgressionStatus('push', profile, records, now).eligible, false);
  }
});
test('a seconds action never infers seconds from untyped legacy repetition counts', () => {
  const selected = { levels: { hspu: 1 } };
  const records = [exam('a', '2026-09-25T10:00:00Z', 'hspu', selected), exam('b', '2026-09-27T10:00:00Z', 'hspu', selected)];
  records.forEach(record => record.exercises[0].sets.forEach(set => { delete set.unit; }));
  assert.equal(getProgressionStatus('hspu', selected, records, now).eligible, false);
  records.forEach(record => { record.exercises[0].targetSnapshot = { unit: 'seconds' }; });
  assert.equal(getProgressionStatus('hspu', selected, records, now).eligible, true);
});
test('partial, unknown completion and painful feedback are not completed exam passes', () => {
  for (const patch of [{ completion: 'partial' }, { completion: undefined }, { quality: 'pain' }, { quality: undefined }]) {
    const records = exams(); Object.assign(records[1], patch);
    assert.equal(getProgressionStatus('push', profile, records, now).eligible, false);
  }
});
test('corrupted null exercise / set entries and non-boolean checks do not crash or pass', () => {
  for (const patch of ['null-exercise', 'null-sets', 'string-check']) {
    const records = exams();
    if (patch === 'null-exercise') records[1].exercises = [null];
    else if (patch === 'null-sets') records[1].exercises[0].sets = [null, null];
    else records[1].exercises[0].sets.forEach(set => { set.completed = 'true'; });
    assert.equal(getProgressionStatus('push', profile, records, now).eligible, false);
  }
});
test('manual exam confirmation must be the actual boolean true, not a truthy import value', () => {
  const selected = { levels: { push: 8 } };
  for (const confirmation of ['true', 1]) {
    const records = [exam('a', '2026-09-25T10:00:00Z', 'push', selected), exam('b', '2026-09-27T10:00:00Z', 'push', selected)];
    records[1].exercises[0].constraintsConfirmed = confirmation;
    assert.equal(getProgressionStatus('push', selected, records, now).eligible, false);
  }
});
test('multiple-action workouts and ordinary lessons do not impersonate a single-action exam', () => {
  const records = exams(); records[1].workoutId = 'prisonerA';
  assert.equal(getProgressionStatus('push', profile, records, now).eligible, false);
  const multiple = exams(); multiple[1].exercises.push(multiple[1].exercises[0]);
  assert.equal(getProgressionStatus('push', profile, multiple, now).eligible, false);
});
test('unilateral/manual conditions still require the user confirmation', () => {
  const selected = { levels: { push: 8 } };
  const records = [exam('a', '2026-09-25T10:00:00Z', 'push', selected), exam('b', '2026-09-27T10:00:00Z', 'push', selected)];
  delete records[1].exercises[0].constraintsConfirmed;
  assert.equal(getProgressionStatus('push', selected, records, now).eligible, false);
});
test('a valid confirm advances once; stale or unqualified confirms cannot overwrite manual selection', () => {
  const status = getProgressionStatus('push', profile, exams(), now);
  const updated = applyProgressionUnlock(profile, status);
  assert.equal(updated.levels.push, 6); assert.equal(updated.planLevels.push, 6);
  assert.equal(applyProgressionUnlock(updated, status), updated);
  const chosen = { ...profile, levels: { push: 8 }, planLevels: { push: 8 } };
  assert.equal(applyProgressionUnlock(chosen, status), chosen);
  const pending = getProgressionStatus('push', profile, [], now);
  assert.equal(applyProgressionUnlock(profile, pending), profile);
});
test('a deliberately different planned variant is preserved on recorded advancement', () => {
  const selected = { ...profile, planLevels: { push: 8 } };
  const result = applyProgressionUnlock(selected, getProgressionStatus('push', selected, exams(), now));
  assert.equal(result.levels.push, 6); assert.equal(result.planLevels.push, 8);
});
test('all explicitly rejected pictures are absent from the rendering resolver', () => {
  assert.equal(Object.keys(rejectedArtwork).length, 12);
  for (const id of Object.keys(rejectedArtwork)) {
    const artwork = getExerciseArtwork(exercises.find(exercise => exercise.id === id));
    assert.equal(artwork.cover, undefined, id); assert.deepEqual(artwork.frames, [], id); assert.ok(artwork.missingReason);
  }
});
test('replaced photos use the reviewed sources, not a different movement', privateBookTest, () => {
  for (const [id, filename] of [['legRaise_demon_05', 'image00653.jpeg']]) {
    const artwork = getExerciseArtwork(exercises.find(exercise => exercise.id === id));
    assert.equal(path.basename(artwork.cover.source), filename);
  }
});
test('the final banner is never presented as an action frame', privateBookTest, () => {
  for (const key of ['push', 'pull', 'squat', 'legRaise', 'bridge', 'hspu']) {
    const frames = getOriginalActionFrames(key + '_10');
    assert.ok(frames.length >= 2); assert.ok(frames.every(frame => frame.key !== 'image00568.jpeg'));
  }
});
test('a filtered banner or later chapter example cannot return through the cover fallback', () => {
  const id = '__artwork_banner_fixture';
  originalTexts[id] = { title: '封面过滤验证', kind: 'book', scope: 'section', sourceFile: null,
    primaryImageName: 'image00568.jpeg', markdown: '![[image00568.jpeg]]\n### 更上一层\n![[image00558.jpeg]]' };
  try {
    assert.deepEqual(getOriginalActionFrames(id), []);
    assert.equal(getOriginalActionImage(id), undefined);
  } finally { delete originalTexts[id]; }
});
test('a mini-program supplemental picture never claims to be an original book photo', privateBookTest, () => {
  const id = '__artwork_supplement_fixture';
  originalTexts[id] = { title: '补充来源验证', kind: 'mini_program', scope: 'supplement', sourceFile: null,
    primaryImageName: 'image00558.jpeg', markdown: '补充资料' };
  try {
    const artwork = getExerciseArtwork({ id });
    assert.equal(artwork.cover.kind, 'reference');
    assert.equal(artwork.cover.caption, '补充资料配图');
  } finally { delete originalTexts[id]; }
});
test('book figures remain separate files and the cover matches the distinguishing action phase', privateBookTest, () => {
  const artwork = getExerciseArtwork(exercises.find(exercise => exercise.id === 'bridge_06'));
  assert.equal(path.basename(artwork.cover.source), 'image00670.jpeg');
  assert.deepEqual(artwork.frames.map(frame => frame.key), ['image00669.jpeg', 'image00670.jpeg']);
  assert.equal(new Set(artwork.frames.map(frame => frame.source)).size, 2);
});
test('flying pushup stages and different kip stages no longer use identical generic start covers', privateBookTest, () => {
  const covers = ids => ids.map(id => fs.readFileSync(getExerciseArtwork(exercises.find(exercise => exercise.id === id)).cover.source).toString('base64'));
  assert.equal(new Set(covers(['pPush_08', 'pPush_10'])).size, 2);
  assert.equal(new Set(covers(['pKip_05', 'pKip_06', 'pKip_07'])).size, 3);
});
test('generated supplemental demos remain honest metadata and one photo each', () => {
  for (const id of ['neck_handResistance', 'aux_singleLegCalf']) {
    const artwork = getExerciseArtwork(exercises.find(exercise => exercise.id === id));
    assert.equal(artwork.frames.length, 1); assert.equal(artwork.cover.kind, 'generated');
  }
});
test('the progression screen has no old after-the-list verification card or forced exam inference', () => {
  const ui = fs.readFileSync(path.join(__dirname, '../src/screens/ProgressScreen.tsx'), 'utf8');
  assert.match(ui, /getProgressionStageState/); assert.match(ui, /<ExerciseMedia/);
  const media = fs.readFileSync(path.join(__dirname, '../src/components/ExerciseResource.tsx'), 'utf8');
  assert.match(media, /framing=\{framing\} resizeMode="contain"/);
  assert.match(ui, /ProgressionArtworkViewer/); assert.match(ui, /useRouteReveal/);
  assert.ok(!ui.includes('ProgressBar')); assert.ok(!ui.includes('styles.percentBadge')); assert.ok(!ui.includes('AI 示范'));
});
test('image dimensions support both native and real RN Web load callbacks', () => {
  assert.deepEqual(loadedImageDimensions({ nativeEvent: { source: { width: 800, height: 600 } } }), { width: 800, height: 600 });
  assert.deepEqual(loadedImageDimensions({ nativeEvent: { target: { naturalWidth: 1200, naturalHeight: 900 } } }), { width: 1200, height: 900 });
  assert.deepEqual(loadedImageDimensions({}, { width: 720, height: 1280 }), { width: 720, height: 1280 });
});
test('missing or invalid load dimensions never throw or invent an aspect ratio', () => {
  for (const event of [null, {}, { nativeEvent: {} }, { nativeEvent: { source: { width: 0, height: 1 } } }, { nativeEvent: { source: { width: Infinity, height: 1 } } }]) assert.equal(loadedImageDimensions(event), undefined);
});

test('all sixty core cover crops are reviewed, normalized and fitted without stretching', privateBookTest, () => {
  const seen = new Set();
  for (const key of ['push', 'pull', 'squat', 'legRaise', 'bridge', 'hspu']) for (let level = 1; level <= 10; level++) {
    const id = `${key}_${String(level).padStart(2, '0')}`;
    const cover = getExerciseArtwork(exercises.find(exercise => exercise.id === id)).cover;
    const frame = getSubjectFrame(cover.key);
    assert.ok(frame, id); seen.add(cover.key);
    assert.ok(frame.x >= 0 && frame.y >= 0 && frame.width > 0 && frame.height > 0, id);
    assert.ok(frame.x + frame.width <= 1.000001 && frame.y + frame.height <= 1.000001, id);
    assert.ok(frame.sourceWidth > 0 && frame.sourceHeight > 0);
    for (const [boxWidth, boxHeight] of [[82, 56], [104, 126], [288, 190], [408, 290]]) {
      const fitted = fitSubjectFrame(frame, boxWidth, boxHeight);
      assert.ok(Object.values(fitted).every(Number.isFinite));
      assert.ok(Math.abs(fitted.width / fitted.height - frame.sourceWidth / frame.sourceHeight) < 1e-10);
      const left = fitted.left + frame.x * fitted.width, top = fitted.top + frame.y * fitted.height;
      assert.ok(left >= -1e-6 && top >= -1e-6, `${id} subject starts inside viewport`);
      assert.ok(left + frame.width * fitted.width <= boxWidth + 1e-6, `${id} subject ends inside viewport`);
      assert.ok(top + frame.height * fitted.height <= boxHeight + 1e-6, `${id} subject ends inside viewport`);
    }
    assert.equal(photoAspect(undefined, frame), frame.sourceWidth * frame.width / (frame.sourceHeight * frame.height));
  }
  assert.equal(seen.size, 60);
});
test('reviewed crop landmarks preserve toes, fingertips, back and reaching hands', () => {
  for (const [key, x, y] of [
    ['image00639.jpeg', 500, 70], ['image00639.jpeg', 410, 270],
    ['image00648.jpeg', 248, 0], ['image00648.jpeg', 395, 280],
    ['image00674.jpeg', 167, 334], ['image00674.jpeg', 457, 409],
    ['image00694.jpeg', 268, 104], ['image00694.jpeg', 388, 344],
    ['image00588.jpeg', 360, 402], ['image00592.jpeg', 345, 376],
  ]) {
    const frame = getSubjectFrame(key);
    assert.ok(x >= frame.x * frame.sourceWidth && x <= (frame.x + frame.width) * frame.sourceWidth, `${key} landmark x`);
    assert.ok(y >= frame.y * frame.sourceHeight && y <= (frame.y + frame.height) * frame.sourceHeight, `${key} landmark y`);
  }
});
test('original full-frame ratios and unknown artwork are never silently subject-cropped', () => {
  assert.equal(getSubjectFrame('unreviewed.jpeg'), undefined);
  assert.equal(getSubjectFrame(), undefined);
  assert.equal(photoAspect({ width: 628, height: 408 }), 628 / 408);
});
