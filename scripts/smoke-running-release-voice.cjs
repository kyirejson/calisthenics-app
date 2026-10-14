// Actual production bridge on the task-owned emulator; no signing/test receiver or private-data access.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const prefix = fs.readFileSync(require.resolve('./smoke-running-android.cjs'), 'utf8').split('(async () => {')[0];
const { adb, tap, waitFor, dump, screenshot, sleep } = vm.runInNewContext(prefix + ';({adb,tap,waitFor,dump,screenshot,sleep})', { require, process, console, Buffer, setTimeout, clearTimeout });
async function reveal(text) {
  for (let index = 0; index < 12; index++) {
    const node = (dump().match(/<node\b[^>]*>/g) || []).find(value => value.includes(`text="${text}"`));
    const b = node?.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)?.slice(1).map(Number);
    if (b && b[1] >= 100 && b[3] <= 1495 && b[3] > b[1]) return;
    adb('shell', 'input', 'swipe', '360', '1230', '360', '450', '350'); await sleep(300);
  }
  throw Error('Cannot reveal ' + text);
}
(async () => {
  assert.equal(adb('emu', 'avd', 'name').split(/\r?\n/)[0].trim(), 'UncoverRun35');
  adb('shell', 'am', 'start', '-n', 'com.zizhong.jinjie/.MainActivity');
  await tap('切换到今日'); await tap('切换到跑步');
  await waitFor(/开始跑步/);
  const initiallyMuted = dump().includes('content-desc="开启跑步语音播报"');
  if (initiallyMuted) await tap('开启跑步语音播报');
  await waitFor(/关闭跑步语音播报/);
  await tap('选择室内跑'); await tap('开始跑步'); await waitFor(/暂停跑步/);
  await tap('关闭跑步语音播报'); await waitFor(/开启跑步语音播报/);
  assert.match(dump(), /暂停跑步/, 'Voice toggle must not end/pause the native run');
  await tap('开启跑步语音播报'); await waitFor(/关闭跑步语音播报/);
  assert.doesNotMatch(dump(), /当前安装包尚不支持|当前安装包不支持|请安装新版 APK/);
  await tap('暂停跑步'); await waitFor(/继续跑步/);
  await tap('关闭跑步语音播报'); await waitFor(/开启跑步语音播报/);
  assert.match(dump(), /继续跑步/, 'Muting while paused must preserve the paused run');
  await tap('继续跑步'); await waitFor(/暂停跑步/);
  screenshot('production-voice-toggle');
  await tap('结束并保存跑步'); await waitFor(/保存室内跑/); await tap('保存室内跑');
  await waitFor(/本次未测得里程，未保存记录/);
  if (!initiallyMuted) { await tap('开启跑步语音播报'); await waitFor(/关闭跑步语音播报/); }
  await tap('切换到数据'); await reveal('跑步数据');
  assert.match(dump(), /本周|本月/); screenshot('production-running-statistics');
  console.log('PASS production native voice control while idle/running/paused, pause/resume, distance-free ending without history, running statistics; previous voice preference restored. No claim of audible TTS quality.');
})().catch(error => { console.error(error.message); try { screenshot('production-voice-failed'); } catch {} process.exitCode = 1; });
