const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const runtime = require('../src/integrations/connectionRuntime.mjs');
const { createDeepseekClient } = require('../src/integrations/deepseekClient.mjs');
const config = { deepseekKey: 'sk-isolated-fixture' };
const reply = content => Response.json({ choices: [{ finish_reason: 'stop', message: { content } }] });

test('provider transport returns ordinary text without old prompts, memory or JSON requirements', async () => {
  let body;
  const client = createDeepseekClient({ config, fetchImpl: async (url, init) => {
    assert.equal(url, 'https://api.deepseek.com/chat/completions');
    body = JSON.parse(init.body); return reply('你好，司令。');
  } });
  const messages = [{ role: 'user', content: '叫我司令' }];
  assert.equal(await client.generate(messages), '你好，司令。');
  assert.deepEqual(body.messages, messages); assert.equal(body.response_format, undefined);
  assert.equal(body.max_tokens, undefined);
  assert.equal(body.tools, undefined);
  assert.equal(body.model, 'deepseek-flash');
});
test('connection verification is bound to the exact key and obsolete provider settings are pruned', async () => {
  const normalized = runtime.normalizeConnection({ ...config, tavilyKey: 'invalid obsolete data', asrKey: 123, model: 'obsolete' });
  assert.equal(normalized.model, 'deepseek-flash');
  assert.equal(normalized.tavilyKey, undefined); assert.equal(normalized.asrKey, undefined);
  runtime.installConnection(normalized);
  assert.equal(runtime.setModelConnectionVerified(normalized, true), true);
  runtime.installConnection({ deepseekKey: 'sk-different-fixture' });
  assert.equal(runtime.connectionSummary().modelVerified, false);
  assert.equal(runtime.setModelConnectionVerified(normalized, true), false);
});
test('provider failures and cancellation never become fabricated assistant replies', async () => {
  for (const [status, message] of [[401, /密钥/], [402, /余额/], [429, /受限/], [503, /暂不可用/]]) {
    await assert.rejects(createDeepseekClient({ config, fetchImpl: async () => new Response('{}', { status }) }).generate([]), message);
  }
  const controller = new AbortController(); controller.abort(); let calls = 0;
  await assert.rejects(createDeepseekClient({ config, fetchImpl: async () => { calls++; return reply('wrong'); } }).generate([], { signal: controller.signal }), /取消/);
  assert.equal(calls, 0);
});
test('old-data removal targets memory only, preserving API Key, business storage', async () => {
  const filename = path.resolve(__dirname, '../src/store/retiredAssistantStorage.ts');
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const disk = new Map([['uncover.agent.connection.v1', 'KEEP'], ['user_profile', 'KEEP'], ['nutrition_journal_v1', 'KEEP']]);
  const removed = [], exportsObject = {};
  const storage = { getItem: async k => disk.get(k), setItem: async (k,v) => disk.set(k,v), multiRemove: async keys => keys.forEach(k=>disk.delete(k)) };
  class OwnedPath { constructor(...parts) { this.name = parts.join('/'); this.exists = true; } delete() { removed.push(this.name); } }
  vm.runInNewContext(source, { exports: exportsObject, require: id => {
    if (id.includes('async-storage')) return storage;
    if (id === 'react-native') return { Platform: { OS: 'android' } };
    if (id === 'expo-file-system') return { Directory: OwnedPath, File: OwnedPath, Paths: { document: 'owned-documents' } };
    throw Error('Unexpected dependency: ' + id);
  } });
  await exportsObject.clearRetiredAssistantStorage();
  for (const key of ['uncover.agent.connection.v1','user_profile','nutrition_journal_v1']) assert.equal(disk.get(key), 'KEEP');
  assert.ok(removed.includes('owned-documents/agent-private-memory-v3'));
  assert.ok(removed.every(name => /agent-private-memory-v3|SQLite\/(?:agent-memory-pointer-v3|uncover-assistant-memory-v2)\.db/.test(name)));
});
test('live app exposes independent integrations and no old assistant or native wake APIs', () => {
  const root = path.resolve(__dirname, '..');
  assert.equal(fs.existsSync(path.join(root, 'src/agent/PersonalAgentHost.tsx')), false);
  assert.equal(fs.existsSync(path.join(root, 'modules/uncover-copilot/expo-module.config.json')), false);
  const ui = fs.readFileSync(path.join(root, 'src/integrations/ServiceSettings.tsx'), 'utf8');
  assert.doesNotMatch(ui, /MusicConnectionPanel/); assert.match(ui, /createDeepseekClient/);
  assert.doesNotMatch(ui, /记忆|Tavily|语音|Harness/);
});
