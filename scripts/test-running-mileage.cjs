const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
require('./lib/register-typescript.cjs')();
const { runningStatistics, mileageLabel } = require('../src/running/statistics.ts');
const { kilometreAnnouncement } = require('../src/running/kilometreAnnouncement.ts');
const harness = require('./lib/browser-running-harness.cjs');
const now = new Date(2026, 9, 13, 18);
const run = (id, date, km, patch = {}) => ({ id, workoutId: 'outdoor_running', workoutName: '户外跑', kind: 'running', startedAt: new Date(2026, 9, date, 10).toISOString(), completedAt: new Date(2026, 9, date, 11).toISOString(), durationSeconds: 600, exercises: [], totalReps: 0, distanceKm: km, ...patch });

test('week is local Monday-to-now, month is calendar month, duplicate revisions count once', () => {
  const rows = [run('old', 1, 29.8), run('mon', 12, 5), run('tue', 13, 7), run('tue', 13, 7.8, { completedAt: new Date(2026, 9, 13, 12).toISOString() }), run('future', 14, 100), run('strength', 13, 99, { kind: 'strength' }), run('live', 13, 20, { inProgress: true })];
  const stats = runningStatistics(rows, now);
  assert.ok(Math.abs(stats.weekKm - 12.8) < 1e-9); assert.ok(Math.abs(stats.monthKm - 42.6) < 1e-9); assert.ok(Math.abs(stats.lifetimeKm - 42.6) < 1e-9);
  assert.deepEqual(stats.days('week').map(day => day.km), [5, 7.8, 0, 0, 0, 0, 0]);
  assert.deepEqual(stats.days('week').map(day => day.future), [false, false, true, true, true, true, true]);
  assert.equal(stats.days('month').length, 31); assert.equal(mileageLabel(100), '100'); assert.equal(mileageLabel(.01), '0.01');
});
test('week/month boundaries, missing mileage and provenance never fabricate zero-distance runs', () => {
  const jan = new Date(2027, 0, 1, 18), dec = new Date(2026, 11, 31, 12);
  const december = { ...run('dec', 1, 2), startedAt: dec.toISOString(), completedAt: dec.toISOString() };
  const s = runningStatistics([december], jan); assert.equal(s.weekKm, 2); assert.equal(s.monthKm, 0);
  const stats = runningStatistics([run('none', 12, undefined), run('bad', 12, -1), run('infinite', 13, Infinity), run('step', 12, 2, { distanceSource: 'steps' }), run('manual', 13, 3, { distanceSource: 'manual', runDistancePartial: true })], now);
  assert.equal(stats.weekKm, 5); assert.equal(stats.unknownRuns, 3); assert.equal(stats.estimatedRuns, 2); assert.equal(stats.partialRuns, 1);
  assert.equal(runningStatistics([], now).lifetimeKm, 0);
});
test('deletion recomputes totals and milestone credit with no stored achievement cache', () => {
  const rows = [run('a', 12, 98.4), run('b', 13, 2)];
  assert.equal(runningStatistics(rows, now).milestone.nextGoal, 200);
  const deleted = runningStatistics(rows.slice(0, 1), now); assert.equal(deleted.milestone.nextGoal, 100); assert.ok(Math.abs(deleted.milestone.remaining - 1.6) < .00001);
  assert.equal(runningStatistics([], now).milestone.progress, 0);
});
test('kilometre speech reports minutes and seconds once per threshold, not elapsed time alone', () => {
  assert.deepEqual(kilometreAnnouncement(1000, 380000, 0), { km: 1, text: '您已跑了1公里，用时6分20秒。' });
  assert.equal(kilometreAnnouncement(1999, 720000, 1), null);
  assert.equal(kilometreAnnouncement(2000, 720000, 1).text, '您已跑了2公里，用时12分钟。');
  for (const invalid of [null, undefined, NaN, Infinity, -1, 999]) assert.equal(kilometreAnnouncement(invalid, 900000, 0), null);
  assert.match(kilometreAnnouncement(1000, 380000, 0, 'steps').text, /计步估算/);
  assert.match(kilometreAnnouncement(1000, 380000, 0, 'location', true).text, /定位路段/);
});
test('default voice is on, existing explicit mute persists, active toggle does not restart stopwatch', async () => {
  const h = harness(), r = h.recorder; assert.equal((await r.snapshot(0)).options.voice, true);
  await r.start('active'); h.advance(10000); const before = await r.snapshot(0); await r.setVoice(false);
  const after = await r.snapshot(0); assert.equal(after.phase, 'running'); assert.equal(after.elapsedMs, before.elapsedMs); assert.equal(after.id, before.id); assert.equal(after.options.voice, false); assert.ok(h.stoppedSpeech > 0);
  assert.equal(h.clears, 0); await r.setVoice(true); assert.equal((await r.snapshot(0)).options.voice, true);
  const muted = harness(undefined, undefined, { autoPause: false, voice: false, stepTracking: false }); assert.equal((await muted.recorder.snapshot(0)).options.voice, false);
});
test('voice watermark persists through pause/restart and mute does not replay missed kilometres', async () => {
  const h = harness(), r = h.recorder; await r.start('speech'); h.fix(0);
  for (let i = 1; i <= 105; i++) { h.advance(3000); h.fix(i * 10); await r.snapshot(0); }
  assert.equal(h.spoken.filter(text => /1公里/.test(text)).length, 1);
  await r.pause(); const raw = h.disk.get('uncover.running.web-journal.v2'); assert.equal(JSON.parse(raw).spokenKm, 1);
  const restored = harness(raw); await restored.recorder.snapshot(0); await restored.recorder.resume(); await restored.recorder.snapshot(0); assert.equal(restored.spoken.some(text => /1公里/.test(text)), false);
  await r.resume(); await r.setVoice(false);
  for (let i = 106; i <= 205; i++) { h.advance(3000); h.fix(i * 10); await r.snapshot(0); }
  await r.setVoice(true); await r.snapshot(0); assert.equal(h.spoken.some(text => /2公里/.test(text)), false);
});
test('failed voice preference write leaves previous options and active run intact', async () => {
  let fail = false; const h = harness(undefined, () => fail), r = h.recorder; await r.start('save-fail'); fail = true;
  await assert.rejects(r.setVoice(false), /disk full/); fail = false; const next = await r.snapshot(0); assert.equal(next.options.voice, true); assert.equal(next.phase, 'running');
});
test('routes remain untouched, running stats live only below progress, history is latest-only in My', () => {
  const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const data = read('src/screens/DataScreen.tsx'), records = read('src/features/history/TrainingRecords.tsx'), hook = read('src/features/history/useTrainingRecords.ts');
  assert.ok(data.indexOf('<RunningMileageCard') > data.indexOf('<UnifiedProgressCard')); assert.doesNotMatch(data, /styles\.calendar|<TrainingHistoryDay/);
  assert.match(records, /profile-latest-history/); assert.match(records, /latest \? <TrainingHistoryDay/); assert.match(records, /查看全部训练历史/); assert.match(hook, /const latest = allGroups\[0\]/);
  assert.match(read('src/screens/ProfileScreen.tsx'), /<TrainingRecords/); assert.doesNotMatch(read('src/screens/ProfileScreen.tsx'), /DeepSeek 助手|useOpenDeepseekChat/);
  assert.doesNotMatch(read('src/components/TabBar.tsx'), /appearance|editorial|shadowOpacity|elevation/); assert.match(read('src/components/TabBar.tsx'), /bottom: 0/);
  assert.doesNotMatch(read('src/screens/RunScreen.tsx'), /本周|本月|播报：|announcement\.text|historyOpen/);
});
