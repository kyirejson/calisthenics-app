// Reuses emulator-only accessibility helpers; never seeds or clears user data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const prefix = fs.readFileSync(require.resolve('./smoke-running-android.cjs'), 'utf8').split('(async () => {')[0];
const { adb, tap, waitFor, scrollFor, screenshot } = vm.runInNewContext(
  prefix + ';({adb,tap,waitFor,scrollFor,screenshot})',
  { require, process, console, Buffer, setTimeout, clearTimeout },
);
(async () => {
  const wifi = adb('shell', 'settings', 'get', 'global', 'wifi_on').trim();
  const data = adb('shell', 'settings', 'get', 'global', 'mobile_data').trim();
  try {
    adb('shell', 'svc', 'wifi', 'disable');
    adb('shell', 'svc', 'data', 'disable');
    await tap('切换到进阶');
    await tap('选择深蹲进阶路线');
    await scrollFor(/查看第5式标准深蹲动作指导/);
    await tap('查看第5式标准深蹲动作指导');
    await scrollFor(/资料原文与配图/);
    await tap('资料原文与配图');
    const xml = await waitFor(/书籍动作原文/);
    assert.ok(!xml.includes('暂无可核对的原文资料'));
    await scrollFor(/第五式|动作描述/);
    screenshot('squat-original-offline');
    // Leave the figure visible for visual inspection of the offline asset.
    adb('shell', 'input', 'swipe', '360', '1250', '360', '580', '350');
    await new Promise(resolve => setTimeout(resolve, 700));
    screenshot('squat-original-figure-offline');
    console.log('PASS Android offline original text; inspect original figure screenshot');
  } finally {
    adb('shell', 'svc', 'wifi', wifi === '1' ? 'enable' : 'disable');
    adb('shell', 'svc', 'data', data === '1' ? 'enable' : 'disable');
  }
})().catch(error => { console.error(error); try { screenshot('original-offline-failed'); } catch {} process.exitCode = 1; });
