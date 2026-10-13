const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
require('./lib/register-typescript.cjs')();
const { VoiceCounter, elapsedAnnouncement, normalizeCountInterval } = require('../src/domain/training/voiceCounter.ts');
const { createCounterSpeaker } = require('../src/features/training/counterSpeechQueue.ts');
const { repositoryHarness } = require('./lib/app-repository-harness.cjs');
const flush = () => new Promise(resolve => setImmediate(resolve));
function nativeSpeaker(speech, fail) {
  const exports = {}, ts = require('typescript'), vm = require('node:vm');
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/features/training/counterSpeech.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, Error, require: name => {
    if (name === 'expo-speech') return speech;
    if (name === './counterSpeechQueue') return { createCounterSpeaker };
    throw Error(`Unexpected native speech import: ${name}`);
  } });
  return exports.createTrainingSpeaker(fail);
}

test('spoken reps start at one, respect cadence and stop at target without replaying late ticks', () => {
  const clock = new VoiceCounter(5, 0);
  assert.equal(clock.tick(0, 3), 1); assert.equal(clock.tick(4999, 3), null);
  assert.equal(clock.tick(5000, 3), 2); assert.equal(clock.tick(30000, 3), 3);
  assert.equal(clock.tick(60000, 3), null);
});
test('pause/resume preserves the remaining gap; interval edits preserve spoken count', () => {
  const clock = new VoiceCounter(5, 0); clock.tick(0, 10); clock.pause(2000);
  assert.equal(clock.tick(30000, 10), null); clock.resume(30000);
  assert.equal(clock.tick(32999, 10), null); assert.equal(clock.tick(33000, 10), 2);
  clock.setInterval(2, 33500); assert.equal(clock.tick(35499, 10), null); assert.equal(clock.tick(35500, 10), 3);
});
test('device speech startup latency cannot immediately rush the next number', () => {
  const clock = new VoiceCounter(1, 0); assert.equal(clock.tick(0, 10), 1);
  clock.synchronize(2500); assert.equal(clock.tick(3000, 10), null); assert.equal(clock.tick(3500, 10), 2);
});
test('seconds announcements use actual elapsed seconds, preserve pauses and never call lost seconds reps', () => {
  assert.equal(elapsedAnnouncement(0, 30, 5, 0), null);
  assert.equal(elapsedAnnouncement(4, 30, 5, 0), null);
  assert.equal(elapsedAnnouncement(5, 30, 5, 0), 5);
  assert.equal(elapsedAnnouncement(5, 30, 5, 5), null);
  assert.equal(elapsedAnnouncement(23, 30, 5, 10), 23, 'no stale 15/20 replay');
  assert.equal(elapsedAnnouncement(30, 30, 5, 25), 30);
  assert.equal(elapsedAnnouncement(40, 30, 5, 30), null);
  assert.equal(elapsedAnnouncement(1, 10, 1, 0), 1);
});
test('invalid intervals and goals stay finite and never lead to runaway speech', () => {
  for (const value of [undefined, null, '', NaN, Infinity]) assert.equal(normalizeCountInterval(value), 5);
  assert.equal(normalizeCountInterval(-1), 1); assert.equal(normalizeCountInterval(100), 30);
  const clock = new VoiceCounter(1, 0);
  assert.equal(clock.tick(0, NaN), null); assert.equal(clock.tick(0, 0), null);
});
test('speech adapter flushes pending playback, cancels delayed startup and ignores stale callbacks', async () => {
  const played = [], callbacks = [], errors = [];
  let release, delay = true;
  const gate = new Promise(resolve => { release = resolve; });
  const speaker = createCounterSpeaker({ stop: async () => { if (delay) await gate; }, speak: (text, callback) => { played.push(text); callbacks.push(callback); } }, error => errors.push(error));
  const first = speaker.say(1); const second = speaker.say(2); delay = false; release();
  await Promise.all([first, second]); assert.deepEqual(played, ['2']); assert.equal(speaker.starting, true);
  callbacks[0].onStart(); assert.equal(speaker.starting, false);
  await speaker.stop(); callbacks[0].onError(Error('old utterance')); assert.deepEqual(errors, []);
});
test('speech errors report actual failures, never throw from cleanup or silently keep enabled', async () => {
  const failures = [];
  const speaker = createCounterSpeaker({ stop: () => { throw Error('engine unavailable'); }, speak: () => assert.fail() }, reason => failures.push(reason));
  await speaker.say(1); assert.deepEqual(failures, ['engine unavailable']); await speaker.stop();
});
test('cancelling voice initialization cannot enqueue a late number', async () => {
  let release;
  const played = [], failures = [], gate = new Promise(resolve => { release = resolve; });
  const speaker = createCounterSpeaker({ prepare: () => gate, stop() {}, speak: value => played.push(value) }, reason => failures.push(reason));
  const pending = speaker.say(1); await speaker.stop(); release(); await pending;
  assert.deepEqual(played, []); assert.deepEqual(failures, []); assert.equal(speaker.starting, false);
});
test('a stalled system voice initialization times out safely and remains retryable', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const failures = [], played = []; let release, cold = true;
  const gate = new Promise(resolve => { release = resolve; });
  const speaker = createCounterSpeaker({ prepare: () => cold ? gate : Promise.resolve(), stop() {}, speak: (value, callbacks) => { played.push(value); callbacks.onStart(); } }, reason => failures.push(reason));
  const pending = speaker.say(1); t.mock.timers.tick(8000);
  assert.equal(failures.length, 1); assert.equal(speaker.starting, false);
  release(); await pending; assert.deepEqual(played, []);
  cold = false; await speaker.say(1); assert.deepEqual(played, ['1']);
  t.mock.timers.reset();
});
test('native adapter initializes only when enabled and never queues speech before TTS is ready', async () => {
  let release, requests = 0; const spoken = [], failures = [];
  const gate = new Promise(resolve => { release = resolve; });
  const speaker = nativeSpeaker({ getAvailableVoicesAsync: () => { requests++; return gate; }, stop() {}, speak: (text, options) => { spoken.push({ text, options }); options.onStart(); } }, reason => failures.push(reason));
  await speaker.stop(); assert.equal(requests, 0, 'Opening/closing a muted training screen does not start TTS');
  const pending = speaker.say(1); await flush(); assert.equal(requests, 1); assert.deepEqual(spoken, []);
  await speaker.stop(); release([{ language: 'zh-CN', identifier: 'system-zh' }]); await pending; assert.deepEqual(spoken, []);
  await speaker.say(1); assert.equal(spoken[0].text, '1'); assert.equal(spoken[0].options.voice, 'system-zh');
  assert.deepEqual(failures, []); await speaker.stop();
});
test('missing native voice reports a real error; a system default voice is not needlessly blocked', async () => {
  const failures = [], spoken = []; let voices = [];
  const speaker = nativeSpeaker({ getAvailableVoicesAsync: async () => voices, stop() {}, speak: (value, options) => { spoken.push(value); options.onStart(); } }, reason => failures.push(reason));
  await speaker.say(1); assert.match(failures[0], /系统没有可用的语音/);
  voices = [{ language: 'en-US', identifier: 'system-default' }];
  await speaker.say(1); assert.deepEqual(spoken, ['1']); await speaker.stop();
});
test('interval persists through real repository and restart, with no sessions or records invented', async () => {
  const h = repositoryHarness(); await h.load(); await h.store().updateSettings({ voiceCountInterval: 3 });
  assert.equal(h.store().settings.voiceCountInterval, 3); assert.equal(h.store().sessions.length, 0);
  const reload = repositoryHarness({ initial: Object.fromEntries(h.disk) }); await reload.load();
  assert.equal(reload.store().settings.voiceCountInterval, 3); assert.equal(reload.store().sessions.length, 0);
});
test('failed interval saves preserve the previous setting', async () => {
  const h = repositoryHarness({ before: async event => { if (event.key === 'settings') throw Error('settings disk'); } }); await h.load();
  await assert.rejects(h.store().updateSettings({ voiceCountInterval: 2 }), /disk/);
  assert.equal(h.store().settings.voiceCountInterval, 5);
});
test('voice remains a toolbar icon and settings row, independent of model and actual set recording', () => {
  const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const ui = source('src/components/TrainingCockpit.tsx'), hook = source('src/features/training/useTrainingVoice.ts');
  assert.match(ui, /开启语音报数/); assert.match(ui, /<TrainingVoiceSettings/);
  assert.doesNotMatch(ui, /语音数数|开始领练|试听|onChat/);
  assert.match(hook, /AppState\.addEventListener/);
  assert.doesNotMatch(hook, /personalChat|saveSession|onToggleSet|setSets|setReps|executePersonalTool/);
  assert.doesNotMatch(source('src/features/training/counterSpeech.ts'), /^import \* as Speech/m, 'missing native speech must not crash old binaries on module load');
});
