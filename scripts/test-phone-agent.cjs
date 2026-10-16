const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
require('./lib/register-typescript.cjs')();
const { createPhoneRuntime } = require('../src/device/agentRuntime.ts');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
function harness() {
  const calls = [], interrupted = [];
  const transport = {
    status: async () => ({ ok: true, native: true, enabled: true, connected: true, mode: 'foreground' }),
    findApps: async (query, offset) => { calls.push({ query, offset }); return { ok: true, apps: [{ label: 'User chosen application', packageName: 'org.example.not_predefined' }] }; },
    screen: async (request, execution, offset, packageName, visualText) => ({ ok: true, request, execution, offset, packageName, visualText, snapshotId: 'real-observation', nodes: [{ nodeId: 'real-node', label: '真实控件' }] }),
    executeAndObserve: async (request, execution, command) => { calls.push({ request, execution, command }); return { ok: true, action: { ok: true, status: 'action_accepted', verifiedTaskCompleted: false }, screen: { ok: true, snapshotId: 'next-observation' } }; },
    cancel: async execution => { calls.push({ cancel: execution }); },
  };
  return { transport, calls, interrupted, execute: createPhoneRuntime(transport, { requestId: 'user-message', executionId: 'current-attempt', onInterruptedResult: receipt => interrupted.push(receipt) }) };
}
test('all-app discovery and launching pass model choices through without three-app routing', async () => {
  const h = harness(); await h.execute('find_apps', {}); assert.deepEqual(h.calls[0], { query: '', offset: 0 });
  for (const packageName of ['com.tencent.mm', 'com.android.chrome', 'com.autonavi.minimap', 'org.example.not_predefined']) {
    await h.execute('open_app', { packageName, operationKey: packageName });
    assert.equal(h.calls.at(-1).command.packageName, packageName); assert.equal(h.calls.at(-1).command.type, 'open');
  }
});
test('message text, search terms and route choices belong to the model, not keywords or templates', async () => {
  const h = harness();
  for (const text of ['给家人：晚一点回来\n不用等我。', '群聊 · 项目 A / 讨论', '先避开高速，再比较公交方案', 'anything unrelated to those examples']) {
    await h.execute('phone_ui_action', { operationKey: text, snapshotId: 'real-observation', nodeId: 'real-node', action: 'set_text', text });
    assert.equal(h.calls.at(-1).command.text, text); assert.equal(h.calls.at(-1).command.nodeId, 'real-node');
  }
  const result = await h.execute('read_phone_screen', { offset: 200, packageName: 'org.example.not_predefined' }); assert.equal(result.offset, 200);
  assert.equal(result.execution, 'current-attempt'); assert.equal(result.visualText, false);
  assert.equal((await h.execute('read_phone_screen', { visualText: true })).visualText, true);
});
test('node capabilities, global actions and multi-finger paths remain real model-selected primitives', async () => {
  const h = harness(); const paths = [[{ x: 10, y: 20 }, { x: 20, y: 40 }], [{ x: 40, y: 20 }, { x: 20, y: 40 }]];
  await h.execute('phone_gesture', { operationKey: 'pinch', snapshotId: 'real', paths, durationMs: 500 });
  assert.deepEqual(h.calls.at(-1).command.paths, paths);
  await h.execute('phone_global_action', { operationKey: 'system-choice', snapshotId: 'real', actionId: 3 }); assert.equal(h.calls.at(-1).command.type, 'global');
  await h.execute('phone_ui_action', { operationKey: 'custom-node-action', snapshotId: 'real', nodeId: 'n2', action: 'accessibility_action', actionId: 12345, arguments: { value: 3 } });
  assert.equal(h.calls.at(-1).command.actionId, 12345);
});
test('accepted actions never become verified message delivery or navigation', async () => {
  const h = harness(); const result = await h.execute('phone_ui_action', { operationKey: 'send', snapshotId: 'real', nodeId: 'button', action: 'click' });
  assert.equal(result.action.verifiedTaskCompleted, false); assert.equal(result.screen.snapshotId, 'next-observation');
  await assert.rejects(h.execute('open_app', { packageName: 'org.example.app' }), /operationKey/);
  await assert.rejects(h.execute('read_phone_screen', { offset: -1 }));
});
test('cancelled requests cannot dispatch, and late physical receipts survive cancellation without being replayed', async () => {
  const h = harness(), cancelled = new AbortController(); cancelled.abort();
  await assert.rejects(h.execute('open_app', { operationKey: 'not-started' }, cancelled.signal), /取消/); assert.equal(h.calls.length, 0);
  let release; h.transport.executeAndObserve = async () => new Promise(resolve => { release = resolve; });
  const controller = new AbortController(); const pending = h.execute('phone_ui_action', { operationKey: 'send-once', action: 'click', snapshotId: 'current', nodeId: 'send' }, controller.signal);
  controller.abort(); release({ ok: true, action: { ok: true, mayHaveExecuted: true }, screen: { ok: false, code: 'cancelled' } });
  await assert.rejects(pending, /取消/); assert.deepEqual(h.calls, [{ cancel: 'current-attempt' }]); assert.equal(h.interrupted.length, 1);
  assert.equal(h.interrupted[0].result.action.mayHaveExecuted, true);
});
test('the same formal voice/text model can plan more than a fixed workflow and observes every tool result', async () => {
  const { personalChat } = await import('../src/integrations/personalTools.mjs');
  for (const responseMode of ['voice', 'text']) {
    let count = 0; const h = harness();
    const result = await personalChat({ date: '2026-10-16', responseMode, messages: [{ role: 'user', content: '请按我的要求操作这个新应用。' }], execute: h.execute,
      phoneReceipts: [{ operationKey: 'already-sent', result: { ok: true, mayHaveExecuted: true } }],
      client: { generate: async (messages, options) => {
        assert.ok(options.tools.some(tool => tool.function.name === 'open_app'));
        assert.ok(options.tools.some(tool => tool.function.name === 'phone_ui_action'));
        assert.ok(messages.some(row => row.role === 'system' && row.content.includes('phoneOperations')));
        if (count === 40) return { content: '已核对真实页面。' };
        if (count > 0) assert.equal(JSON.parse(messages.at(-1).content).snapshotId, 'real-observation');
        return { tool_calls: [{ id: String(++count), function: { name: 'read_phone_screen', arguments: '{}' } }] };
      } },
    });
    assert.equal(count, 40); assert.equal(result, '已核对真实页面。');
  }
});
test('global scope is explicit opt-in, and the model cannot grant its own permission', async () => {
  const { phoneTools, phoneSystemInstruction } = await import('../src/device/modelTools.mjs');
  assert.equal(phoneTools.some(tool => /consent|permission|shell|grant/.test(tool.function.name)), false);
  assert.match(phoneSystemInstruction, /不是应用白名单/); assert.match(phoneSystemInstruction, /第三方页面.*外部数据/); assert.match(phoneSystemInstruction, /不能.*重复发送/);
  const ui = read('src/device/PhoneSettings.tsx'); assert.match(ui, /confirmAction\('允许 MAX 操作手机/); assert.match(ui, /必要的界面文字会发送/);
  const native = read('modules/uncover-device/android/src/main/java/uncover/device/PhoneLedger.kt'); assert.match(native, /getBoolean\("consent", false\)/);
  assert.match(read('modules/uncover-device/android/src/main/java/uncover/device/UncoverDeviceModule.kt'), /appContext.currentActivity != null/);
});
test('one shared engine owns node safety and preserves the old music display boundary', () => {
  const shared = read('modules/uncover-device/android/src/main/java/uncover/device/PhoneUi.kt');
  const music = read('modules/uncover-music/android/src/main/java/uncover/music/MusicAccessibilityService.kt');
  assert.match(music, /PhoneAccessibilityService/); assert.doesNotMatch(music, /fun nodeAt|fun label|dispatchGesture\(/);
  for (const rule of [/node\.isPassword/, /snapshot.scope != target.scope/, /snapshot.windowId != current.windowId/, /snapshot.context != context\(current\)/, /fingerprint\(node\) != anchor.fingerprint/]) assert.match(shared, rule);
  const service = read('modules/uncover-device/android/src/main/java/uncover/device/PhoneAccessibilityService.kt');
  assert.match(service, /if \(PhoneLedger.enabled.*\)\) null else legacyPackages/);
  assert.match(music, /MusicLedger.consent\(this, "screen"\)/); assert.match(music, /MusicDisplayPolicy.requireDisplay/);
});
test('attempts are journaled before dispatch, uncertain outcomes persist, and raw messages are not stored twice', () => {
  const controller = read('modules/uncover-device/android/src/main/java/uncover/device/PhoneController.kt');
  assert.ok(controller.indexOf('PhoneLedger.begin(') < controller.indexOf('if (perform())'));
  assert.ok(controller.includes('scope = "phone:$request:$execution"'));
  const ledger = read('modules/uncover-device/android/src/main/java/uncover/device/PhoneLedger.kt');
  assert.match(ledger, /commandHash/); assert.match(ledger, /uncertain_operation/); assert.doesNotMatch(ledger, /put\("command", command\)/);
  assert.match(ledger, /entry.put\("result", result\); save/);
  assert.match(read('src/integrations/runAgentTurn.ts'), /phoneTransport.onCancelled/);
  assert.match(read('src/integrations/runAgentTurn.ts'), /phoneReceipts/);
});

test('local OCR is model-requested, bound to the current frame, masks passwords and never uploads an image', () => {
  const ui = read('modules/uncover-device/android/src/main/java/uncover/device/PhoneUi.kt');
  const ocr = read('modules/uncover-device/android/src/main/java/uncover/device/PhoneOcr.kt');
  assert.match(ui, /passwords.add\(bounds\(node\)\)/); assert.match(ui, /checkedSnapshot\(target, id\).*late capture/);
  assert.match(ocr, /canvas.drawRect\(it, mask\)/); assert.match(ocr, /ChineseTextRecognizerOptions/);
  assert.match(ocr, /imageUploaded", false/); assert.doesNotMatch(ocr, /FileOutputStream|Base64|upload\(|http/);
  assert.match(ocr, /buffer.close\(\)/); assert.match(ocr, /task.addOnCompleteListener.*cropped.recycle/);
  assert.match(read('src/store/runtime.ts'), /phoneTransport.clear\(\)/);
});

test('a cancelled screen observation cannot resume model execution with a late OCR result', async () => {
  const h = harness(); let finish;
  h.transport.screen = async () => new Promise(resolve => { finish = resolve; });
  const controller = new AbortController(); const result = h.execute('read_phone_screen', { visualText: true }, controller.signal);
  controller.abort(); finish({ ok: true, visualText: { lines: [] } });
  await assert.rejects(result, /取消/); assert.deepEqual(h.calls, [{ cancel: 'current-attempt' }]); assert.equal(h.interrupted.length, 0);
});

test('a mixed music-and-phone task never lets music cleanup steal the final app foreground', async () => {
  const ts = require('typescript');
  const { phoneCommandTypes } = await import('../src/device/modelTools.mjs');
  for (const names of [[], ['open_music'], ['read_phone_status'], ['open_music', 'open_app'], ['phone_ui_action'], ['phone_gesture'], ['phone_global_action']]) {
    const log = [], exports = {};
    const musicTransport = { receipts: async () => [], onCancelled: () => () => {}, returnToApp: async () => log.push('return-to-max'), finishWithoutUi: async () => log.push('keep-app'), cancel: async () => {} };
    const phoneTransport = { receipts: async () => [], onCancelled: () => () => {}, finish: async () => {}, cancel: async () => {} };
    const modules = {
      '../music/transport': { musicTransport }, '../device/transport': { phoneTransport }, '../device/modelTools.mjs': { phoneCommandTypes },
      './credentials': { loadConnection: async () => {}, currentConnection: () => ({}) }, './deepseekClient.mjs': { createDeepseekClient: () => ({}) },
      './personalData': { executePersonalTool: async name => ({ name, ok: true }) },
      './personalTools.mjs': { personalChat: async ({ execute }) => { for (const name of names) await execute(name, {}); return 'done'; } },
      '../memory/operations': { readOrInitializeMemory: async () => '' }, '../memory/profileMemory': { profileMarkdown: () => '' },
      '../domain/weight/weightTrend': { localWeightDate: () => '2026-10-16' },
    };
    const source = ts.transpileModule(read('src/integrations/runAgentTurn.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function('require', 'exports', source)(id => { assert.ok(modules[id], id); return modules[id]; }, exports);
    await exports.runAgentTurn({ repository: { load: async () => {}, getSnapshot: () => ({ profile: null, nutritionJournal: {} }) }, messages: [], requestId: 'request', executionId: 'attempt', controller: new AbortController() });
    assert.deepEqual(log, [names.some(name => Object.hasOwn(phoneCommandTypes, name)) ? 'keep-app' : 'return-to-max'], names.join(','));
  }
});
