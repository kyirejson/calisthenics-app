// Production bridge test on a dedicated, already-authorized emulator. Never grants permissions or logs in.
const assert = require('node:assert/strict'), cp = require('node:child_process'), fs = require('node:fs'), path = require('node:path');
const adb = process.env.MUSIC_QA_ADB || 'D:/UncoverBuildTools/android-sdk/platform-tools/adb.exe';
const serial = process.env.MUSIC_QA_SERIAL || 'emulator-5556', app = 'com.zizhong.jinjie.musicqa';
const output = process.env.MUSIC_QA_OUTPUT || 'D:/UncoverBuildTools/temp/agent-music-20261013';
const records = [], requestId = `native-music-${Date.now()}`, executionId = `${requestId}-attempt-1`;
const run = args => cp.execFileSync(adb, ['-s', serial, ...args], { encoding: 'utf8', timeout: 20000 });
function qa(input) {
  const raw = run(['shell', 'am', 'broadcast', '-a', 'uncover.music.QA', '-n', `${app}/uncover.music.MusicQaReceiver`, '--es', 'input', Buffer.from(JSON.stringify(input)).toString('base64')]);
  const match = raw.match(/data="?([A-Za-z0-9+/=]+)/); if (!match) throw Error(raw);
  const result = JSON.parse(Buffer.from(match[1], 'base64').toString()); records.push({ input, result }); return result;
}
const execute = (command, attempt = executionId) => qa({ op: 'execute', requestId, executionId: attempt, command: { provider: 'qq', ...command } });
function screen() { const value = qa({ op: 'screen', provider: 'qq' }); assert.equal(value.ok, true, value.message); return value; }
function searchScreen() {
  const deadline = Date.now() + 15000;
  let openedSearch = false, focusedField = false;
  do {
    const value = qa({ op: 'screen', provider: 'qq' });
    const field = value.nodes?.find(node => node.editable);
    if (field?.focused) return value;
    if (field && !focusedField) {
      assert.equal(execute({ type: 'ui', operationKey: 'qa-focus-search', snapshotId: value.snapshotId, nodeId: field.nodeId, action: 'tap' }).ok, true);
      focusedField = true;
      continue;
    }
    if (!value.ok && !['screen_unavailable', 'needs_open_app'].includes(value.code)) throw Error(value.message);
    if (value.nodes?.some(node => node.text === '同意')) throw Error('Initialize the isolated QQ guest fixture manually; QA never accepts an agreement.');
    if (value.nodes?.some(node => node.text === '网络未连接')) throw Error('Official QQ client reports 网络未连接; cannot run the live-search fixture until its network is available.');
    const entry = value.nodes?.find(node => node.clickable && node.label.startsWith('搜索 '));
    if (entry && !openedSearch) {
      assert.equal(execute({ type: 'ui', operationKey: 'qa-open-search', snapshotId: value.snapshotId, nodeId: entry.nodeId, action: 'tap' }).ok, true);
      openedSearch = true;
    }
  } while (Date.now() < deadline);
  throw Error('QQ guest fixture did not expose a search field.');
}
let originalQuery, changedQuery = false;
try {
  assert.match(serial, /^emulator-\d+$/);
  assert.ok(['UncoverRun35', 'UncoverMusic30'].includes(run(['emu', 'avd', 'name']).split(/\r?\n/)[0].trim()), 'Only task-owned isolated AVDs are allowed.');
  for (const provider of ['qq', 'netease']) {
    const capability = qa({ op: 'capabilities', provider });
    assert.equal(capability.installed, true); assert.equal(capability.native, true);
    assert.equal(capability.screenConsent, true, 'Configure optional consent in the isolated QA app first.');
    assert.equal(capability.accessibilityConnected, true, 'Manually authorize the QA app in this emulator first.');
  }
  assert.equal(execute({ type: 'open', operationKey: 'open' }).status, 'opened');
  let current = searchScreen();
  const field = current.nodes.find(node => node.editable);
  assert.ok(field, 'QQ guest fixture must expose a search field; never auto-accept agreements or login.');
  originalQuery = field.showingHint ? '' : field.text;
  const command = { type: 'ui', operationKey: 'fill-search', snapshotId: current.snapshotId, nodeId: field.nodeId, action: 'set_text', text: `MUSIC_QA_${Date.now()}` };
  assert.equal(execute(command).ok, true); changedQuery = true;
  assert.equal(execute(command).replayed, true);
  assert.equal(execute({ ...command, text: 'must not overwrite' }).code, 'operation_conflict');
  assert.equal(execute({ ...command, operationKey: 'stale', text: 'must not use stale reference' }).code, 'stale_node');
  current = screen(); assert.equal(current.nodes.find(node => node.editable).text, command.text);
  assert.equal(qa({ op: 'screen', provider: 'netease' }).code, 'needs_open_app');
  assert.equal(execute({ type: 'open', operationKey: 'wrong-link', uri: 'https://unrelated.example/' }).code, 'invalid_music_uri');
  qa({ op: 'cancel', executionId: `${executionId}-cancelled` });
  const retryCommand = { type: 'open', operationKey: 'cancel-retry' };
  assert.equal(execute(retryCommand, `${executionId}-cancelled`).code, 'cancelled');
  assert.equal(execute(retryCommand).status, 'opened', 'Cancellation is scoped to the attempt, not every future retry.');
  const playback = qa({ op: 'playback', provider: 'qq' }); assert.equal(playback.ok, true);
  if (playback.status !== 'playing') assert.equal(playback.verifiedPlaying, false);
  assert.equal(execute({ type: 'open', operationKey: 'unsupported-standard-search', query: 'MUSIC_QA' }).code, 'unsupported_entry');
  const receipts = qa({ op: 'receipts', requestId }); assert.ok(receipts.receipts.some(row => row.operationKey === 'fill-search'));
  const restoreScreen = screen(), restoreField = restoreScreen.nodes.find(node => node.editable);
  assert.equal(execute({ type: 'ui', operationKey: 'restore-search', snapshotId: restoreScreen.snapshotId, nodeId: restoreField.nodeId, action: 'set_text', text: originalQuery }).ok, true); changedQuery = false;
  assert.equal(qa({ op: 'finish', requestId, executionId }).ok, true);
  assert.match(run(['shell', 'dumpsys', 'activity', 'activities']).match(/^\s*(?:topResumedActivity=|mResumedActivity:).*$/m)?.[0] || '', /com\.zizhong\.jinjie\.musicqa/);
  assert.equal(run(['shell', 'dumpsys', 'activity', 'services', app]).includes('MusicExecutionService'), false);
  assert.equal(qa({ op: 'screen', provider: 'qq' }).code, 'needs_open_app');
  assert.equal(execute({ type: 'open', operationKey: 'clear-active-task' }).status, 'opened');
  qa({ op: 'screen', provider: 'qq' });
  assert.equal(run(['shell', 'dumpsys', 'activity', 'services', app]).includes('MusicExecutionService'), true);
  assert.equal(qa({ op: 'clear' }).ok, true);
  assert.equal(execute({ type: 'open', operationKey: 'never-after-clear' }).code, 'cancelled');
  assert.equal(qa({ op: 'capabilities', provider: 'qq' }).screenConsent, false);
  assert.equal(qa({ op: 'capabilities', provider: 'qq' }).playbackConsent, false);
  assert.deepEqual(qa({ op: 'receipts', requestId }).receipts, []);
  assert.equal(run(['shell', 'dumpsys', 'activity', 'services', app]).includes('MusicExecutionService'), false);
  console.log('PASS native installed-client capabilities + QQ live input + replay/conflict/stale protection + foreground isolation + URI scope + cancellation/retry + truthful state + return/foreground-service cleanup + clear cancels active task');
} finally {
  if (changedQuery) {
    try { const value = screen(), field = value.nodes.find(node => node.editable); if (field) execute({ type: 'ui', operationKey: 'restore-after-failure', snapshotId: value.snapshotId, nodeId: field.nodeId, action: 'set_text', text: originalQuery }); } catch {}
  }
  try { qa({ op: 'finish', requestId, executionId }); } catch {}
  fs.mkdirSync(output, { recursive: true }); fs.writeFileSync(path.join(output, 'native-bridge-results.json'), JSON.stringify({ note: 'Real QQ guest UI + installed NetEase capabilities; not a logged-in private-favorites or successful audio-playback test.', records }, null, 2));
}
