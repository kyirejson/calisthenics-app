// Emulator-only signed APK upgrade check. Does not seed, clear or rewrite App data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const prefix = fs.readFileSync(require.resolve('./smoke-running-android.cjs'), 'utf8').split('(async () => {')[0];
const { adb, tap, waitFor, dump, screenshot, sleep } = vm.runInNewContext(prefix + ';({adb,tap,waitFor,dump,screenshot,sleep})', { require, process, console, Buffer, setTimeout, clearTimeout });
const stage = process.argv[2];
assert.ok(['before', 'after'].includes(stage), 'Use before/after on the emulator around adb install -r');
const checkpoint = 'D:/UncoverBuildTools/temp/running-native-qa/upgrade-checkpoint.json';
(async () => {
  adb('shell', 'am', 'force-stop', 'com.zizhong.jinjie');
  adb('shell', 'am', 'start', '-n', 'com.zizhong.jinjie/.MainActivity');
  await waitFor(/切换到今日/);
  // The upgrade crosses the migration from the running-history modal to My.
  let migratedIds = [];
  if (stage === 'before') { await tap('切换到今日'); await tap('切换到跑步'); await tap('查看跑步记录'); }
  else {
    await tap('切换到我的');
    for (let attempt = 0; attempt < 12; attempt++) {
      const button = (dump().match(/<node\b[^>]*>/g) || []).find(node => node.includes('content-desc="查看全部训练历史"'));
      const b = button?.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)?.slice(1).map(Number);
      if (b && b[1] >= 100 && b[3] <= 1495 && b[3] > b[1]) break;
      adb('shell', 'input', 'swipe', '360', '1230', '360', '450', '350'); await sleep(400);
    }
    await tap('查看全部训练历史');
    const nodes = dump().match(/content-desc="展开([^" ]+)训练历史"/g) || [];
    for (const node of nodes) {
      await tap(node.match(/content-desc="([^"]+)"/)[1]);
      migratedIds.push(...[...dump().matchAll(/content-desc="删除跑步记录([^"]+)"/g)].map(match => match[1]));
    }
  }
  await waitFor(/2.50/);
  const ids = stage === 'before' ? [...dump().matchAll(/content-desc="(?:展开|收起)跑步记录([^"]+)"/g)].map(match => match[1]).sort() : [...new Set(migratedIds)].sort();
  assert.ok(ids.length > 0, 'Known signed-APK training fixtures must exist before testing an upgrade');
  if (stage === 'before') fs.writeFileSync(checkpoint, JSON.stringify({ ids }));
  else assert.deepEqual(ids, JSON.parse(fs.readFileSync(checkpoint, 'utf8')).ids, 'Updating must preserve all existing run record IDs');
  screenshot('upgrade-' + stage + '-history'); await tap(stage === 'before' ? '关闭跑步记录' : '关闭全部训练历史');
  await tap('切换到我的');
  const expected = stage === 'before' ? process.env.UPGRADE_FROM_VERSION || '1.7.8' : require('../app.json').expo.version;
  await waitFor(new RegExp(expected.replace(/\./g, '\\.')));
  console.log(`PASS ${stage} signed APK upgrade fixture: ${ids.length} existing run IDs, version ${expected}`);
})().catch(error => { console.error(error); try { screenshot('upgrade-failed'); } catch {} process.exitCode = 1; });
