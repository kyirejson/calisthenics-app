const { test } = require('node:test');
const assert = require('node:assert/strict');
const { repositoryHarness } = require('./lib/app-repository-harness.cjs');
const { resumableSession, restoreCourseSets, completedCourseSets } = require('../src/domain/training/sessionResume.ts');
const profile = { name: 'QA', age: 30, height: 175, weight: 75, sex: 'male', goal: 'street_mastery', frequency: 3, levels: {}, experience: 'beginner' };
const initial = { user_profile: JSON.stringify(profile) };
const items = [{ id: 'squat_05', targetSets: 4, targetValue: 10, targetUnit: 'reps' }, { id: 'pull_01', targetSets: 3, targetValue: 5, targetUnit: 'reps' }];
const draft = (id = 'resume', date = '2026-10-9') => ({ id, kind: 'strength', workoutId: 'qa', workoutName: 'QA', trainingDate: date, startedAt: '2026-10-09T01:00:00Z', completedAt: '2026-10-09T01:01:00Z', durationSeconds: 60, completion: 'partial', inProgress: true, exercises: [{ exerciseId: 'squat_05', name: '标准深蹲', category: 'squat', sets: [{ reps: 10, unit: 'reps', completed: true }] }], resumeState: { items, warmupDone: true, sets: restoreCourseSets(items, { exercises: [{ exerciseId: 'squat_05', sets: [{ reps: 10, completed: true }] }] }) } });
test('resume keeps completed groups, pending movements and the same record across disk reload; final and repeat remain distinct', async () => {
 const h = repositoryHarness({ initial }); await h.load(); await h.store().saveSession(draft());
 const reloaded = repositoryHarness({ initial: Object.fromEntries(h.disk) }); await reloaded.load();
 const session = resumableSession(reloaded.store().sessions, '2026-10-9', 'qa'); assert.equal(session.id, 'resume'); assert.equal(session.resumeState.warmupDone, true);
 const sets = restoreCourseSets(items, session); assert.equal(sets.squat_05[0].completed, true); assert.equal(sets.squat_05.filter(s => !s.completed).length, 3); assert.equal(sets.pull_01.filter(s => !s.completed).length, 3);
 await reloaded.store().saveSession({ ...session, exercises: [{ ...session.exercises[0], sets: [...session.exercises[0].sets, { reps: 12, completed: true, unit: 'reps' }] }] });
 assert.equal(reloaded.store().sessions.length, 1); assert.equal(reloaded.store().sessions[0].totalReps, 22); assert.equal(completedCourseSets(reloaded.store().sessions, '2026-10-9', 'qa', 'squat_05').length, 2);
 await reloaded.store().saveSession({ ...reloaded.store().sessions[0], completion: 'partial', inProgress: false, resumeState: undefined });
 assert.equal(resumableSession(reloaded.store().sessions, '2026-10-9', 'qa'), undefined);
 await reloaded.store().saveSession(draft('repeat')); assert.equal(reloaded.store().sessions.length, 2);
});
test('delete day erases all repeats, raw migration backup and added movements without touching other days; late saves cannot resurrect', async () => {
 const h = repositoryHarness({ initial }); await h.load(); const first = draft(), second = draft('repeat'), other = draft('other', '2026-10-8');
 for (const record of [first, second, other]) await h.store().saveSession(record);
 await h.store().addDailyExercise('2026-10-9', 'qa', 'squat_05');
 h.disk.set('sessions_before_checked_only_v1', JSON.stringify([first, second]));
 await h.store().resetTrainingDay('2026-10-09'); assert.deepEqual(h.store().sessions.map(s => s.id), ['other']); assert.deepEqual(h.store().dailyEdits, {}); assert.equal(h.disk.has('sessions_before_checked_only_v1'), false);
 await assert.rejects(h.store().saveSession(first), /已删除/);
 const reload = repositoryHarness({ initial: Object.fromEntries(h.disk) }); await reload.load(); assert.deepEqual(reload.store().sessions.map(s => s.id), ['other']); assert.equal(completedCourseSets(reload.store().sessions, '2026-10-9', 'qa', 'squat_05').length, 0);
});
test('failed deletion neither removes live records nor poisons subsequent saves', async () => {
 let fail = false; const h = repositoryHarness({ initial, before: async ({ kind }) => { if (fail && kind === 'remove') throw Error('disk'); } }); await h.load(); const record = draft(); await h.store().saveSession(record); fail = true;
 await assert.rejects(h.store().deleteSession(record.id)); assert.equal(h.store().sessions.length, 1); fail = false;
 await h.store().saveSession({ ...record, durationSeconds: 90 }); assert.equal(h.store().sessions[0].durationSeconds, 90);
});
