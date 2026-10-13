const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
require('./register-typescript.cjs')({ compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, extensions: ['.ts'] });
const model = require('../../src/running/model.ts');
module.exports = function browserHarness(initial, fail = () => false, preferences) {
  let now = 1000000, mono = 1000, callback, rejected, approximate, approximateRejected, clears = 0;
  const disk = new Map(initial ? [['uncover.running.web-journal.v2', initial]] : []);
  if (preferences) disk.set('uncover.running.options.v1', JSON.stringify(preferences));
  const spoken = []; let stoppedSpeech = 0;
  // Synthetic audio acceptance, not a test of speakers or perceived voice quality.
  const voice = { webRunVoice: text => { spoken.push(text); return true; }, stopWebRunVoice: () => { stoppedSpeech++; } };
  const storage = { getItem: async key => disk.get(key) || null, setItem: async (key, value) => { if (fail(key)) throw Error('disk full'); disk.set(key, value); }, removeItem: async key => { if (fail(key)) throw Error('disk full'); disk.delete(key); } };
  const source = ts.transpileModule(fs.readFileSync(require.resolve('../../src/running/webRecorder.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {}, OriginalDate = Date; class Clock extends OriginalDate { static now() { return now; } }
  const locationSource = ts.transpileModule(fs.readFileSync(require.resolve('../../src/running/browserLocation.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const browserLocation = {}; vm.runInNewContext(locationSource, { exports: browserLocation, Date: Clock });
  vm.runInNewContext(source, { exports, require: id => id.includes('async-storage') ? storage : id === './motionGate' ? require('../../src/running/motionGate.ts') : id === './webVoice' ? voice : id === './kilometreAnnouncement' ? require('../../src/running/kilometreAnnouncement.ts') : id === './browserLocation' ? browserLocation : model, Date: Clock, performance: { now: () => mono }, isSecureContext: true,
    navigator: { geolocation: { getCurrentPosition: (success, failure, options) => { approximate = success; approximateRejected = failure; assert.equal(options.enableHighAccuracy, false); assert.equal(options.maximumAge, 60000); }, watchPosition: (success, failure, options) => { callback = success; rejected = failure; assert.equal(options.enableHighAccuracy, true); assert.equal(options.maximumAge, 0); return 42; }, clearWatch: () => { clears++; } } } });
  const position = (metres, speed, accuracy, ageMs = 0) => ({ coords: { latitude: metres / 111195.08, longitude: 0, accuracy, speed, altitude: null }, timestamp: now - ageMs });
  return { recorder: exports.browserRunning, disk, spoken, get stoppedSpeech() { return stoppedSpeech; }, advance: ms => { now += ms; mono += ms; }, fix: (metres, speed = null, accuracy = 5, ageMs = 0) => callback(position(metres, speed, accuracy, ageMs)), approximate: (metres, accuracy = 80, ageMs = 0) => approximate(position(metres, null, accuracy, ageMs)), failure: (code, message = '') => rejected({ code, message }), approximateFailure: (code, message = '') => approximateRejected({ code, message }), deny: () => rejected({ code: 1 }), get clears() { return clears; } };
};
