const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
require('./lib/register-typescript.cjs')();
const { createVoiceDialogue } = require('../src/voice/dialogue.ts');
const { createAgentConversation } = require('../src/agent/conversation.ts');
test('voice and text use the same tool runner and repository instead of keyword music/meal routes', () => {
  const chat = read('src/features/chat/useChatSession.ts'), voice = read('src/voice/agentTask.ts'), runner = read('src/integrations/runAgentTurn.ts');
  assert.match(chat, /runAgentTurn\(/); assert.doesNotMatch(chat, /await personalChat\(/);
  assert.match(voice, /runAgentTurn\(/); assert.match(voice, /appRepository/);
  assert.match(read('src/store/AppStore.tsx'), /const repository = appRepository/);
  assert.match(runner, /executePersonalTool/); assert.match(runner, /musicReceipts/); assert.match(runner, /applyMealOperations/);
  assert.doesNotMatch(voice, /includes\(['"]听歌|test\(.*听歌|includes\(['"]早餐/);
});
test('voice requests are revocable, have real identities, no automatic redelivery, and cannot resurrect after stop', () => {
  const voice = read('src/voice/dialogue.ts'), service = read('modules/uncover-voice/android/src/main/java/uncover/voice/BlackVoiceService.kt');
  assert.match(voice, /dependencies.active/); assert.match(voice, /controller.abort/); assert.match(voice, /clearInterval/);
  assert.match(voice, /conversation.begin/); assert.doesNotMatch(voice, /let messages|session !== input.sessionId/); assert.match(service, /UUID.randomUUID/); assert.match(service, /requestId == id/);
  assert.match(service, /generation != token/); assert.match(service, /listening = false/);
  assert.match(read('modules/uncover-voice/android/src/main/java/uncover/voice/VoiceAgentTaskService.kt'), /START_NOT_STICKY/);
});
function dialogueHarness() {
  const calls = [], replies = []; let active = true;
  const storage = new Map(); const conversation = createAgentConversation({ getItem: async key => storage.get(key) || null, setItem: async (key, value) => storage.set(key, value), removeItem: async key => storage.delete(key) });
  const dependencies = { conversation, cancel: async () => {}, active: async () => active, reply: async (id, text) => { replies.push({ id, text }); }, subscribeReset: () => () => {}, turn: async input => { calls.push(input); return '真实模型回答'; } };
  return { dependencies, calls, replies, stop: () => { active = false; }, task: createVoiceDialogue(dependencies) };
}
test('actual voice dialogue forwards unrestricted transcripts and shares context across native activations', async () => {
  const h = dialogueHarness();
  await h.task({ requestId: 'a', sessionId: 's', text: '用网易云听我喜欢的歌，然后分析早餐' });
  assert.equal(h.calls[0].messages[0].content, '用网易云听我喜欢的歌，然后分析早餐');
  await h.task({ requestId: 'b', sessionId: 's', text: '你刚才说的是什么意思' }); assert.equal(h.calls[1].messages.length, 3);
  await h.task({ requestId: 'c', sessionId: 'new', text: '新的唤醒' }); assert.equal(h.calls[2].messages.length, 5);
});
test('inactive requests and silence do not enter model or emit speech', async () => {
  const h = dialogueHarness(); h.stop();
  await h.task({ requestId: 'a', sessionId: 's', text: '尚未执行' }); await h.task({ requestId: 'b', sessionId: 's', text: '  ' });
  assert.equal(h.calls.length, 0); assert.equal(h.replies.length, 0);
});
test('stopped and superseded requests never announce stale model results', async () => {
  const h = dialogueHarness(); let release;
  h.dependencies.turn = input => { h.calls.push(input); return new Promise(resolve => { release = resolve; }); };
  const first = h.task({ requestId: 'a', sessionId: 's', text: '旧请求' }); await new Promise(resolve => setImmediate(resolve));
  h.stop(); release('不能播报的旧回答'); await first; assert.equal(h.replies.length, 0); assert.equal(h.dependencies.conversation.getSnapshot().generating, false);
});
test('clear-context voice command clears session messages without invoking a model or deleting records', async () => {
  const h = dialogueHarness(); await h.task({ requestId: 'a', sessionId: 's', text: '上文' });
  await h.task({ requestId: 'clear', sessionId: 's', text: '清空上下文' }); assert.equal(h.calls.length, 1);
  await h.task({ requestId: 'b', sessionId: 's', text: '新问题' }); assert.equal(h.calls[1].messages.length, 1);
});
test('wake uses local BLACK phonemes and packaged acknowledgement; microphone requires explicit permission and service consent', () => {
  const manifest = read('modules/uncover-voice/android/src/main/AndroidManifest.xml'), module = read('modules/uncover-voice/android/src/main/java/uncover/voice/UncoverVoiceModule.kt');
  assert.match(manifest, /FOREGROUND_SERVICE_MICROPHONE/); assert.match(manifest, /BIND_VOICE_INTERACTION/); assert.doesNotMatch(manifest, /RECEIVE_BOOT_COMPLETED|QUERY_ALL_PACKAGES/);
  assert.match(module, /RECORD_AUDIO/); assert.match(module, /appContext.currentActivity == null/);
  assert.match(module, /ACTION_VOICE_INPUT_SETTINGS/); assert.match(module, /ACTION_MANAGE_DEFAULT_APPS_SETTINGS/);
  assert.doesNotMatch(module, /createRequestRoleIntent/);
  assert.match(read('modules/uncover-voice/android/src/main/assets/black-voice/keywords.txt'), /^B L AE1 K @BLACK/m);
  assert.match(read('modules/uncover-voice/android/src/main/java/uncover/voice/VoiceSpeaker.kt'), /black-voice\/iam.wav/);
  const engine = read('modules/uncover-voice/android/src/main/java/uncover/voice/VoiceAudioEngine.kt');
  assert.match(engine, /KeywordSpotter/); assert.match(engine, /OnlineRecognizer/); assert.doesNotMatch(engine, /http|FileOutputStream/);
});
test('voice completion does not bring the app UI to the foreground and storage clear stops listening', () => {
  assert.match(read('src/voice/agentTask.ts'), /restoreUi: false/);
  assert.match(read('src/integrations/runAgentTurn.ts'), /finishWithoutUi/);
  assert.match(read('src/store/runtime.ts'), /voiceTransport.clear/);
});
test('source resources are integrity pinned and self-contained acknowledgement has a valid WAV header', () => {
  const { artifacts } = require('./prepare-voice-resources.cjs');
  assert.equal(artifacts.length, 5); artifacts.forEach(item => { assert.match(item.sha256, /^[a-f0-9]{64}$/); assert.match(item.url, /^https:\/\/(github.com\/k2-fsa\/sherpa-onnx\/releases\/download\/|downloads.xiph.org\/releases\/speex\/)/); });
  const audio = fs.readFileSync(path.join(__dirname, '../modules/uncover-voice/android/src/main/assets/black-voice/iam.wav'));
  assert.equal(audio.subarray(0, 4).toString(), 'RIFF'); assert.equal(audio.subarray(8, 12).toString(), 'WAVE'); assert.ok(audio.length > 1000);
});
test('real voice runner streams text and progress into the UI conversation before playback', async () => {
  const h = dialogueHarness();
  h.dependencies.turn = async input => {
    input.onRoundStart(); input.onDelta('第一句。', '第一句。');
    assert.equal(h.dependencies.conversation.getSnapshot().turns[1].content, '第一句。');
    assert.equal(h.replies.length, 0);
    return '第一句。第二句。';
  };
  await h.task({ requestId: 'stream', sessionId: 's', text: '讲一下' });
  assert.equal(h.dependencies.conversation.getSnapshot().turns[1].content, h.replies[0].text);
});
test('voice errors are displayed and spoken without cancelling their own error delivery', async () => {
  const h = dialogueHarness(); h.dependencies.turn = async () => { throw Error('连接超时，请重试。'); };
  await h.task({ requestId: 'error', sessionId: 's', text: '测试错误' });
  assert.equal(h.replies[0].text, '连接超时，请重试。'); assert.equal(h.dependencies.conversation.getSnapshot().turns[1].content, h.replies[0].text);
});
test('new audio implementation cannot discard every speaking-mode microphone frame or send ambient PCM away', () => {
  const engine = read('modules/uncover-voice/android/src/main/java/uncover/voice/VoiceAudioEngine.kt'), speaker = read('modules/uncover-voice/android/src/main/java/uncover/voice/VoiceSpeaker.kt');
  assert.match(engine, /vad.compute/); assert.match(engine, /echo.process/); assert.match(engine, /reference.frame/); assert.match(engine, /preRoll.forEach/); assert.match(engine, /barge\(\)/);
  assert.doesNotMatch(engine, /if \(state == "speaking"\) continue|https?:|FileOutputStream|我在/);
  assert.match(speaker, /synthesizeToFile/); assert.match(speaker, /AudioTrack/); assert.doesNotMatch(speaker, /tts\?\.speak\(/);
});

test('static playback loads PCM before demanding ready state, and real Android tests assert successful rendering', () => {
  const speaker = read('modules/uncover-voice/android/src/main/java/uncover/voice/VoiceSpeaker.kt');
  const write = speaker.indexOf('val written = output.write(');
  assert.ok(write > 0);
  assert.ok(speaker.indexOf('check(output.state != AudioTrack.STATE_UNINITIALIZED)') < write);
  assert.ok(speaker.indexOf('check(output.state == AudioTrack.STATE_INITIALIZED)') > write);
  assert.ok(speaker.indexOf('output.play()', write) > write);
  const playback = read('modules/uncover-voice/android/src/androidTest/java/uncover/voice/VoiceSpeakerPlaybackTest.kt');
  assert.match(playback, /STATE_NO_STATIC_DATA/); assert.match(playback, /VoiceSpeaker\(/);
  assert.match(playback, /assertNull\("Acknowledgement failed/);
  assert.match(read('scripts/check-android-native.ps1'), /:uncover-voice:connectedDebugAndroidTest/);
});
