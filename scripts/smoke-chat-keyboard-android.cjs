// UI-only keyboard QA in a separately installed emulator app. Never sends a message or changes a real profile.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const prefix = fs.readFileSync(require.resolve('./smoke-running-android.cjs'), 'utf8').split('(async () => {')[0];
const { adb, tap, waitFor, dump, sleep } = vm.runInNewContext(prefix + ';({adb,tap,waitFor,dump,sleep})', { require, process, console, Buffer, setTimeout, clearTimeout });
const packageName = 'com.zizhong.jinjie.chatqa';
const output = 'D:/UncoverBuildTools/temp/chat-keyboard-android';
const bounds = (xml, label) => {
  const node = (xml.match(/<node\b[^>]*>/g) || []).find(item => item.includes(`content-desc="${label}"`));
  assert.ok(node, label + ' exists');
  return node.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/).slice(1).map(Number);
};
function screenshot(name) {
  adb('shell', 'screencap', '-p', '/sdcard/chat-keyboard-qa.png');
  adb('pull', '/sdcard/chat-keyboard-qa.png', `${output}/${name}.png`);
}
(async () => {
  assert.ok(adb('shell', 'pm', 'list', 'packages', packageName).includes('package:' + packageName));
  fs.mkdirSync(output, { recursive: true });
  const oldKeyboard = adb('shell', 'settings', 'get', 'secure', 'show_ime_with_hard_keyboard').trim();
  try {
    adb('shell', 'settings', 'put', 'secure', 'show_ime_with_hard_keyboard', '1');
    adb('shell', 'am', 'force-stop', packageName);
    adb('shell', 'am', 'start', '-n', packageName + '/com.zizhong.jinjie.MainActivity');
    let xml = await waitFor(/请建立个人档案|打开 MAX 聊天/);
    if (xml.includes('请建立个人档案')) await tap('稍后再说');
    await tap('打开 MAX 聊天');
    xml = await waitFor(/聊天输入/);
    const before = bounds(xml, '发送聊天消息');
    screenshot('welcome');
    await tap('聊天输入');
    await sleep(900);
    const ime = adb('shell', 'dumpsys', 'input_method');
    assert.match(ime, /mInputShown=true|mIsInputViewShown=true|mImeWindowVis=0x3|isInputViewShown\(\)=true/, 'Native IME is actually shown');
    adb('shell', 'input', 'text', 'line-one');
    adb('shell', 'input', 'keyevent', '66');
    adb('shell', 'input', 'text', 'line-two');
    xml = await waitFor(/line-two/);
    assert.match(xml.replaceAll('&#10;', '\n'), /text="line-one\s+line-two"/, 'Native Enter remains a newline, not submit');
    const after = bounds(xml, '发送聊天消息');
    assert.ok(after[3] < before[3] - 200, 'Composer rises above the actual Android keyboard');
    assert.ok(after[2] - after[0] >= 70 && after[3] - after[1] >= 70, 'Phone touch target stays full size');
    screenshot('keyboard');
    adb('shell', 'input', 'keyevent', '4');
    await sleep(500);
    const restored = bounds(dump(), '发送聊天消息');
    assert.ok(Math.abs(restored[3] - before[3]) <= 5, 'Composer returns to the bottom when keyboard hides');
    await tap('添加聊天附件');
    await waitFor(/添加文件/);
    screenshot('attachment-sheet');
    await tap('完成附件选择');
    assert.match(dump().replaceAll('&#10;', '\n'), /line-one\s+line-two/, 'Opening attachments preserves the draft');
    await tap('关闭 MAX 聊天');
    console.log('PASS Android native IME: newline, keyboard avoidance, touch targets, keyboard dismissal and attachment draft preservation');
  } finally {
    if (oldKeyboard === 'null') adb('shell', 'settings', 'delete', 'secure', 'show_ime_with_hard_keyboard');
    else adb('shell', 'settings', 'put', 'secure', 'show_ime_with_hard_keyboard', oldKeyboard);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
