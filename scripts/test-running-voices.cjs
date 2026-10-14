const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
require('./lib/register-typescript.cjs')();
const { cleanRunVoiceStyle, numberClips, runVoiceClips } = require('../src/running/voiceClips.ts');
const { cleanRunOptions, defaultRunOptions } = require('../src/running/model.ts');
const harness = require('./lib/browser-running-harness.cjs');
const root = path.join(__dirname, '../modules/uncover-running/android/src/main/assets/run-voices');

test('two actual speaker styles, backwards-compatible default and strict saved data', () => {
  assert.equal(defaultRunOptions().voiceStyle, 'female');
  assert.equal(cleanRunOptions({ autoPause: false, voice: false, stepTracking: false }).voiceStyle, 'female');
  for (const style of ['female', 'male']) assert.equal(cleanRunVoiceStyle(style), style);
  for (const style of [null, '', 'robot', 1]) assert.throws(() => cleanRunVoiceStyle(style));
});
test('Chinese announcement clips cover kilometre, duration, exact minutes and source caveats', () => {
  assert.deepEqual(numberClips(10), ['n10']); assert.deepEqual(numberClips(101), ['n1', 'hundred', 'n0', 'n1']);
  assert.deepEqual(numberClips(1020), ['n1', 'thousand', 'n0', 'n20']); assert.deepEqual(numberClips(10001), ['n1', 'ten_thousand', 'n0', 'n1']);
  assert.deepEqual(runVoiceClips('您已跑了1公里，用时6分20秒。'), ['distance', 'n1', 'km_time', 'n6', 'minute', 'n20', 'seconds']);
  assert.deepEqual(runVoiceClips('计步估算，您已跑了2公里，用时12分钟。'), ['estimated', 'n2', 'km_time', 'n12', 'minutes']);
  assert.equal(runVoiceClips('已记录定位路段3公里，用时18分1秒。')[0], 'partial');
  for (const text of ['开始跑步', '继续跑步', '跑步已暂停', '已自动暂停，重新跑动后继续', '已自动继续跑步']) assert.equal(runVoiceClips(text).length, 1);
  for (const value of [-1, NaN, Infinity, 1.5]) assert.throws(() => numberClips(value));
  assert.throws(() => runVoiceClips('未知文本'));
});
test('idle/active/paused style changes persist, preserve timing and mute, no missed kilometre replay', async () => {
  const h = harness(), r = h.recorder; await r.setVoiceStyle('male'); await r.start('voice-style'); assert.equal(h.spokenStyles[0], 'male');
  h.advance(10000); const before = await r.snapshot(0); await r.setVoiceStyle('female');
  const after = await r.snapshot(0); assert.equal(after.phase, 'running'); assert.equal(after.elapsedMs, before.elapsedMs); assert.equal(after.id, before.id); assert.equal(after.options.voiceStyle, 'female'); assert.equal(h.clears, 0);
  await r.pause(); await r.setVoice(false); await r.setVoiceStyle('male'); const paused = await r.snapshot(0);
  assert.equal(paused.phase, 'paused'); assert.equal(paused.options.voice, false); assert.equal(paused.options.voiceStyle, 'male');
  const restored = harness(h.disk.get('uncover.running.web-journal.v2'), undefined, JSON.parse(h.disk.get('uncover.running.options.v1'))); assert.equal((await restored.recorder.snapshot(0)).options.voiceStyle, 'male');
  await assert.rejects(r.setVoiceStyle('invalid'));
});
test('failed preference or checkpoint writes do not pretend a voice switch succeeded', async () => {
  let failKey = ''; const h = harness(undefined, key => key === failKey), r = h.recorder; await r.start('rollback');
  for (const key of ['uncover.running.options.v1', 'uncover.running.web-journal.v2']) {
    failKey = key; await assert.rejects(r.setVoiceStyle('male'), /disk full/); failKey = '';
    assert.equal((await r.snapshot(0)).options.voiceStyle, 'female');
    if (h.disk.has('uncover.running.options.v1')) assert.equal(JSON.parse(h.disk.get('uncover.running.options.v1')).voiceStyle, 'female');
  }
});
test('switching speakers does not re-announce an already reported kilometre', async () => {
  const h = harness(), r = h.recorder; await r.start('one-km'); h.fix(0);
  for (let i = 1; i <= 105; i++) { h.advance(3000); h.fix(i * 10); await r.snapshot(0); }
  assert.equal(h.spoken.filter(text => /1公里/.test(text)).length, 1);
  await r.setVoiceStyle('male'); await r.snapshot(0);
  assert.equal(h.spoken.filter(text => /1公里/.test(text)).length, 1);
  assert.equal(JSON.parse(h.disk.get('uncover.running.web-journal.v2')).spokenKm, 1);
  for (let i = 106; i <= 205; i++) { h.advance(3000); h.fix(i * 10); await r.snapshot(0); }
  const index = h.spoken.findIndex(text => /2公里/.test(text)); assert.ok(index >= 0); assert.equal(h.spokenStyles[index], 'male');
});
test('bundled packs match recorded provenance and every clip is non-silent mono PCM with valid bounds', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  assert.equal(manifest.license, 'Apache-2.0'); assert.equal(manifest.sampleRate, 24000); assert.equal(manifest.voices.female.speaker, 'zf_001'); assert.equal(manifest.voices.male.speaker, 'zm_010');
  assert.notEqual(manifest.voices.female.sha256, manifest.voices.male.sha256);
  for (const style of ['female', 'male']) {
    const meta = manifest.voices[style], data = fs.readFileSync(path.join(root, style + '.wav'));
    assert.equal(crypto.createHash('sha256').update(data).digest('hex'), meta.sha256);
    assert.equal(data.toString('ascii', 0, 4), 'RIFF'); assert.equal(data.readUInt16LE(20), 1); assert.equal(data.readUInt16LE(22), 1); assert.equal(data.readUInt32LE(24), 24000); assert.equal(data.readUInt16LE(34), 16); assert.equal(data.toString('ascii', 36, 40), 'data'); assert.equal(data.length, meta.frames * 2 + 44);
    let previousEnd = 0;
    for (const clip of Object.values(meta.clips)) {
      assert.equal(clip.start, previousEnd); assert.ok(clip.length >= 2400 && clip.length < 24000 * 12); previousEnd += clip.length;
      let energy = 0; for (let i = clip.start; i < previousEnd; i++) energy += Math.abs(data.readInt16LE(44 + i * 2)); assert.ok(energy > clip.length * 80);
    }
    assert.equal(previousEnd, meta.frames);
    for (let i = 0; i < 100; i++) assert.ok(meta.clips['n' + i]);
    assert.ok(data.length < 12000000, 'No large runtime TTS model is embedded');
  }
  assert.match(fs.readFileSync(path.join(root, 'LICENSE.txt'), 'utf8'), /Apache License/);
});
