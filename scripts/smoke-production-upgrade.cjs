// Emulator-only signed APK upgrade check. Does not seed, clear or rewrite App data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const prefix = fs.readFileSync(require.resolve('./smoke-running-android.cjs'), 'utf8').split('(async () => {')[0];
const { adb, tap, waitFor, dump, screenshot } = vm.runInNewContext(prefix + ';({adb,tap,waitFor,dump,screenshot})', { require, process, console, Buffer, setTimeout, clearTimeout });
const stage = process.argv[2];
assert.ok(['before', 'after'].includes(stage), 'Use before/after on the emulator around adb install -r');
const checkpoint = 'D:/UncoverBuildTools/temp/running-native-qa/upgrade-checkpoint.json';
(async () => {
  adb('shell', 'am', 'force-stop', 'com.zizhong.jinjie');
  adb('shell', 'am', 'start', '-n', 'com.zizhong.jinjie/.MainActivity');
  await waitFor(/切换到今日/); await tap('切换到今日'); await tap('切换到跑步');
  await tap('查看跑步记录'); await waitFor(/2.50/);
  const ids = [...dump().matchAll(/content-desc="(?:展开|收起)跑步记录([^"]+)"/g)].map(match => match[1]).sort();
  assert.ok(ids.length > 0, 'Known signed-APK training fixtures must exist before testing an upgrade');
  if (stage === 'before') fs.writeFileSync(checkpoint, JSON.stringify({ ids }));
  else assert.deepEqual(ids, JSON.parse(fs.readFileSync(checkpoint, 'utf8')).ids, 'Updating must preserve all existing run record IDs');
  screenshot('upgrade-' + stage + '-history'); await tap('关闭跑步记录');
  await tap('切换到我的');
  const expected = stage === 'before' ? process.env.UPGRADE_FROM_VERSION || '1.7.8' : require('../app.json').expo.version;
  await waitFor(new RegExp(expected.replace(/\./g, '\\.')));
  console.log(`PASS ${stage} signed APK upgrade fixture: ${ids.length} existing run IDs, version ${expected}`);
})().catch(error => { console.error(error); try { screenshot('upgrade-failed'); } catch {} process.exitCode = 1; });
