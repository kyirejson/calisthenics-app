// Native synthetic-speed QA. Test-provider changes are emulator-only and restored in finally.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const prefix = fs.readFileSync(require.resolve('./smoke-running-android.cjs'), 'utf8').split('(async () => {')[0];
const { adb, tap, waitFor, dump, journal, sleep } = vm.runInNewContext(prefix + ';({adb,tap,waitFor,dump,journal,sleep})', { require, process, console, Buffer, setTimeout, clearTimeout });
function fix(metres, speed) {
  const result = adb('shell', 'am', 'instrument', '-w', '-e', 'gpsMetres', String(metres), '-e', 'gpsSpeed', String(speed), 'com.uncover.uidump/.DumpInstrumentation');
  assert.match(result, /gps=injected/);
}
(async () => {
  try {
    if (dump().includes('返回动作列表')) await tap('返回动作列表');
    await tap('切换到今日'); await tap('切换到跑步'); await tap('选择户外跑');
    await tap('打开跑步设置'); await tap('自动暂停'); await tap('语音播报'); await tap('保存跑步设置');
    adb('shell', 'appops', 'set', 'com.uncover.uidump', 'android:mock_location', 'allow');
    adb('shell', 'appops', 'set', '2000', 'android:mock_location', 'allow');
    adb('shell', 'cmd', 'location', 'providers', 'add-test-provider', 'gps', '--requiresSatellite', '--supportsSpeed');
    adb('shell', 'cmd', 'location', 'providers', 'set-test-provider-enabled', 'gps', 'true');
    await tap('开始跑步'); await waitFor(/正在跑步/);
    fix(0, 3); await sleep(3000); fix(10, 3);
    for (let i = 0; i < 11; i++) { await sleep(800); fix(10, 0); }
    await waitFor(/已自动暂停/); const paused = journal(); assert.equal(paused.autoPaused, true);
    await sleep(5000); assert.equal(journal().elapsedMs, paused.elapsedMs);
    for (let i = 0; i < 5; i++) { await sleep(800); fix(1000 + i * 3, 3); }
    await waitFor(/正在跑步/); assert.equal(journal().autoPaused, false);
    await sleep(3000); fix(1030, 3); await tap('暂停跑步');
    fix(4000, 3); await sleep(3500); assert.equal(journal().phase, 'paused'); assert.equal(journal().autoPaused, false);
    const points = journal().samples; assert.ok(new Set(points.map(p => p.segment)).size >= 2);
    const { analyseRun } = require('../src/running/model.ts'); assert.ok(analyseRun(points).distanceM < 100, 'No kilometre bridge across automatic pause');
    await tap('结束并保存跑步'); await tap('结束并保存'); await waitFor(/跑步已保存/); await tap('关闭跑步总结');
    await tap('打开跑步设置'); await tap('自动暂停'); await tap('语音播报'); await tap('保存跑步设置');
    console.log('PASS native automatic pause/recovery, frozen elapsed time, manual pause, route boundaries and speech failure resilience');
  } finally {
    try { adb('shell', 'cmd', 'location', 'providers', 'remove-test-provider', 'gps'); } catch {}
    try { adb('shell', 'appops', 'set', 'com.uncover.uidump', 'android:mock_location', 'default'); } catch {}
    try { adb('shell', 'appops', 'set', '2000', 'android:mock_location', 'default'); } catch {}
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
