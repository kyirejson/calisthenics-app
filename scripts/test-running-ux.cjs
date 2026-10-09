const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('./lib/register-typescript.cjs')();
const { analyseRun, toRunSession } = require('../src/running/model.ts');
const point = (metres, seconds) => ({ latitude: metres / 111195.08, longitude: 0, accuracy: 5, timestamp: 1800000000000 + seconds * 1000, elapsedMs: seconds * 1000, segment: 0 });
test('kilometre splits use interpolated crossing times and persist independently of average pace', () => {
 const samples = Array.from({ length: 211 }, (_, i) => point(i * 10, i * 3)); const result = analyseRun(samples);
 assert.equal(result.splits.length, 2); assert.ok(Math.abs(result.splits[0].elapsedMs - 300000) < 1);
 const record = toRunSession({ id: 'split', phase: 'finished', startedAt: 1800000000000, completedAt: 1800000630000, elapsedMs: 630000, samples, sampleCount: samples.length, preview: null, error: '' });
 assert.equal(record.runSplits.length, 2); for (const split of record.runSplits) assert.ok(Math.abs(split.seconds - 300) < .01);
 assert.deepEqual(toRunSession({ id: 'partial', phase: 'finished', startedAt: 1800000000000, completedAt: 1800000930000, elapsedMs: 930000, samples, sampleCount: samples.length, preview: null, error: '' }).runSplits, [], 'Missing sections never pretend to have full-kilometre pace');
});
test('running focus has a hold-to-unlock guard, independent return and symmetrical screen-awake cleanup', () => {
 const focus = fs.readFileSync(require.resolve('../src/running/RunFocus.tsx'), 'utf8');
 assert.match(focus, /delayLongPress=\{900\}/); assert.match(focus, /if \(!locked\) onClose\(\)/);
 assert.match(focus, /keepRunScreenOn\(true\)/); assert.match(focus, /keepRunScreenOn\(false\)/);
 const screen = fs.readFileSync(require.resolve('../src/screens/RunScreen.tsx'), 'utf8');
 assert.match(screen, /clearTimeout\(timer\)/); assert.match(screen, /取消开始跑步/); assert.match(screen, /setCountdown\(null\)/); assert.match(screen, /关闭跑步总结/);
});
test('Android build upload contains original excerpts and bundled figures, while local sources and secrets stay excluded', () => {
 const excludes = fs.readFileSync(require.resolve('../.easignore'), 'utf8').split(/\r?\n/);
 for (const path of ['/src/data/private/', '/assets/original-images/', '/assets/supplemental-images/', '/assets/demon-images/']) assert.ok(!excludes.includes(path), path);
 for (const path of ['.env*', 'credentials.json', '/knowledge/sources.local.json', '/src/knowledge/private/']) assert.ok(excludes.includes(path), path);
 const folder = path.join(__dirname, '../assets/original-images');
 if (fs.existsSync(folder)) {
   const text = fs.readFileSync(require.resolve('../src/data/private/originalTexts.ts'), 'utf8'); assert.ok(text.length > 100000);
   assert.ok(fs.readdirSync(folder).length > 100);
 }
});
