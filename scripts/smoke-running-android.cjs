// Emulator-only QA. This script deliberately refuses physical-device serials.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const ts = require('typescript');
require('./lib/register-typescript.cjs')({ compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, extensions: ['.ts'] });
const { analyseRun } = require('../src/running/model.ts');
const adbPath = process.env.ADB_PATH || 'D:/UncoverBuildTools/android-sdk/platform-tools/adb.exe';
const serial = process.env.ANDROID_QA_SERIAL || 'emulator-5554';
assert.match(serial, /^emulator-\d+$/, 'Never run isolated fixture setup against a real phone');
const output = 'D:/UncoverBuildTools/temp/running-native-qa';
fs.mkdirSync(output, { recursive: true });
const app = 'com.zizhong.jinjie';
const adb = (...args) => {
  try { return execFileSync(adbPath, ['-s', serial, ...args], { encoding: 'utf8', timeout: 20000 }); }
  catch (error) {
    if (args[0] !== 'pull') throw error;
    // Windows ADB occasionally disconnects while pulling screenshots. This is
    // transport-only; replaying a read never repeats an app action.
    execFileSync(adbPath, ['-s', serial, 'wait-for-device'], { timeout: 10000 });
    return execFileSync(adbPath, ['-s', serial, ...args], { encoding: 'utf8', timeout: 20000 });
  }
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function dump() {
  // A running stopwatch never reaches uiautomator CLI's one-second idle window.
  // Capture accessibility directly without pausing the actual running service.
  let result = '';
  for (let retry = 0; retry < 3; retry++) {
    result = adb('shell', 'am', 'instrument', '-w', 'com.uncover.uidump/.DumpInstrumentation');
    const xml = result.match(/INSTRUMENTATION_RESULT: xml=(.*)/)?.[1];
    if (xml) return xml;
  }
  throw Error('UI capture failed: ' + result);
}
async function waitFor(pattern, timeout = 30000) {
  const start = Date.now(); let xml = '';
  while (Date.now() - start < timeout) { try {
    xml = dump();
    if (xml.includes('No location access')) {
      // Google Play's Find My Device warning is outside the app under test.
      const close = (xml.match(/<node\b[^>]*>/g) || []).find(node => node.includes('text="Close"'));
      if (close) { const b = close.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/).slice(1).map(Number); adb('shell', 'input', 'tap', String((b[0] + b[2]) / 2), String((b[1] + b[3]) / 2)); await sleep(200); continue; }
    }
    if (xml.includes('发现新版本')) {
      const node = (xml.match(/<node\b[^>]*>/g) || []).find(node => node.includes('content-desc="稍后再说"') || node.includes('text="稍后再说"'));
      if (node) { const b = node.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/).slice(1).map(Number); adb('shell', 'input', 'tap', String((b[0] + b[2]) / 2), String((b[1] + b[3]) / 2)); await sleep(500); continue; }
    }
    if (pattern.test(xml)) return xml;
  } catch {} await sleep(400); }
  fs.writeFileSync(output + '/last-window.xml', xml); throw Error('Android UI did not show ' + pattern);
}
async function tap(label, long = false) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const xml = await waitFor(new RegExp(`(?:text|content-desc)="${escaped}"`));
  const nodes = xml.match(/<node\b[^>]*>/g) || [];
  // Prefer the action's accessibility label over a heading with the same text.
  const node = nodes.find(node => node.includes(`content-desc="${label}"`)) || nodes.find(node => node.includes(`text="${label}"`));
  const bounds = node.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/).slice(1).map(Number);
  fs.appendFileSync(output + '/action-trace.jsonl', JSON.stringify({ label, bounds, node, at: Date.now() }) + '\n');
  const x = String(Math.round((bounds[0] + bounds[2]) / 2)), y = String(Math.round((bounds[1] + bounds[3]) / 2));
  if (long) adb('shell', 'input', 'swipe', x, y, x, y, '1800'); else adb('shell', 'input', 'tap', x, y);
  await sleep(300);
}
async function scrollFor(pattern) {
  for (let attempt = 0; attempt < 7; attempt++) {
    const visible = (dump().match(/<node\b[^>]*>/g) || []).some(node => {
      if (!pattern.test(node) || node.includes('visible-to-user="false"')) return false;
      const bounds = node.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)?.slice(1).map(Number);
      return bounds && bounds[2] > bounds[0] && bounds[3] > bounds[1] && (bounds[1] + bounds[3]) / 2 >= 100 && (bounds[1] + bounds[3]) / 2 <= 1300;
    });
    if (visible) return;
    adb('shell', 'input', 'swipe', '360', '1300', '360', '450', '350'); await sleep(400);
  }
  throw Error('Android content stayed outside the visible screen: ' + pattern);
}
function journal() { return JSON.parse(adb('shell', 'run-as', app, 'cat', 'files/running-journal-v2.json')); }
async function waitJournal(predicate, timeout = 12000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) { const value = journal(); if (predicate(value)) return value; await sleep(400); }
  throw Error('Native GPS checkpoint did not meet the requested condition');
}
function screenshot(name) { adb('shell', 'screencap', '-p', '/sdcard/running-qa.png'); adb('pull', '/sdcard/running-qa.png', output + '/' + name + '.png'); }
async function dismissPermissionRequests() {
  for (let attempt = 0; attempt < 5; attempt++) {
    await sleep(400); const xml = dump();
    const node = (xml.match(/<node\b[^>]*>/g) || []).find(item => item.includes('permission_deny'));
    if (!node) { if (xml.includes('正在跑步')) return; continue; }
    const bounds = node.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/).slice(1).map(Number);
    adb('shell', 'input', 'tap', String((bounds[0] + bounds[2]) / 2), String((bounds[1] + bounds[3]) / 2));
  }
}
function fix(metres) { adb('emu', 'geo', 'fix', '116.400000', String(39.910000 + metres / 111195.08)); }
function savedSessions() {
  const target = output + '/saved-' + Date.now() + '.db';
  // exec-out preserves binary bytes; shell text decoding corrupts SQLite files.
  fs.writeFileSync(target, execFileSync(adbPath, ['-s', serial, 'exec-out', 'run-as', app, 'cat', 'databases/RKStorage']));
  const db = new DatabaseSync(target, { readOnly: true });
  try { return JSON.parse(db.prepare("SELECT value FROM catalystLocalStorage WHERE key='sessions'").get().value); } finally { db.close(); }
}
function seed() {
  adb('shell', 'am', 'force-stop', app);
  for (const permission of ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION']) {
    try { adb('shell', 'pm', 'revoke', app, 'android.permission.' + permission); adb('shell', 'pm', 'clear-permission-flags', app, 'android.permission.' + permission, 'user-set', 'user-fixed'); } catch {}
  }
  // Build a fresh isolated test database instead of copying binary bytes through an ADB shell.
  const dbFile = output + '/fixture-' + Date.now() + '.db';
  const db = new DatabaseSync(dbFile);
  db.exec('CREATE TABLE catalystLocalStorage (key TEXT PRIMARY KEY, value TEXT NOT NULL); PRAGMA user_version=1;');
  const source = fs.readFileSync(require.resolve('./smoke-fitness-flows.cjs'), 'utf8');
  const profile = vm.runInNewContext('(' + source.match(/const profile = ([\s\S]*?);\r?\n/)[1] + ')');
  const put = db.prepare('INSERT OR REPLACE INTO catalystLocalStorage(key,value) VALUES(?,?)');
  put.run('user_profile', JSON.stringify({ ...profile, name: 'Android Running QA' })); put.run('sessions', '[]'); put.run('profile-invitation-seen', '1');
  db.close(); adb('push', dbFile, '/data/local/tmp/running-fixture.db');
  adb('shell', 'run-as', app, 'rm', '-f', 'databases/RKStorage-journal', 'databases/RKStorage-wal', 'databases/RKStorage-shm');
  adb('shell', 'run-as', app, 'cp', '/data/local/tmp/running-fixture.db', 'databases/RKStorage');
  adb('shell', 'run-as', app, 'rm', '-f', 'files/running-journal-v2.json');
}
(async () => {
  adb('install', '-r', '-t', process.env.ANDROID_UI_DUMP_APK || 'D:/UncoverBuildTools/temp/android-ui-dump/ui-dump.apk');
  seed(); adb('logcat', '-c'); adb('shell', 'am', 'start', '-n', app + '/.MainActivity');
  await waitFor(/切换到跑步/); await tap('切换到跑步'); screenshot('idle');
  // Denied permission must reject the action without starting a service or crashing.
  await tap('检查跑步定位'); await waitFor(/permission_deny(?:_and_dont_ask_again)?_button/);
  const permissions = dump();
  const deny = (permissions.match(/<node\b[^>]*>/g) || []).find(node => node.includes('permission_deny'));
  const b = deny.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/).slice(1).map(Number);
  adb('shell', 'input', 'tap', String((b[0] + b[2]) / 2), String((b[1] + b[3]) / 2));
  await waitFor(/位置权限未开启/); assert.ok(adb('shell', 'pidof', app).trim()); console.log('PASS native permission denial remains usable');
  // Android 15: no position permission, system location off, no coordinate at all.
  // A real native FGS must still keep the workout stopwatch alive under screen lock.
  adb('shell', 'cmd', 'location', 'set-location-enabled', 'false');
  await tap('开始跑步'); await dismissPermissionRequests(); await waitFor(/正在跑步/);
  await sleep(5500); const timeOnly = journal(); assert.equal(timeOnly.phase, 'running'); assert.equal(timeOnly.samples.length, 0);
  assert.ok(timeOnly.elapsedMs >= 3000); assert.match(dump(), /text="—"/); screenshot('no-location-timer');
  adb('shell', 'input', 'keyevent', '26'); await sleep(6000);
  assert.ok(journal().elapsedMs > timeOnly.elapsedMs); assert.match(adb('shell', 'dumpsys', 'activity', 'services', app), /isForeground=true/);
  adb('shell', 'input', 'keyevent', '224'); adb('shell', 'wm', 'dismiss-keyguard');
  await tap('暂停跑步'); const onlyPaused = journal(); await sleep(2200); assert.equal(journal().elapsedMs, onlyPaused.elapsedMs);
  await tap('继续跑步'); await waitFor(/正在跑步/); await sleep(1000);
  await tap('结束并保存跑步'); await tap('结束跑步'); await waitFor(/本次未测得里程，未保存记录/); await waitFor(/开始跑步/);
  console.log('PASS native permission-free start, no-fix timing under lock, pause/resume and ending without empty history');
  await tap('选择室内跑'); await tap('开始跑步'); await waitFor(/正在跑步/); await sleep(1500);
  assert.equal(journal().mode, 'indoor'); assert.equal(journal().samples.length, 0);
  await tap('结束并保存跑步'); await waitFor(/保存室内跑/);
  await tap('室内跑距离（公里，可选）'); adb('shell', 'input', 'text', '2.5'); await sleep(500); screenshot('indoor-distance-entry');
  fs.writeFileSync(output + '/indoor-distance-entry.xml', dump());
  await tap('保存室内跑'); await waitFor(/跑步已保存/); await tap('关闭跑步总结'); await waitFor(/开始跑步/); console.log('PASS native indoor run without GPS and optional treadmill distance');
  await tap('选择户外跑');
  for (const permission of ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION']) adb('shell', 'pm', 'grant', app, 'android.permission.' + permission);
  adb('shell', 'cmd', 'location', 'set-location-enabled', 'true');
  await tap('检查跑步定位'); fix(0); await waitFor(/定位就绪/); screenshot('located');
  await tap('开始跑步');
  // Android 13+ notification refusal must not prevent location FGS startup.
  await sleep(1000); const permissionXml = dump();
  if (permissionXml.includes('permission_deny')) {
    const node = (permissionXml.match(/<node\b[^>]*>/g) || []).find(node => node.includes('permission_deny'));
    const b = node.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/).slice(1).map(Number);
    adb('shell', 'input', 'tap', String((b[0] + b[2]) / 2), String((b[1] + b[3]) / 2));
  }
  await waitFor(/正在跑步/); fix(0); await sleep(2200); fix(10); await sleep(2200); fix(20); await sleep(2200);
  // The native file is a five-second checkpoint, not the current JS snapshot.
  const started = await waitJournal(value => value.samples.length >= 3); assert.equal(started.phase, 'running');
  const service = adb('shell', 'dumpsys', 'activity', 'services', app); assert.match(service, /RunningService/); assert.match(service, /isForeground=true/);
  await tap('暂停跑步'); const paused = journal(); await sleep(2500); fix(1000); await sleep(1500);
  assert.equal(journal().phase, 'paused'); assert.equal(journal().elapsedMs, paused.elapsedMs); assert.equal(journal().samples.length, paused.samples.length); console.log('PASS native pause freezes time and route');
  await tap('继续跑步'); fix(1000); await sleep(2200); fix(1010); await sleep(2200); screenshot('recording');
  // Switch to another page while recording, then lock the device and feed real GPS callbacks.
  await tap('切换到数据'); fix(1020); await sleep(2200);
  adb('shell', 'input', 'keyevent', '26'); await sleep(1000); fix(1030); await sleep(2200); fix(1040); await sleep(6000);
  const locked = journal(); assert.equal(locked.phase, 'running'); assert.ok(locked.samples.length > paused.samples.length); assert.ok(locked.elapsedMs > paused.elapsedMs); console.log('PASS native GPS keeps recording across page changes and screen lock');
  adb('shell', 'input', 'keyevent', '224'); adb('shell', 'wm', 'dismiss-keyguard'); await tap('切换到今日'); await waitFor(/正在跑步/);
  // GPS switch-off reports a recoverable issue without a native exception.
  adb('shell', 'cmd', 'location', 'set-location-enabled', 'false'); await waitFor(/系统定位已关闭|GPS 已关闭|系统 GPS 定位/); assert.ok(adb('shell', 'pidof', app).trim());
  adb('shell', 'cmd', 'location', 'set-location-enabled', 'true'); fix(1050); await sleep(2200);
  const original = journal(); adb('shell', 'am', 'force-stop', app); await sleep(2000); adb('shell', 'am', 'start', '-n', app + '/.MainActivity');
  await waitFor(/跑步已暂停/); screenshot('recovered');
  const recovered = journal(); assert.equal(recovered.id, original.id);
  const recoveringUi = await waitFor(/中断|退出|暂停/); assert.ok(recoveringUi.includes('跑步已暂停'));
  fix(2000); await tap('继续跑步'); await sleep(2200); fix(2010); await sleep(2200);
  const beforeSave = await waitJournal(value => value.samples.some(point => Math.abs(point.latitude - (39.91 + 2010 / 111195.08)) < .00001)), analysis = analyseRun(beforeSave.samples);
  assert.ok(analysis.distanceM >= 30 && analysis.distanceM <= 120, `Measured ${analysis.distanceM} m must exclude kilometre jumps during pause/restart`);
  assert.ok(analysis.segments.length >= 3, 'Restart and pause must break the route');
  await tap('结束并保存跑步'); await tap('结束并保存'); await waitFor(/跑步已保存/); await tap('关闭跑步总结'); await waitFor(/开始跑步/);
  await tap('切换到我的');
  await scrollFor(/今日跑步|\d{4}-\d{2}-\d{2} 跑步/); screenshot('data');
  const savedDate = new Date(original.startedAt), savedDay = [savedDate.getFullYear(), String(savedDate.getMonth() + 1).padStart(2, '0'), String(savedDate.getDate()).padStart(2, '0')].join('-');
  await tap('展开' + savedDay + '训练历史'); await scrollFor(/用时 · 不含暂停/); await waitFor(/用时 · 不含暂停/); await scrollFor(/已保存的定位轨迹/); await sleep(800); screenshot('data-expanded');
  adb('shell', 'am', 'force-stop', app);
  const sessions = savedSessions(); assert.equal(sessions.length, 3);
  const outdoor = sessions.find(record => record.id === original.id), timer = sessions.find(record => record.id === timeOnly.id), indoor = sessions.find(record => record.runMode === 'indoor');
  assert.equal(timer.distanceKm, undefined); assert.equal(timer.distanceSource, 'unmeasured'); assert.ok(timer.durationSeconds > 0);
  assert.equal(indoor.distanceKm, 2.5); assert.equal(indoor.distanceSource, 'manual'); assert.deepEqual(indoor.route, []);
  assert.equal(outdoor.kind, 'running'); assert.ok(outdoor.distanceKm >= .03 && outdoor.distanceKm <= .12);
  assert.ok(outdoor.runSegments.length >= 3); assert.ok(outdoor.durationSeconds > 0); assert.equal(outdoor.calories, undefined);
  adb('shell', 'run-as', app, 'test', '!', '-f', 'files/running-journal-v2.json');
  adb('shell', 'am', 'start', '-n', app + '/.MainActivity'); await waitFor(/切换到我的/); await tap('切换到我的'); await scrollFor(/今日跑步|\d{4}-\d{2}-\d{2} 跑步/);
  assert.equal(savedSessions().length, 3, 'App restart cannot duplicate the completed run');
  const log = adb('logcat', '-d', '-s', 'AndroidRuntime:E', 'ReactNativeJS:E');
  fs.writeFileSync(output + '/error-log.txt', log); assert.ok(!/FATAL EXCEPTION|TypeError|ReferenceError/.test(log), log);
  console.log('PASS native restart recovery, confirmed save, local history and no native/JS fatal exceptions');
  console.log('Native screenshots and fixture: ' + output);
})().catch(error => { console.error(error); try { screenshot('failed'); } catch {} process.exitCode = 1; });
