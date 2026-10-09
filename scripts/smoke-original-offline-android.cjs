// Reuses emulator-only accessibility helpers; never seeds or clears user data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const prefix = fs.readFileSync(require.resolve('./smoke-running-android.cjs'), 'utf8').split('(async () => {')[0];
const { adb, tap, waitFor, screenshot, dump } = vm.runInNewContext(
  prefix + ';({adb,tap,waitFor,screenshot,dump})',
  { require, process, console, Buffer, setTimeout, clearTimeout },
);
async function scrollFor(pattern) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const node = (dump().match(/<node\b[^>]*>/g) || []).find(node => pattern.test(node));
    const bounds = node?.match(/bounds="\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]"/)?.slice(1).map(Number);
    const center = bounds ? (bounds[1] + bounds[3]) / 2 : undefined;
    if (bounds && bounds[2] > bounds[0] && bounds[3] > bounds[1] && center >= 120 && center <= 1380) return;
    const up = center === undefined || center > 1380;
    adb('shell', 'input', 'swipe', '360', up ? '1200' : '780', '360', up ? '780' : '1200', '350');
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw Error('Original detail target stayed outside the visible screen: ' + pattern);
}
(async () => {
  const wifi = adb('shell', 'settings', 'get', 'global', 'wifi_on').trim();
  const data = adb('shell', 'settings', 'get', 'global', 'mobile_data').trim();
  try {
    adb('shell', 'svc', 'wifi', 'disable');
    adb('shell', 'svc', 'data', 'disable');
    await tap('切换到今日'); await tap('切换到进阶');
    // Progress intentionally remembers its scroll position when returning.
    for (let attempt = 0; attempt < 4; attempt++) adb('shell', 'input', 'swipe', '360', '450', '360', '1300', '350');
    await tap('选择深蹲进阶路线');
    await scrollFor(/查看第5式标准深蹲动作指导/);
    const guideLabel = dump().match(/content-desc="(查看第5式标准深蹲动作指导[^"]*)"/)?.[1];
    assert.ok(guideLabel, 'Standard squat guide action must be present, locked or unlocked');
    await tap(guideLabel);
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
