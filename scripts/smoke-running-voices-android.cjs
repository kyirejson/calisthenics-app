// Only the independent, locally signed QA APK on the task-owned emulator.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const prefix = fs.readFileSync(require.resolve('./smoke-running-android.cjs'), 'utf8').split('(async () => {')[0];
const { adb, tap, waitFor, dump, screenshot, sleep, dismissPermissionRequests } = vm.runInNewContext(prefix + ';({adb,tap,waitFor,dump,screenshot,sleep,dismissPermissionRequests})', { require, process, console, Buffer, setTimeout, clearTimeout });
const app = 'com.zizhong.jinjie.musicqa';
async function reveal(pattern) {
  for (let i = 0; i < 12; i++) {
    const visible = (dump().match(/<node\b[^>]*>/g) || []).some(node => {
      if (!pattern.test(node)) return false;
      const b = node.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)?.slice(1).map(Number);
      return b && b[3] > b[1] && b[1] >= 100 && b[3] < 1495;
    });
    if (visible) return;
    adb('shell', 'input', 'swipe', '360', '1230', '360', '450', '350'); await sleep(300);
  }
  throw Error('QA control not visible: ' + pattern);
}
function noSpeechErrors() {
  const issue = (dump().match(/<node\b[^>]*>/g) || []).find(node => /内置语音加载失败|语音播报失败|音频播放超时|语音内容无效|音频被其他应用|不支持音色切换|请安装新版 APK/.test(node));
  assert.equal(issue, undefined, issue);
}
(async () => {
  assert.equal(adb('emu', 'avd', 'name').split(/\r?\n/)[0].trim(), 'UncoverRun35');
  assert.match(adb('shell', 'pm', 'path', app), /base\.apk/);
  for (const permission of ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION']) adb('shell', 'pm', 'grant', app, 'android.permission.' + permission);
  adb('emu', 'geo', 'fix', '116.4', '39.91'); // Emulator-only map fixture, never a real-phone position.
  adb('shell', 'am', 'start', '-n', app + '/com.zizhong.jinjie.MainActivity');
  await waitFor(/切换到今日/);
  if (/尚未建立个人档案|请建立个人档案/.test(dump())) {
    if (dump().includes('请建立个人档案')) await tap('去填写'); else await tap('切换到我的');
    await tap('建立个人档案');
    for (const [label, value] of [['年龄', '30'], ['身高 cm', '175'], ['当前体重 kg', '75']]) {
      await reveal(new RegExp(label)); await tap(label); adb('shell', 'input', 'text', value); adb('shell', 'input', 'keyevent', '4');
    }
    await reveal(/街头健身/); await tap('街头健身'); await reveal(/保存个人档案/); await tap('保存个人档案');
  }
  await tap('切换到今日'); await tap('切换到跑步');
  await dismissPermissionRequests(); // The outdoor page now requests location automatically.
  if (dump().includes('结束并保存跑步')) {
    await tap('结束并保存跑步'); if (dump().includes('保存室内跑')) await tap('保存室内跑'); else await tap('结束跑步');
    await waitFor(/本次未测得里程，未保存记录/);
  }
  await tap('选择户外跑');
  await sleep(700); adb('emu', 'geo', 'fix', '116.4', '39.91'); // Fresh fix after the automatic subscription starts.
  await waitFor(/定位就绪|地图已定位/); // No Locate button was pressed.
  await tap('打开跑步设置'); await reveal(/男声/); await tap('男声'); await sleep(700); await tap('关闭跑步设置');
  await tap('选择室内跑'); await tap('开始跑步'); await dismissPermissionRequests(); await waitFor(/暂停跑步/); noSpeechErrors();
  await tap('打开跑步设置'); await reveal(/女声/); await tap('女声'); await sleep(700); screenshot('qa-running-two-voices'); await tap('关闭跑步设置');
  assert.match(dump(), /暂停跑步/, 'Speaker switch must not pause/end running');
  await tap('暂停跑步'); await waitFor(/继续跑步/); noSpeechErrors(); await tap('继续跑步'); await waitFor(/暂停跑步/); noSpeechErrors();
  await tap('结束并保存跑步'); await waitFor(/保存室内跑/); await tap('保存室内跑'); await waitFor(/本次未测得里程，未保存记录/); noSpeechErrors();
  adb('shell', 'am', 'force-stop', app); adb('shell', 'am', 'start', '-n', app + '/com.zizhong.jinjie.MainActivity');
  await tap('切换到今日'); await tap('切换到跑步'); await tap('打开跑步设置'); await reveal(/女声/); assert.match(dump(), /女声 ✓/); await tap('关闭跑步设置');
  console.log('PASS isolated Android APK: two bundled speakers load without speech issues, switch during running, pause/resume remain functional, no-distance run is not saved, choice survives cold restart. Emulator has no audio output; real-phone audible quality is not claimed.');
})().catch(error => { console.error(error); try { screenshot('qa-voices-failed'); } catch {} process.exitCode = 1; });
