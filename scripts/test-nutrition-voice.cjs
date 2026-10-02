const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { createVoiceSession } = require('../src/nutrition/voiceSession.ts');

function fixture(t, platform = 'android') {
  const texts = [], errors = [], phases = [], listeners = new Map();
  let starts = 0, stops = 0, aborts = 0, options, foreground = true;
  const speech = {
    start(value) { starts++; options = value; }, stop() { stops++; }, abort() { aborts++; },
    isRecognitionAvailable: () => true, getStateAsync: async () => 'inactive',
    getPermissionsAsync: async () => ({ granted: true }), requestPermissionsAsync: async () => ({ granted: true }),
    addListener(name, callback) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(callback);
      return { remove: () => listeners.get(name).delete(callback) };
    },
  };
  const dependencies = { load: async () => speech, platform, foreground: () => foreground, secure: () => true,
    onText: text => texts.push(text), onError: error => errors.push(error), onPhase: phase => phases.push(phase) };
  const session = createVoiceSession(dependencies); t.after(() => session.abort());
  const emit = (name, event = null) => { for (const callback of [...(listeners.get(name) || [])]) callback(event); };
  const result = (text, isFinal = false) => emit('result', { isFinal, results: [{ transcript: text }] });
  return { session, speech, dependencies, texts, errors, phases, listeners, emit, result,
    starts: () => starts, stops: () => stops, aborts: () => aborts, options: () => options,
    background: () => { foreground = false; session.background(); }, foreground: () => { foreground = true; } };
}

test('Android uses system service, Chinese vocabulary and native microphone without saving audio', async t => {
  const f = fixture(t); const start = f.session.start('原有文字');
  assert.equal(f.session.getPhase(), 'starting'); await start;
  assert.equal(f.starts(), 1); assert.equal(f.options().lang, 'zh-CN');
  assert.equal(f.options().continuous, false); assert.equal(f.options().androidRecognitionServicePackage, undefined);
  assert.equal(f.options().requiresOnDeviceRecognition, undefined);
  assert.equal(f.options().recordingOptions.persist, false);
  assert.ok(f.options().contextualStrings.includes('吊龙'));
  f.emit('start'); assert.equal(f.session.getPhase(), 'listening');
  f.result('半斤牛'); f.result('半斤牛肉', true);
  assert.equal(f.texts.at(-1), '原有文字，半斤牛肉');
  await f.session.start('ignored'); assert.equal(f.session.getPhase(), 'stopping'); assert.equal(f.stops(), 1);
  f.emit('end'); assert.equal(f.session.getPhase(), 'idle'); assert.equal(f.errors.length, 0);
});

test('Web final segments remain while interim corrections replace only the current segment', async t => {
  const f = fixture(t, 'web'); await f.session.start('今天'); f.emit('start');
  f.result('两个鸡'); f.result('两个鸡蛋', true); f.result('一碗'); f.result('一碗饭', true); f.emit('end');
  assert.equal(f.options().continuous, true);
  assert.equal(f.texts.at(-1), '今天，两个鸡蛋，一碗饭');
  assert.equal(f.texts.some(text => text.includes('两个鸡，两个鸡蛋')), false);
});

test('iOS cumulative results do not duplicate finalized text or change quantities', async t => {
  const f = fixture(t, 'ios'); await f.session.start(''); f.emit('start');
  f.result('半斤韭黄', true); f.result('半斤韭黄还有两个鸡蛋', true); f.emit('end');
  assert.equal(f.texts.at(-1), '半斤韭黄还有两个鸡蛋');
});

test('cancel during startup prevents native start and subsequent stale callbacks', async t => {
  const f = fixture(t); let release;
  f.dependencies.load = () => new Promise(resolve => { release = resolve; });
  const first = f.session.start('原有文字'); await f.session.start('');
  release(f.speech); await first; assert.equal(f.starts(), 0); assert.equal(f.session.getPhase(), 'idle');
  f.dependencies.load = async () => f.speech;
  await f.session.start(''); f.emit('start');
  const staleResult = [...f.listeners.get('result')][0];
  f.session.abort(); staleResult({ isFinal: true, results: [{ transcript: '迟到结果' }] });
  assert.equal(f.texts.length, 0);
  await f.session.start('新输入'); f.emit('start'); staleResult({ isFinal: true, results: [{ transcript: '旧会话' }] });
  f.result('新结果'); assert.equal(f.texts.at(-1), '新输入，新结果');
});

