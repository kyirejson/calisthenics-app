const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
require('./lib/register-typescript.cjs')();
const { normalizeMusicPreferences, changeMusicPreferences } = require('../src/music/preferences.ts');
const { createMusicRuntime } = require('../src/music/agentRuntime.ts');
const { repositoryHarness } = require('./lib/app-repository-harness.cjs');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
test('native incremental builds track model modules and keep the config plugin idempotent', () => {
  const { trackModuleInputs } = require('../modules/uncover-music/plugin.cjs');
  const original = 'apply plugin: "com.facebook.react"\nreact { autolinkLibrariesWithApp() }\n';
  const patched = trackModuleInputs(original);
  assert.ok(patched.startsWith(original));
  assert.match(patched, /sources\.include\("\*\*\/\*\.mjs", "\*\*\/\*\.cjs"\)/);
  assert.equal(trackModuleInputs(patched), patched);
  assert.equal(typeof require('../modules/uncover-music/plugin.cjs')({ name: 'Music QA', slug: 'music-qa' }).mods.android.appBuildGradle, 'function');
  assert.ok(JSON.parse(read('app.json')).expo.plugins.includes('./modules/uncover-music/plugin.cjs'));
});
function harness() {
  let settings = { vibration: true, restSeconds: 120 }, fail = false;
  const calls = [];
  const capability = provider => ({ provider, native: true, installed: true, screenConsent: true, playbackConsent: true, accessibilityGranted: true, accessibilityConnected: true, searchIntent: false, notificationAccess: true });
  const transport = {
    capabilities: async provider => capability(provider), screen: async (provider, offset) => ({ ok: true, snapshotId: 'real-screen', provider, offset, nodes: [{ nodeId: 'n7', text: '搜索音乐' }] }),
    playback: async provider => ({ ok: true, provider, status: 'playing', title: '真实歌曲', verifiedPlaying: true }),
    execute: async (request, command, execution) => { calls.push({ request, command, execution }); return { ok: true, status: 'acted', verifiedPlaying: false }; }, cancel: async id => calls.push({ cancel: id }),
  };
  const execute = createMusicRuntime(transport, { requestId: 'message-1', executionId: 'attempt-1', readSettings: () => settings, updateSettings: async patch => { if (fail) throw Error('disk unavailable'); settings = { ...settings, ...patch }; } });
  return { execute, calls, settings: () => settings, fail: () => { fail = true; }, transport };
}
test('music presets migrate safely and keep two independent libraries, without changing training settings', () => {
  const defaults = normalizeMusicPreferences(undefined);
  assert.equal(defaults.provider, 'netease'); assert.equal(defaults.presets.netease.kind, 'favorites');
  const changed = changeMusicPreferences(defaults, { provider: 'qq', preset: { kind: 'playlist', name: '夜跑', link: 'https://y.qq.com/playlist/1' } });
  assert.equal(changed.presets.qq.name, '夜跑'); assert.equal(changed.presets.netease.kind, 'favorites');
  assert.equal(changeMusicPreferences(changed, { provider: 'netease' }).presets.qq.name, '夜跑');
  assert.throws(() => changeMusicPreferences(changed, { provider: 'invented' }));
  assert.throws(() => changeMusicPreferences(changed, { preset: false }));
  assert.equal('consent' in changeMusicPreferences(changed, { preset: { kind: 'favorites', consent: true } }).presets.qq, false);
});
test('music settings persist through the real repository; failed writes never claim a changed preset', async () => {
  const h = repositoryHarness(); await h.load();
  await h.store().updateSettings({ music: changeMusicPreferences(undefined, { provider: 'qq', preset: { kind: 'playlist', name: '测试歌单' } }) });
  const restored = repositoryHarness({ initial: Object.fromEntries(h.disk) }); await restored.load();
  assert.equal(restored.store().settings.music.provider, 'qq'); assert.equal(restored.store().settings.music.presets.qq.name, '测试歌单');
  assert.equal(restored.store().settings.voiceCountInterval, 5); assert.deepEqual(restored.store().sessions, []);
  const f = harness(); f.fail(); await assert.rejects(f.execute('write_music_settings', { provider: 'qq' }), /disk/);
  assert.equal(f.settings().music, undefined);
});
test('one-off provider selection never rewrites the saved default', async () => {
  const h = harness(); await h.execute('open_music', { provider: 'qq', operationKey: 'open-qq' });
  assert.equal(h.calls[0].command.provider, 'qq'); assert.equal(h.settings().music, undefined);
  await h.execute('write_music_settings', { provider: 'qq' });
  await h.execute('open_music', { operationKey: 'open-default' }); assert.equal(h.calls.at(-1).command.provider, 'qq');
});
test('model-chosen search text and UI controls pass through unchanged, not through phrase rules', async () => {
  const h = harness();
  for (const text of ['今天想听点不一样的 / instrumental', '周杰伦 晴天 Live 2004', '夜跑 · 我收藏的第一个歌单']) {
    await h.execute('music_ui_action', { operationKey: text, action: 'set_text', snapshotId: 'real-screen', nodeId: 'n7', text });
    assert.equal(h.calls.at(-1).command.text, text); assert.equal(h.calls.at(-1).command.nodeId, 'n7');
  }
  const result = await h.execute('read_music_screen', { offset: 200 }); assert.equal(result.offset, 200);
  assert.throws(() => changeMusicPreferences(undefined, { preset: { name: 42 } }));
  await assert.rejects(h.execute('read_music_screen', { offset: -1 }));
});
test('already-cancelled requests do not dispatch, and in-flight cancellation is scoped to the attempt', async () => {
  const h = harness(), controller = new AbortController(); controller.abort();
  await assert.rejects(h.execute('open_music', { operationKey: 'never' }, controller.signal), /取消/); assert.deepEqual(h.calls, []);
  let release; h.transport.execute = async () => new Promise(resolve => { release = resolve; });
  const active = new AbortController(), pending = h.execute('open_music', { operationKey: 'pending' }, active.signal);
  active.abort(); release({ ok: true, status: 'opened' }); await assert.rejects(pending, /取消/);
  assert.deepEqual(h.calls, [{ cancel: 'attempt-1' }]);
});
test('tool results never turn an accepted UI action into verified playback', async () => {
  const h = harness(); const result = await h.execute('music_ui_action', { operationKey: 'tap', action: 'click', snapshotId: 'real-screen', nodeId: 'n7' });
  assert.equal(result.verifiedPlaying, false);
  assert.equal((await h.execute('read_music_playback', {})).verifiedPlaying, true);
  await assert.rejects(h.execute('open_music', {}), /operationKey/);
});
test('model can use advertised session search separately from unsupported search intents', async () => {
  const h = harness(), { musicTools } = await import('../src/music/modelTools.mjs');
  const descriptor = musicTools.find(tool => tool.function.name === 'control_music');
  assert.ok(descriptor.function.parameters.properties.action.enum.includes('play_from_search'));
  assert.ok(descriptor.function.parameters.properties.action.enum.includes('play_from_media_id'));
  const result = await h.execute('control_music', { operationKey: 'session-search', action: 'play_from_search', query: 'Take Me To Your Heart', artist: 'Michael Learns To Rock' });
  assert.equal(h.calls[0].command.query, 'Take Me To Your Heart'); assert.equal(h.calls[0].command.artist, 'Michael Learns To Rock'); assert.equal(result.verifiedPlaying, false);
  await h.execute('control_music', { operationKey: 'session-id', action: 'play_from_media_id', mediaId: 'real-client-id' }); assert.equal(h.calls[1].command.mediaId, 'real-client-id');
  await assert.rejects(h.execute('control_music', { operationKey: 'bad-id', action: 'play_from_media_id', mediaId: 123 }), /mediaId/);
  await h.execute('control_music', { operationKey: 'any-music', action: 'play_from_search', query: '' }); assert.equal(h.calls.at(-1).command.query, '', 'A platform-valid empty query is the model decision, not a code keyword rule.');
});
test('model tool loop supports a model-planned music UI workflow without a fixed keyword dispatcher', async () => {
  const { personalChat } = await import('../src/integrations/personalTools.mjs'); const h = harness();
  const steps = [ ['read_music_settings', {}], ['open_music', { operationKey: 'open' }], ['read_music_screen', {}], ['music_ui_action', { action: 'set_text', snapshotId: 'real-screen', nodeId: 'n7', text: '模型自主选择的爵士乐', operationKey: 'search' }], ['read_music_screen', {}], ['music_ui_action', { action: 'click', snapshotId: 'real-screen', nodeId: 'n7', operationKey: 'choose' }], ['read_music_playback', {}] ];
  let round = 0;
  const answer = await personalChat({ date: '2026-10-13', messages: [{ role: 'user', content: '换点适合现在心情的声音吧' }], execute: h.execute, client: { generate: async (messages, options) => {
    assert.ok(options.tools.some(tool => tool.function.name === 'read_music_screen'));
    assert.match(messages[0].content, /由你自主理解意图/);
    if (round === steps.length) { assert.equal(JSON.parse(messages.at(-1).content).status, 'playing'); return { content: '播放器报告正在播放真实歌曲。' }; }
    const [name, input] = steps[round++]; return { role: 'assistant', content: null, tool_calls: [{ id: String(round), type: 'function', function: { name, arguments: JSON.stringify(input) } }] };
  } } });
  assert.match(answer, /真实歌曲/); assert.equal(h.calls[1].command.text, '模型自主选择的爵士乐');
});
test('clearing local data also clears our music receipts and consent, not either third-party library', async () => {
  let cleared = 0; const h = repositoryHarness({ initial: { unrelated: 'music app data' }, effects: { clearMusic: async () => { cleared++; } } }); await h.load(); await h.store().clearData();
  assert.equal(cleared, 1); assert.equal(h.disk.get('unrelated'), 'music app data'); assert.equal(h.store().settings.music.provider, 'netease');
  const module = read('modules/uncover-music/android/src/main/java/uncover/music/UncoverMusicModule.kt');
  const clear = module.slice(module.indexOf('internal fun clearState()'), module.indexOf('internal fun executeRequest'));
  assert.ok(clear.indexOf('MusicExecutionService.cancelActive()') < clear.indexOf('MusicLedger.clear(context)'));
  const service = read('modules/uncover-music/android/src/main/java/uncover/music/MusicExecutionService.kt');
  assert.match(service, /fun cancelActive\(\) \{ instance\?\.cancelExecution\(\) \}/);
  assert.match(service, /private fun cancelExecution\(\)[\s\S]*?MusicLedger.cancel\(executionId\)[\s\S]*?onCancelled\?\.invoke\(executionId\)/);
});
test('Android interfaces use exact app scope, explicit user consent and real controls; no hardcoded tap coordinates', () => {
  const service = read('modules/uncover-music/android/src/main/java/uncover/music/MusicAccessibilityService.kt');
  const ui = read('modules/uncover-device/android/src/main/java/uncover/device/PhoneUi.kt');
  const manifest = read('modules/uncover-music/android/src/main/AndroidManifest.xml');
  const ledger = read('modules/uncover-music/android/src/main/java/uncover/music/MusicLedger.kt');
  assert.match(service, /PhoneAccessibilityService/); assert.match(service, /packageName = MusicPolicy.packageFor\(provider\)/);
  assert.match(ui, /node\.isPassword/); assert.match(ui, /fingerprint\(node\) != anchor\.fingerprint/);
  assert.match(ui, /area\.exactCenterX/); assert.doesNotMatch(ui, /moveTo\(\s*\d/);
  assert.match(manifest, /BIND_ACCESSIBILITY_SERVICE/); assert.match(manifest, /BIND_NOTIFICATION_LISTENER_SERVICE/); assert.doesNotMatch(manifest, /QUERY_ALL_PACKAGES|READ_CONTACTS|RECORD_AUDIO/);
  assert.match(ledger, /uncertain_operation/); assert.match(ledger, /replayed/);
  assert.doesNotMatch(read('src/music/agentRuntime.ts'), /includes\(['"]听歌|test\(.*听歌/);
  assert.match(read('src/music/transport.ts'), /native_required/);
});
test('keyboard-null root and touch-only controls stay usable without reading background apps', async () => {
  const service = read('modules/uncover-device/android/src/main/java/uncover/device/PhoneUi.kt');
  assert.doesNotMatch(service, /val active = rootInActiveWindow \?: return null/);
  assert.match(service, /active == null \|\| it.id == active.windowId/);
  assert.match(service, /apps\.filter \{ it.isFocused \|\| it.isActive \}/);
  assert.match(service, /\.put\("focused", node.isFocused\)/);
  assert.match(service, /"tap" -> touch\(\)/);
  const { musicTools } = await import('../src/music/modelTools.mjs');
  assert.ok(musicTools.find(tool => tool.function.name === 'music_ui_action').function.parameters.properties.action.enum.includes('tap'));
  const h = harness(); await h.execute('music_ui_action', { operationKey: 'actual-touch', snapshotId: 'real-screen', nodeId: 'n7', action: 'tap' });
  assert.equal(h.calls[0].command.action, 'tap'); assert.equal(h.calls[0].command.nodeId, 'n7');
});
