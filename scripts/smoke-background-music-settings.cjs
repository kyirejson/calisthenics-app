// UI-only smoke on the task-owned emulator. Does not install/start/authorize Shizuku or play music.
const assert = require('node:assert/strict'), cp = require('node:child_process');
const adb = process.env.MUSIC_QA_ADB || 'D:/UncoverBuildTools/android-sdk/platform-tools/adb.exe';
const serial = process.env.MUSIC_QA_SERIAL || 'emulator-5554', app = 'com.zizhong.jinjie.musicqa';
const run = (...args) => cp.execFileSync(adb, ['-s', serial, ...args], { encoding: 'utf8', timeout: 20000 });
const decode = value => value.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
function screen() {
  run('shell', 'uiautomator', 'dump', '/sdcard/uncover-background-settings-smoke.xml');
  const xml = run('shell', 'cat', '/sdcard/uncover-background-settings-smoke.xml');
  return [...xml.matchAll(/<node\b([^>]+)>/g)].map(match => Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(attr => [attr[1], decode(attr[2])])));
}
function tap(node) {
  assert.ok(node, 'Expected real QA UI control'); assert.equal(node.package, app); assert.notEqual(node.password, 'true');
  const [left, top, right, bottom] = [...node.bounds.matchAll(/\d+/g)].map(match => Number(match[0]));
  assert.ok(right > left && bottom > top && left >= 0 && top >= 0);
  run('shell', 'input', 'tap', String(Math.floor((left + right) / 2)), String(Math.floor((top + bottom) / 2)));
}
function find(nodes, description) { return nodes.find(node => node['content-desc'] === description); }
function restartSettings() {
  run('shell', 'am', 'force-stop', app); run('shell', 'am', 'start', '-n', `${app}/com.zizhong.jinjie.MainActivity`);
  let nodes; const deadline = Date.now() + 20000;
  do { nodes = screen(); } while (!find(nodes, '打开 DeepSeek 聊天') && Date.now() < deadline);
  tap(find(nodes, '打开 DeepSeek 聊天')); nodes = screen(); tap(find(nodes, '打开服务设置')); return screen();
}
let original;
try {
  assert.equal(serial, 'emulator-5554'); assert.equal(run('emu', 'avd', 'name').split(/\r?\n/)[0].trim(), 'UncoverRun35');
  assert.ok(Number(run('shell', 'getprop', 'ro.build.version.sdk').trim()) >= 34);
  // Missing-Shizuku fixture: not a verification of the privileged background workflow.
  assert.equal(run('shell', 'pm', 'list', 'packages', 'moe.shizuku.privileged.api').trim(), '');
  let nodes = restartSettings(); original = !!find(nodes, '关闭后台点歌');
  if (!original) {
    tap(find(nodes, '开启后台点歌')); nodes = screen();
    assert.ok(nodes.some(node => node.text === '启用不切换页面的后台点歌？'));
    tap(nodes.find(node => node.text === '同意并启用')); nodes = screen();
  }
  assert.ok(find(nodes, '关闭后台点歌'));
  run('shell', 'input', 'swipe', '360', '1440', '360', '520', '400'); nodes = screen();
  assert.ok(nodes.some(node => node.text === '先安装 Shizuku'));
  assert.ok(find(nodes, '打开 Shizuku 官方下载'));
  nodes = restartSettings(); assert.ok(find(nodes, '关闭后台点歌'), 'Native selection persists across process restart');
  tap(find(nodes, '关闭后台点歌')); nodes = screen(); assert.ok(find(nodes, '开启后台点歌'));
  assert.equal(nodes.some(node => node.text === '先安装 Shizuku'), false);
  console.log('PASS native explicit opt-in + truthful missing-Shizuku state + cold restart persistence + disable; not a background playback test');
} finally {
  if (original !== undefined) {
    const nodes = screen();
    if (original && find(nodes, '开启后台点歌')) { tap(find(nodes, '开启后台点歌')); tap(screen().find(node => node.text === '同意并启用')); }
    if (!original && find(nodes, '关闭后台点歌')) tap(find(nodes, '关闭后台点歌'));
  }
}
