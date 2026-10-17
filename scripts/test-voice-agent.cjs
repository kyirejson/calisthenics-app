const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
require('./lib/register-typescript.cjs')();
const { createVoiceDialogue } = require('../src/voice/dialogue.ts');
const { createAgentConversation } = require('../src/agent/conversation.ts');
function dialogueHarness() {
  const calls = [], replies = [], standbys = []; let active = true;
  const cancellations = new Map();
  const storage = new Map(); const conversation = createAgentConversation({ getItem: async key => storage.get(key) || null, setItem: async (key, value) => storage.set(key, value), removeItem: async key => storage.delete(key) });
  const dependencies = { conversation, cancel: async () => {}, active: async () => active, reply: async (id, text) => { replies.push({ id, text }); },
    standby: async id => { standbys.push(id); active = false; return true; }, subscribeReset: () => () => {},
    subscribeCancellation: (id, cancel) => { cancellations.set(id, cancel); return () => cancellations.delete(id); },
    turn: async input => { calls.push(input); return '真实模型回答'; } };
  // Fixtures may inspect current input; production gets only the bound canonical journal.
  let turn = dependencies.turn;
  Object.defineProperty(dependencies, 'turn', { get: () => input => turn({ ...input, messages: conversation.messages({ id: input.requestId }) }), set: value => { turn = value; } });
  return { dependencies, calls, replies, standbys, stop: () => { active = false; }, wake: () => { active = true; }, cancel: id => { active = false; cancellations.get(id)?.(); }, task: createVoiceDialogue(dependencies) };
}
test('voice and text use the same tool runner and repository instead of keyword music/meal routes', () => {
  const chat = read('src/features/chat/useChatSession.ts'), voice = read('src/voice/agentTask.ts'), runner = read('src/integrations/runAgentTurn.ts');
  assert.match(chat, /runAgentTurn\(/); assert.doesNotMatch(chat, /await personalChat\(/);
  assert.match(voice, /runAgentTurn\(/); assert.match(voice, /appRepository/);
  assert.match(read('src/store/AppStore.tsx'), /const repository = appRepository/);
  assert.match(runner, /executePersonalTool/); assert.match(runner, /musicReceipts/); assert.match(runner, /applyMealOperations/);
  assert.doesNotMatch(voice, /includes\(['"]听歌|test\(.*听歌|includes\(['"]早餐/);
});
test('chat configuration hydration cannot act as a second owner of voice cancellation', () => {
  const chat = read('src/features/chat/useChatSession.ts');
  assert.match(chat, /subscribeConnectionChanges\(/);
  assert.doesNotMatch(chat, /subscribeConnection\(|agentConversation\.interrupt\(\)/);
  assert.match(chat, /if \(request\.current\).*agentConversation\.interrupt\(messageRequest\.current\?\.id\)/);
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
      assert.equal(options.tools.some(t => t.function.name === 'continue_listening'), true); return reply;
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

test('native ownership handoff does not poll or cancel a synthesized or silent answer', async () => {
  const originalInterval = global.setInterval;
  try {
    for (const answer of ['我在。', '']) {
      let seen;
      global.setInterval = () => { throw Error('Native snapshots own cancellation; polling is obsolete'); };
      const h = dialogueHarness();
      h.dependencies.turn = async input => { seen = input.controller; return answer; };
      h.dependencies.reply = async () => { h.stop(); await new Promise(resolve => setImmediate(resolve)); };
      await h.task({ requestId: 'handoff', sessionId: 's', text: 'MAX' });
      assert.equal(seen.signal.aborted, false);
      assert.equal(h.dependencies.conversation.getSnapshot().turns[1].status, answer ? 'complete' : 'silent');
    }
  } finally { global.setInterval = originalInterval; }
});
test('a native interruption aborts model work immediately without waiting for an ownership poll', async () => {
  const h = dialogueHarness(); let seen;
  h.dependencies.turn = input => { seen = input.controller; return new Promise((_resolve, reject) => input.controller.signal.addEventListener('abort', () => reject(Error('cancelled')), { once: true })); };
  const pending = h.task({ requestId: 'interrupt', sessionId: 's', text: '正在生成' });
  await new Promise(resolve => setImmediate(resolve)); h.cancel('interrupt');
  assert.equal(seen.signal.aborted, true); await pending;
  assert.equal(h.replies.length, 0); assert.equal(h.dependencies.conversation.getSnapshot().turns[1].status, 'interrupted');
});
test('cancellation during initial storage hydration cannot persist an empty replacement history', async () => {
  const saved = JSON.stringify({ version: 1, turns: [
    { id: 'saved:user', requestId: 'saved', role: 'user', source: 'text', status: 'complete', content: '已有问题' },
    { id: 'saved:assistant', requestId: 'saved', role: 'assistant', source: 'text', status: 'complete', content: '已有回答' },
  ] });
  let release, cancel; const writes = [], replies = [];
  const conversation = createAgentConversation({ getItem: key => key === 'uncover.agent.conversation.v1' ? new Promise(resolve => { release = resolve; }) : Promise.resolve(null), setItem: async (key, value) => writes.push({ key, value }), removeItem: async () => {} });
  const task = createVoiceDialogue({ conversation, active: async () => true, cancel: async () => {}, standby: async () => false,
    reply: async (...args) => replies.push(args), subscribeReset: () => () => {},
    subscribeCancellation: (_id, callback) => { cancel = callback; return () => {}; },
    turn: async () => { throw Error('Cancelled initialization must not call the model'); },
  });
  const pending = task({ requestId: 'initial', sessionId: 's', text: '尚未加载完的输入' });
  await new Promise(resolve => setImmediate(resolve)); cancel(); release(saved); await pending; await conversation.flush();
  assert.equal(writes.some(row => row.key === 'uncover.agent.conversation.v1'), false); assert.equal(replies.length, 0); assert.equal(conversation.getSnapshot().turns[0].content, '已有问题');
});
test('initialization completes before the first model turn and wake metadata does not invent identity', async () => {
  const h = dialogueHarness(); let ready = false;
  h.dependencies.prepare = async () => { ready = true; };
  h.dependencies.turn = async input => {
    assert.equal(ready, true);
    assert.equal(input.wakeDetected, true); assert.equal('ownerVerified' in input, false);
    return '我在。';
  };
  await h.task({ requestId: 'wake', sessionId: 's', text: 'MAX', wake: true });
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

test('model-selected standby ends silently once and the next wake retains context and tools', async () => {
  const { personalChat, personalTools } = await import('../src/integrations/personalTools.mjs');
  const h = dialogueHarness(); let generated = 0, seenController;
  h.dependencies.turn = input => {
    seenController = input.controller;
    return personalChat({ responseMode: 'voice', date: '2026-10-16', ...input,
      client: { generate: async (_messages, options) => {
        generated++; assert.deepEqual(options.tools.slice(0, personalTools.length), personalTools);
        assert.ok(options.tools.some(t => t.function.name === 'end_voice_conversation'));
        return { role: 'assistant', tool_calls: [{ id: 'standby', function: { name: 'end_voice_conversation', arguments: JSON.stringify({ reason: '用户表示这次先聊到这里' }) } }] };
      } }, execute: async () => { throw Error('Session control must not reach data/music tools'); },
    });
  };
  const input = { requestId: 'bye', sessionId: 's', text: '这次先到这里吧，改天再说' };
  await h.task(input);
  assert.deepEqual(h.standbys, ['bye']); assert.equal(h.replies.length, 0); assert.equal(generated, 1);
  assert.equal(seenController.signal.aborted, false);
  const saved = h.dependencies.conversation.getSnapshot();
  assert.equal(saved.turns[0].content, input.text); assert.equal(saved.turns[1].status, 'silent');
  assert.equal(saved.turns[1].receipts[0].result.standbyScheduled, true); assert.equal(saved.generating, false); assert.equal(saved.error, '');
  h.wake(); await h.task(input); assert.equal(generated, 1); assert.equal(h.standbys.length, 1);
  h.dependencies.turn = async input => {
    assert.ok(input.messages.some(m => m.role === 'user' && m.content === '这次先到这里吧，改天再说'));
    assert.ok(input.messages.some(m => m.role === 'tool' && JSON.parse(m.content).standbyScheduled));
    return '我在。';
  };
  await h.task({ requestId: 'wake-again', sessionId: 'new', text: 'MAX', wake: true });
  assert.deepEqual(h.replies, [{ id: 'wake-again', text: '我在。' }]); assert.equal(h.standbys.length, 1);
});

test('dismissal words are forwarded to the model and never matched by the scaffold', async () => {
  const h = dialogueHarness();
  for (const [index, text] of ['“退下吧”是什么意思？', '我刚才让同事先退下吧，你继续说', '退下吧'].entries()) {
    h.dependencies.turn = async input => {
      assert.equal(input.messages.at(-1).content, text);
      return '由模型决定继续回答。';
    };
    await h.task({ requestId: `not-a-keyword-${index}`, sessionId: 's', text });
  }
  assert.equal(h.standbys.length, 0); assert.equal(h.replies.length, 3);
});

test('standby control is voice-only and preserves all existing text/business tools', async () => {
  const { personalChat, personalTools } = await import('../src/integrations/personalTools.mjs');
  let standby = 0;
  for (const responseMode of ['voice', 'text']) {
    await personalChat({ responseMode, messages: [], date: '2026-10-16', endVoiceConversation: async () => { standby++; },
      client: { generate: async (_messages, options) => {
        assert.deepEqual(options.tools.slice(0, personalTools.length), personalTools);
        assert.equal(options.tools.some(t => t.function.name === 'end_voice_conversation'), true);
        return { content: '正常回答，不退出。' };
      } }, execute: async () => ({ ok: true }),
    });
  }
  assert.equal(standby, 0);
});

test('a mixed standby batch waits for all effects and an explicit final model choice', async () => {
  const { personalChat } = await import('../src/integrations/personalTools.mjs');
  const effects = [], receipts = []; let generated = 0, standby = 0;
  const answer = await personalChat({ responseMode: 'voice', messages: [], date: '2026-10-16',
    endVoiceConversation: async () => { standby++; },
    client: { generate: async history => {
      if (generated++ === 0) return { role: 'assistant', tool_calls: [
        { id: 'early', function: { name: 'end_voice_conversation', arguments: '{"reason":"用户说任务做完后退下"}' } },
        { id: 'meal', function: { name: 'write_meal_records', arguments: '{"operationKey":"meal-1"}' } },
      ] };
      assert.equal(standby, 0); assert.match(history.at(-1).content, /保存失败/);
      assert.equal(receipts[0].result.standbyScheduled, false); assert.equal(receipts[0].result.pendingReview, true);
      return { content: '饮食没能保存，先不退出。' };
    } }, execute: async (name, args) => { effects.push({ name, args }); return { ok: false, error: '保存失败' }; },
    onToolResult: call => receipts.push(call),
  });
  assert.equal(answer, '饮食没能保存，先不退出。'); assert.equal(standby, 0);
  assert.equal(effects.length, 1); assert.equal(effects[0].name, 'write_meal_records');
});

test('reviewed successful mixed tasks can then enter standby without repeating their effects', async () => {
  const { personalChat } = await import('../src/integrations/personalTools.mjs');
  let round = 0, effects = 0, standby = 0;
  const end = { id: 'end', function: { name: 'end_voice_conversation', arguments: '{"reason":"请求的任务已核实，用户要求完成后结束"}' } };
  const answer = await personalChat({ responseMode: 'voice', messages: [], date: '2026-10-16',
    endVoiceConversation: async () => { standby++; },
    client: { generate: async history => {
      if (round++ === 0) return { role: 'assistant', tool_calls: [end, { id: 'music', function: { name: 'control_music', arguments: '{"action":"play","operationKey":"play-1"}' } }] };
      assert.equal(standby, 0); assert.equal(effects, 1); assert.equal(JSON.parse(history.at(-1).content).ok, true);
      return { role: 'assistant', tool_calls: [{ ...end, id: 'reviewed-end' }] };
    } }, execute: async () => { effects++; return { ok: true }; },
  });
  assert.equal(answer, ''); assert.equal(standby, 1); assert.equal(effects, 1); assert.equal(round, 2);
});

test('invalid, disconnected and failed standby requests do not silently end the conversation', async () => {
  const { personalChat } = await import('../src/integrations/personalTools.mjs');
  for (const scenario of ['invalid', 'disconnected', 'failed']) {
    let round = 0, attempts = 0; const receipts = [];
    const answer = await personalChat({ responseMode: 'voice', messages: [], date: '2026-10-16',
      endVoiceConversation: scenario === 'disconnected' ? undefined : async () => { attempts++; throw Error('当前语音请求已失效'); },
      client: { generate: async history => {
        if (round++ === 0) return { role: 'assistant', tool_calls: [{ id: 'invalid-end', function: { name: 'end_voice_conversation', arguments: JSON.stringify(scenario === 'invalid' ? { reason: '' } : { reason: '用户要结束' }) } }] };
        assert.equal(JSON.parse(history.at(-1).content).ok, false); return { content: '尚未退出。' };
      } }, execute: async () => { throw Error('Wrong tool dispatch'); }, onToolResult: call => receipts.push(call),
    });
    assert.equal(answer, '尚未退出。'); assert.equal(receipts[0].result.ok, false); assert.equal(attempts, scenario === 'failed' ? 1 : 0);
  }
});

test('a cancelled model standby choice cannot end a replacement voice request', async () => {
  const h = dialogueHarness(); let release, attempted;
  h.dependencies.turn = input => new Promise(resolve => { release = async () => {
    attempted = input.endVoiceConversation().catch(() => {}); await attempted; resolve('');
  }; });
  const old = h.task({ requestId: 'old-standby', sessionId: 's', text: '先结束' });
  await new Promise(resolve => setImmediate(resolve));
  h.cancel('old-standby'); h.wake();
  h.dependencies.turn = async () => '新对话继续。';
  await h.task({ requestId: 'new-turn', sessionId: 's', text: '等等，继续' });
  await release(); await old;
  assert.equal(h.standbys.length, 0); assert.deepEqual(h.replies, [{ id: 'new-turn', text: '新对话继续。' }]);
});

test('a native standby failure reports the error and keeps the conversation available', async () => {
  const h = dialogueHarness();
  h.dependencies.turn = async input => { await input.endVoiceConversation(); return ''; };
  h.dependencies.standby = async () => { throw Error('回待机接口暂不可用。'); };
  await h.task({ requestId: 'standby-error', sessionId: 's', text: '先聊到这里' });
  assert.equal(h.replies[0].text, '回待机接口暂不可用。');
  assert.equal(h.dependencies.conversation.getSnapshot().turns[1].status, 'failed');
});
