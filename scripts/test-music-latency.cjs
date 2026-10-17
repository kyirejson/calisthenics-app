const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
require('./lib/register-typescript.cjs')();
const { createMusicRuntime } = require('../src/music/agentRuntime.ts');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
function harness() {
  const calls = [], receipts = new Map();
  const screen = { ok: true, snapshotId: 'fresh', nodes: [{ nodeId: 'observed-1', text: '真实歌单' }] };
  const playback = { ok: true, status: 'playing', title: '真实歌曲', verifiedPlaying: true, playlistVerified: false };
  const transport = {
    capabilities: async provider => ({ provider, installed: true }), playback: async () => playback,
    execute: async (_, command) => { calls.push(command); return { ok: true, status: 'acted', verifiedPlaying: false }; },
    executeAndObserve: async (request, command, execution) => {
      const key = request + command.operationKey;
      let action = receipts.get(key);
      if (!action) { calls.push({ command, request, execution }); action = { ok: true, status: 'acted', verifiedPlaying: false }; receipts.set(key, action); }
      else action = { ...action, replayed: true };
      return { ok: action.ok, action, screen, playback };
    }, cancel: async execution => { calls.push({ cancel: execution }); },
  };
  return { calls, transport, execute: createMusicRuntime(transport, { requestId: 'user-1', executionId: 'attempt-1', readSettings: () => ({}), updateSettings: async () => {} }) };
}
test('fused descriptors preserve every fine-grained model option without navigation scripts', async () => {
  const { musicTools } = await import('../src/music/modelTools.mjs');
  for (const original of ['open_music', 'music_ui_action', 'control_music']) {
    const a = musicTools.find(x => x.function.name === original), b = musicTools.find(x => x.function.name === original + '_and_observe');
    assert.deepEqual(b.function.parameters, a.function.parameters);
  }
});
test('fused tools pass the same canonical model command; replay returns observations without another click', async () => {
  const h = harness(), args = { operationKey: 'click-1', snapshotId: 'actual', nodeId: 'actual-node', action: 'tap', provider: 'qq' };
  const first = await h.execute('music_ui_action_and_observe', args);
  assert.deepEqual(h.calls[0].command, { ...args, type: 'ui' });
  assert.equal(h.calls[0].execution, 'attempt-1');
  assert.equal(first.action.verifiedPlaying, false); assert.equal(first.playback.verifiedPlaying, true);
  assert.equal(first.playback.playlistVerified, false);
  assert.equal((await h.execute('music_ui_action_and_observe', args)).action.replayed, true); assert.equal(h.calls.length, 1);
});
test('partial observation failure does not turn an accepted action into a retry or hide its receipt', async () => {
  const h = harness(); h.transport.executeAndObserve = async () => ({ ok: true, action: { ok: true, status: 'opened' }, screen: { ok: false, code: 'background_screen_unavailable' }, playback: { ok: false, code: 'playback_permission_required' } });
  const result = await h.execute('open_music_and_observe', { operationKey: 'open' });
  assert.equal(result.action.status, 'opened'); assert.equal(result.screen.ok, false); assert.equal(result.playback.ok, false); assert.equal(h.calls.length, 0);
});
test('music presets supply actual playback together and tolerate observation authorization failure', async () => {
  const h = harness(); assert.equal((await h.execute('read_music_settings', {})).playback.title, '真实歌曲');
  h.transport.playback = async () => { throw Error('尚未授权'); };
  const result = await h.execute('read_music_settings', {}); assert.equal(result.ok, true); assert.equal(result.playback.ok, false); assert.equal(result.capabilities.length, 2);
});
test('fused cancellation is still scoped and malformed arguments never execute', async () => {
  const h = harness(); await assert.rejects(h.execute('open_music_and_observe', { operationKey: 'a', query: 1 }), /query/);
  let release; h.transport.executeAndObserve = () => new Promise(resolve => { release = resolve; });
  const controller = new AbortController(), pending = h.execute('control_music_and_observe', { operationKey: 'pause', action: 'pause' }, controller.signal);
  controller.abort(); release({ ok: true, action: { status: 'dispatched' } }); await assert.rejects(pending, /取消/);
  assert.deepEqual(h.calls, [{ cancel: 'attempt-1' }]);
});
test('interruption preserves a dispatched music receipt but prevents all following model and tool calls', async () => {
  const { personalChat } = await import('../src/integrations/personalTools.mjs');
  const h = harness(), controller = new AbortController(), receipts = [];
  let release, generations = 0;
  h.transport.executeAndObserve = () => new Promise(resolve => { release = resolve; });
  const execute = createMusicRuntime(h.transport, { requestId: 'user-1', executionId: 'attempt-1', readSettings: () => ({}), updateSettings: async () => {}, onInterruptedResult: call => receipts.push(call) });
  const pending = personalChat({ date: '2026-10-15', signal: controller.signal, messages: [{ role: 'user', content: '换一首歌' }], execute,
    onToolResult: call => receipts.push(call), client: { generate: async () => {
      generations++;
      return { tool_calls: [
        { id: 'first', function: { name: 'control_music_and_observe', arguments: JSON.stringify({ operationKey: 'next', action: 'next' }) } },
        { id: 'must-not-run', function: { name: 'open_music_and_observe', arguments: JSON.stringify({ operationKey: 'after-cancel' }) } },
      ] };
    } },
  });
  await new Promise(resolve => setImmediate(resolve));
  controller.abort(); release({ ok: true, action: { ok: true, status: 'dispatched' }, playback: { verifiedPlaying: true } });
  await assert.rejects(pending, /取消/);
  assert.equal(generations, 1); assert.equal(receipts.length, 1); assert.equal(receipts[0].name, 'control_music_and_observe');
  assert.equal(receipts[0].result.action.status, 'dispatched'); assert.equal(receipts[0].result.playback.verifiedPlaying, true);
  assert.deepEqual(h.calls, [{ cancel: 'attempt-1' }]);
  assert.match(read('src/integrations/runAgentTurn.ts'), /onInterruptedToolResult: interrupted/);
  assert.match(read('src/integrations/runAgentTurn.ts'), /interrupted\(call\)/);
});
test('the same model-planned three actions need four tool rounds instead of seven separate observations', async () => {
  const { personalChat } = await import('../src/integrations/personalTools.mjs'), h = harness();
  const steps = [['read_music_settings', {}], ['open_music_and_observe', { operationKey: 'open' }], ['music_ui_action_and_observe', { operationKey: 'search', action: 'set_text', snapshotId: 'fresh', nodeId: 'observed-1', text: '由模型自主决定的版本' }], ['music_ui_action_and_observe', { operationKey: 'choose', action: 'click', snapshotId: 'fresh', nodeId: 'observed-1' }]];
  let round = 0;
  const result = await personalChat({ date: '2026-10-14', messages: [{ role: 'user', content: '播放适合现在心情的歌' }], execute: h.execute, client: { generate: async (history, options) => {
    assert.ok(options.tools.some(x => x.function.name === 'music_ui_action_and_observe'));
    if (round === steps.length) { assert.equal(JSON.parse(history.at(-1).content).playback.status, 'playing'); return { content: '播放器报告正在播放。' }; }
    const [name, input] = steps[round++]; return { tool_calls: [{ id: String(round), type: 'function', function: { name, arguments: JSON.stringify(input) } }] };
  } } });
  assert.equal(round, 4); assert.equal(h.calls.length, 3); assert.match(result, /播放器/);
});
test('native observation is cancellable, bounded, parallel, cleans subscriptions and keeps receipts separate', () => {
  const module = read('modules/uncover-music/android/src/main/java/uncover/music/UncoverMusicModule.kt');
  assert.doesNotMatch(module, /delay\(450\)/); assert.match(module, /executeAndObserve/); assert.match(module, /finally \{ playback.close\(\) \}/);
  assert.match(module, /val screenResult = async/); assert.match(module, /val playbackResult = async/);
  const playback = read('modules/uncover-music/android/src/main/java/uncover/music/MusicPlaybackObservation.kt');
  assert.match(playback, /onPlaybackStateChanged/); assert.match(playback, /onMetadataChanged/); assert.match(playback, /removeOnActiveSessionsChangedListener/); assert.match(playback, /unregisterCallback/);
  const service = read('modules/uncover-music/android/src/main/java/uncover/music/MusicAccessibilityService.kt');
  const shared = read('modules/uncover-device/android/src/main/java/uncover/device/PhoneUi.kt');
  assert.match(service, /phoneUi.awaitScreen/); assert.match(service, /MusicObservationPolicy::ready/);
  assert.match(shared, /if \(cancelled\(\)\)/); assert.match(shared, /no_event_fallback/);
});
