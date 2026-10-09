const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
require('./register-typescript.cjs')({ compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, extensions: ['.ts'] });
const model = require('../../src/running/model.ts');
module.exports = function browserHarness(initial, fail = () => false) {
  let now = 1000000, mono = 1000, callback, rejected, clears = 0;
  const disk = new Map(initial ? [['uncover.running.web-journal.v2', initial]] : []);
  const storage = { getItem: async key => disk.get(key) || null, setItem: async (key, value) => { if (fail()) throw Error('disk full'); disk.set(key, value); }, removeItem: async key => { if (fail()) throw Error('disk full'); disk.delete(key); } };
  const source = ts.transpileModule(fs.readFileSync(require.resolve('../../src/running/webRecorder.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {}, OriginalDate = Date; class Clock extends OriginalDate { static now() { return now; } }
  vm.runInNewContext(source, { exports, require: id => id.includes('async-storage') ? storage : id === './motionGate' ? require('../../src/running/motionGate.ts') : id === './webVoice' ? require('../../src/running/webVoice.ts') : model, Date: Clock, performance: { now: () => mono }, isSecureContext: true,
    navigator: { geolocation: { watchPosition: (success, failure, options) => { callback = success; rejected = failure; assert.equal(options.enableHighAccuracy, true); assert.equal(options.maximumAge, 0); return 42; }, clearWatch: () => { clears++; } } } });
  return { recorder: exports.browserRunning, disk, advance: ms => { now += ms; mono += ms; }, fix: (metres, speed = null, accuracy = 5) => callback({ coords: { latitude: metres / 111195.08, longitude: 0, accuracy, speed, altitude: null }, timestamp: now }), deny: () => rejected({ code: 1 }), get clears() { return clears; } };
};