test('permission dialog survives temporary inactivity but never records after backgrounding', async t => {
  const f = fixture(t); let release;
  f.speech.getPermissionsAsync = async () => ({ granted: false });
  f.speech.requestPermissionsAsync = () => new Promise(resolve => { release = resolve; });
  const pending = f.session.start('');
  await new Promise(resolve => setImmediate(resolve));
  f.background(); assert.equal(f.session.getPhase(), 'starting');
  f.foreground(); release({ granted: true }); await pending; assert.equal(f.starts(), 1);
  f.emit('start'); f.background(); assert.equal(f.session.getPhase(), 'idle');
  assert.equal(f.aborts(), 1);
  f.foreground(); const again = f.session.start(''); await new Promise(resolve => setImmediate(resolve));
  f.background(); release({ granted: true }); await again; assert.equal(f.starts(), 1);
});

test('denied permission, unsupported service, busy recognizer and network errors are actionable', async t => {
  const f = fixture(t);
  f.speech.getPermissionsAsync = async () => ({ granted: false });
  f.speech.requestPermissionsAsync = async () => ({ granted: false });
  await f.session.start(''); assert.match(f.errors.at(-1), /权限/); assert.equal(f.starts(), 0);
  f.speech.getPermissionsAsync = async () => ({ granted: true });
  f.speech.isRecognitionAvailable = () => false;
  await f.session.start(''); assert.match(f.errors.at(-1), /系统语音服务/);
  f.speech.isRecognitionAvailable = () => true; f.speech.getStateAsync = async () => 'stopping';
  await f.session.start(''); assert.match(f.errors.at(-1), /上一段/);
  f.speech.getStateAsync = async () => 'inactive'; await f.session.start('已输入'); f.emit('start'); f.result('半斤牛肉');
  f.emit('error', { error: 'network' }); assert.match(f.errors.at(-1), /联网失败/);
  assert.equal(f.texts.at(-1), '已输入，半斤牛肉'); assert.equal(f.session.getPhase(), 'idle');
});

test('stop/abort/subscription bridge failures are caught and listeners are cleaned up', async t => {
  const f = fixture(t); await f.session.start(''); f.emit('start'); f.result('鸡蛋');
  f.speech.stop = () => { throw Error('native stop failed'); }; f.speech.abort = () => { throw Error('native abort failed'); };
  await assert.doesNotReject(f.session.start('')); assert.match(f.errors.at(-1), /结束语音输入失败/);
  assert.equal(f.texts.at(-1), '鸡蛋'); assert.equal(f.session.getPhase(), 'idle');
  for (const set of f.listeners.values()) assert.equal(set.size, 0);
  const add = f.speech.addListener;
  f.speech.addListener = (name, callback) => { if (name === 'end') throw Error('subscription failed'); return add(name, callback); };
  await f.session.start(''); for (const set of f.listeners.values()) assert.equal(set.size, 0);
});

test('no-match and end without speech recover to idle; input is bounded', async t => {
  const f = fixture(t); await f.session.start(''); f.emit('start'); f.emit('nomatch');
  assert.equal(f.session.getPhase(), 'idle'); assert.match(f.errors.at(-1), /没有识别出/);
  await f.session.start('已有'); f.emit('end'); assert.match(f.errors.at(-1), /没有听到/); assert.equal(f.texts.length, 0);
  await f.session.start(''); f.result('字'.repeat(1100)); assert.equal(f.texts.at(-1).length, 1000);
});

test('start, recording and finalization watchdogs bound stuck services without sleeping', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(t); await f.session.start(''); t.mock.timers.tick(10000);
  assert.equal(f.session.getPhase(), 'idle'); assert.match(f.errors.at(-1), /未开始收音/);
  await f.session.start(''); f.emit('start'); f.result('鸡蛋'); t.mock.timers.tick(60000);
  assert.equal(f.session.getPhase(), 'stopping'); assert.equal(f.stops(), 1);
  t.mock.timers.tick(5000); assert.equal(f.session.getPhase(), 'idle'); assert.match(f.errors.at(-1), /未及时结束/);
  assert.equal(f.texts.at(-1), '鸡蛋');
  f.dependencies.load = () => new Promise(() => {});
  void f.session.start(''); t.mock.timers.tick(30000); assert.equal(f.session.getPhase(), 'idle');
  assert.match(f.errors.at(-1), /响应超时/);
});
