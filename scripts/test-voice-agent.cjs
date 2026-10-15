const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
require('./lib/register-typescript.cjs')();
const { createVoiceDialogue } = require('../src/voice/dialogue.ts');
const { createAgentConversation } = require('../src/agent/conversation.ts');
function dialogueHarness() {
  const calls = [], replies = []; let active = true;
  const storage = new Map(); const conversation = createAgentConversation({ getItem: async key => storage.get(key) || null, setItem: async (key, value) => storage.set(key, value), removeItem: async key => storage.delete(key) });
  const dependencies = { conversation, cancel: async () => {}, active: async () => active, reply: async (id, text) => { replies.push({ id, text }); }, subscribeReset: () => () => {}, turn: async input => { calls.push(input); return '真实模型回答'; } };
  return { dependencies, calls, replies, stop: () => { active = false; }, task: createVoiceDialogue(dependencies) };
}
test('voice and text use the same tool runner and repository instead of keyword music/meal routes', () => {
  const chat = read('src/features/chat/useChatSession.ts'), voice = read('src/voice/agentTask.ts'), runner = read('src/integrations/runAgentTurn.ts');
  assert.match(chat, /runAgentTurn\(/); assert.doesNotMatch(chat, /await personalChat\(/);
  assert.match(voice, /runAgentTurn\(/); assert.match(voice, /appRepository/);
  assert.match(read('src/store/AppStore.tsx'), /const repository = appRepository/);
  assert.match(runner, /executePersonalTool/); assert.match(runner, /musicReceipts/); assert.match(runner, /applyMealOperations/);
  assert.doesNotMatch(voice, /includes\(['"]听歌|test\(.*听歌|includes\(['"]早餐/);
});

test('actual voice dialogue forwards unrestricted transcripts and shares context across native activations', async () => {
  const h = dialogueHarness();
  await h.task({ requestId: 'a', sessionId: 's', text: '用网易云听我喜欢的歌，然后分析早餐' });
  assert.equal(h.calls[0].messages[0].content, '用网易云听我喜欢的歌，然后分析早餐');
  await h.task({ requestId: 'b', sessionId: 's', text: '你刚才说的是什么意思' }); assert.equal(h.calls[1].messages.filter(m => m.role !== 'system').length, 3);
  await h.task({ requestId: 'c', sessionId: 'new', text: '新的唤醒' }); assert.equal(h.calls[2].messages.filter(m => m.role !== 'system').length, 5);
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

test('voice completion does not bring the app UI to the foreground and storage clear stops listening', () => {
  assert.match(read('src/voice/agentTask.ts'), /restoreUi: false/);
  assert.match(read('src/integrations/runAgentTurn.ts'), /finishWithoutUi/);
  assert.match(read('src/store/runtime.ts'), /voiceTransport.clear/);
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

test('model may explicitly keep listening without speech, a blank bubble, lost context or duplicate tools', async () => {
  const { personalChat } = await import('../src/integrations/personalTools.mjs');
  const h = dialogueHarness(); let generated = 0;
  h.dependencies.turn = input => personalChat({ responseMode: 'voice', messages: input.messages, date: '2026-10-15', ...input,
    client: { generate: async () => { generated++; return { role: 'assistant', tool_calls: [{ id: 'listen', function: { name: 'continue_listening', arguments: '{"reason":"用户尚未说完"}' } }] }; } },
    execute: async () => { throw Error('Listening control must not reach data tools'); },
  });
  await h.task({ requestId: 'listen', sessionId: 's', text: '那个，我想想' });
  assert.equal(generated, 1); assert.equal(h.replies[0].text, '');
  assert.equal(h.dependencies.conversation.getSnapshot().turns[1].status, 'silent');
  assert.equal(h.dependencies.conversation.getSnapshot().error, '');
  await h.task({ requestId: 'listen', sessionId: 's', text: '那个，我想想' }); assert.equal(generated, 1);
  h.dependencies.turn = async input => { assert.ok(input.messages.some(m => m.role === 'tool' && JSON.parse(m.content).listening)); return '可以。'; };
  await h.task({ requestId: 'next', sessionId: 's', text: '继续聊吧' }); assert.equal(h.replies[1].text, '可以。');
});

test('silence is an additional voice tool, not a text intent filter, response truncation or invalid-response fallback', async () => {
  const { personalChat, personalTools } = await import('../src/integrations/personalTools.mjs');
  const invoke = (responseMode, reply) => personalChat({ date: '2026-10-15', responseMode, messages: [{ role: 'user', content: '任意请求' }],
    client: { generate: async (_history, options) => {
      assert.deepEqual(options.tools.slice(0, personalTools.length), personalTools);
      assert.equal(options.tools.some(t => t.function.name === 'continue_listening'), responseMode === 'voice'); return reply;
    } }, execute: async () => ({ ok: true }),
  });
  await assert.rejects(invoke('voice', { content: '' }), /模型未返回有效内容/);
  assert.equal(await invoke('text', { content: '我在'.repeat(1000) }), '我在'.repeat(1000));
  assert.equal(await invoke('voice', { content: '我在。' }), '我在。');
});

test('keep-listening never skips other authorized effects in the same tool batch', async () => {
  const { personalChat } = await import('../src/integrations/personalTools.mjs'); const executed = [], receipts = []; let round = 0;
  const answer = await personalChat({ date: '2026-10-15', responseMode: 'voice', messages: [],
    client: { generate: async history => {
      if (round++) {
        assert.match(history.at(-1).content, /真实工具失败/);
        return { role: 'assistant', tool_calls: [{ id: 'finish', function: { name: 'continue_listening', arguments: '{"reason":"我已核对执行结果，自主决定继续听用户"}' } }] };
      }
      return { role: 'assistant', tool_calls: [
      { id: 'listen', function: { name: 'continue_listening', arguments: '{"reason":"无需出声"}' } },
      { id: 'record', function: { name: 'write_meal_records', arguments: '{}' } },
    ] }; } }, execute: async name => { executed.push(name); return { ok: false, error: '真实工具失败' }; }, onToolResult: result => receipts.push(result),
  });
  assert.equal(answer, ''); assert.deepEqual(executed, ['write_meal_records']); assert.equal(receipts.length, 3); assert.equal(round, 2);
  assert.equal(receipts[0].result.pendingReview, true);
});

test('a late native ownership poll cannot cancel an answer after it transfers to playback or listening', async () => {
  const originalInterval = global.setInterval;
  try {
    for (const answer of ['我在。', '']) {
      let poll, pending = false, resolvePoll, seen;
      global.setInterval = callback => { poll = callback; return 0; };
      const h = dialogueHarness();
      h.dependencies.active = () => pending ? new Promise(resolve => { pending = false; resolvePoll = resolve; }) : Promise.resolve(true);
      h.dependencies.turn = async input => { seen = input.controller; pending = true; poll(); return answer; };
      h.dependencies.reply = async () => { resolvePoll(false); await new Promise(resolve => setImmediate(resolve)); };
      await h.task({ requestId: 'handoff', sessionId: 's', text: 'BLACK' });
      assert.equal(seen.signal.aborted, false);
      assert.equal(h.dependencies.conversation.getSnapshot().turns[1].status, answer ? 'complete' : 'silent');
    }
  } finally { global.setInterval = originalInterval; }
});
test('initialization completes before the first model turn and wake metadata does not invent identity', async () => {
  const h = dialogueHarness(); let ready = false;
  h.dependencies.prepare = async () => { ready = true; };
  h.dependencies.turn = async input => {
    assert.equal(ready, true);
    const metadata = JSON.parse(input.messages[0].content);
    assert.equal(metadata.wakeDetected, true); assert.equal('ownerVerified' in metadata, false);
    return '我在。';
  };
  await h.task({ requestId: 'wake', sessionId: 's', text: 'BLACK', wake: true });
  assert.equal(h.replies.length, 1);
});
test('production has no enrollment or phone TTS fallback and pins the bundled local model', () => {
  const native = name => read('modules/uncover-voice/android/src/main/java/uncover/voice/' + name + '.kt');
  assert.doesNotMatch(native('VoiceAudioEngine'), /VoiceIdentity|SpeakerEmbeddingExtractor|enroll|VoiceOwnerStore/);
  assert.doesNotMatch(native('UncoverVoiceModule'), /enrollOwner|VoiceOwnerStore/);
  assert.doesNotMatch(native('VoiceSpeaker'), /android.speech.tts|synthesizeToFile|TextToSpeech/);
  assert.match(native('VoiceSpeaker'), /OfflineTts|LocalVoiceSynthesizer/);
  assert.match(native('VoicePcmPlayer'), /MODE_STREAM/);
  assert.doesNotMatch(native('VoicePcmPlayer'), /MODE_STATIC/);
  assert.match(native('VoiceCaptureDriver'), /ArrayBlockingQueue/);
  const { artifacts } = require('./prepare-voice-resources.cjs');
  assert.ok(artifacts.some(a => a.files?.['model.onnx'] === 'tts/model.onnx'));
  assert.ok(!artifacts.some(a => /campplus/.test(a.name)));
  for (const name of ['VoiceIdentity','VoiceBiometrics','VoiceOwnerStore','VoiceRegistrationGate','VoicePacketGate'])
    assert.equal(fs.existsSync(path.join(__dirname, '../modules/uncover-voice/android/src/main/java/uncover/voice/' + name + '.kt')), false);
});
