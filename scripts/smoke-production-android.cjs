// UI-only smoke for the real signed production APK; emulator only, no run-as/test hooks.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const prefix = fs.readFileSync(require.resolve('./smoke-running-android.cjs'), 'utf8').split('(async () => {')[0];
const { adb, tap, waitFor, dump, screenshot, sleep, dismissPermissionRequests } = vm.runInNewContext(prefix + ';({adb,tap,waitFor,dump,screenshot,sleep,dismissPermissionRequests})', { require, process, console, Buffer, setTimeout, clearTimeout });
async function scrollFor(pattern) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const visible = (dump().match(/<node\b[^>]*>/g) || []).some(node => {
      if (!pattern.test(node)) return false;
      const bounds = node.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)?.slice(1).map(Number);
      return bounds && bounds[2] > bounds[0] && bounds[3] > bounds[1] && bounds[1] >= 100 && bounds[3] <= 1495;
    });
    if (visible) return;
    adb('shell', 'input', 'swipe', '360', '1230', '360', '450', '350'); await sleep(400);
  }
  throw Error('Production content stayed outside the visible screen: ' + pattern);
}
(async () => {
  adb('shell', 'am', 'start', '-n', 'com.zizhong.jinjie/.MainActivity');
  await waitFor(/请建立个人档案|切换到今日/);
  const initial = dump();
  if (/请建立个人档案|尚未建立个人档案|建立个人档案/.test(initial)) {
    if (initial.includes('请建立个人档案')) await tap('去填写'); else await tap('切换到我的');
    await tap('建立个人档案');
    for (const [label, value] of [['年龄', '30'], ['身高 cm', '175'], ['当前体重 kg', '75']]) {
      await scrollFor(new RegExp(label)); await tap(label); adb('shell', 'input', 'text', value); adb('shell', 'input', 'keyevent', '4');
    }
    await scrollFor(/街头健身/); await tap('街头健身');
    await scrollFor(/保存个人档案/); await tap('保存个人档案');
  }
  await tap('切换到今日'); await tap('切换到跑步');
  // Reruns may encounter an interrupted synthetic run from a previous UI attempt.
  if (dump().includes('结束并保存跑步')) {
    await tap('结束并保存跑步');
    if (dump().includes('保存室内跑')) await tap('保存室内跑'); else await tap('结束并保存');
    await waitFor(/跑步已保存/); await tap('关闭跑步总结');
  }
  await tap('打开跑步设置'); await waitFor(/当前设备无可用计步传感器/); await tap('关闭跑步设置');
  await tap('选择室内跑'); await tap('开始跑步'); await dismissPermissionRequests(); await waitFor(/正在跑步/);
  await tap('进入跑步全屏'); await waitFor(/平均配速 \/km/); screenshot('production-focus');
  await tap('暂停跑步'); await waitFor(/跑步已暂停/); await tap('继续跑步'); await waitFor(/正在跑步/);
  await tap('退出跑步全屏，继续记录'); await tap('结束并保存跑步'); await waitFor(/保存室内跑/);
  await tap('室内跑距离（公里，可选）'); adb('shell', 'input', 'text', '2.5'); adb('shell', 'input', 'keyevent', '4');
  await tap('保存室内跑'); await waitFor(/跑步已保存/); screenshot('production-receipt'); await tap('关闭跑步总结');
  await tap('查看跑步记录'); await waitFor(/2.50/); screenshot('production-history'); await tap('关闭跑步记录');
  adb('shell', 'am', 'force-stop', 'com.zizhong.jinjie'); adb('shell', 'am', 'start', '-n', 'com.zizhong.jinjie/.MainActivity');
  await tap('切换到跑步'); await tap('查看跑步记录'); await waitFor(/2.50/); await tap('关闭跑步记录');
  await tap('切换到我的'); await scrollFor(/1\.7\.8/); screenshot('production-profile');
  assert.ok(!dump().includes('知识库管理'));
  console.log('PASS signed production APK startup, profile creation, sensor-unavailable fallback, native fullscreen/pause/resume, indoor save and history after restart; version 1.7.8');
})().catch(error => { console.error(error); try { screenshot('production-failed'); } catch {} process.exitCode = 1; });
