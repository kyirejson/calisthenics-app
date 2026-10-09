// Exercise the native focus modal on the emulator, without resetting app data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const prefix = fs.readFileSync(require.resolve('./smoke-running-android.cjs'), 'utf8').split('(async () => {')[0];
const { adb, tap, waitFor, dump, screenshot } = vm.runInNewContext(
  prefix + ';({adb,tap,waitFor,dump,screenshot})',
  { require, process, console, Buffer, setTimeout, clearTimeout },
);
(async () => {
  if (dump().includes('返回动作列表')) await tap('返回动作列表');
  await tap('切换到今日');
  await tap('切换到跑步');
  await tap('选择户外跑');
  await tap('开始跑步');
  await waitFor(/准备开跑/);
  await tap('取消开始跑步');
  await waitFor(/开始跑步/);
  await tap('开始跑步');
  await waitFor(/正在跑步/);
  await tap('进入跑步全屏');
  await waitFor(/平均配速 \/km/);
  screenshot('native-focus');
  const window = adb('shell', 'dumpsys', 'window');
  fs.writeFileSync('D:/UncoverBuildTools/temp/running-native-qa/focus-window.txt', window);
  assert.match(window, /mHoldScreenWindow=Window\{[^\n]*com\.zizhong\.jinjie/, 'Focus keeps the app screen awake');
  await tap('锁定跑步屏幕');
  await tap('长按解锁跑步屏幕');
  assert.match(dump(), /屏幕已锁定/);
  adb('shell', 'input', 'keyevent', '4');
  assert.match(dump(), /屏幕已锁定/);
  await tap('长按解锁跑步屏幕', true);
  await waitFor(/暂停跑步/);
  await tap('暂停跑步');
  await waitFor(/跑步已暂停/);
  await tap('继续跑步');
  await waitFor(/正在跑步/);
  await tap('退出跑步全屏，继续记录');
  await waitFor(/正在跑步/);
  assert.match(adb('shell', 'dumpsys', 'window'), /mHoldScreenWindow=null/, 'Returning releases screen-awake ownership');
  await tap('结束并保存跑步');
  await tap('结束并保存');
  await waitFor(/跑步已保存/);
  await tap('关闭跑步总结');
  await waitFor(/开始跑步/);
  console.log('PASS Android countdown cancel, native fullscreen, accidental-tap/back lock, long-press unlock, pause/resume, return recording and save');
})().catch(error => { console.error(error); try { screenshot('focus-failed'); } catch {} process.exitCode = 1; });
