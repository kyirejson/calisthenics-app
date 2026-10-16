const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('MAX identity is shared by voice/text prompts while DeepSeek remains an honestly disclosed API provider', async () => {
  const { AGENT_NAME } = await import('../src/agent/identity.mjs');
  const { responseStyle } = await import('../src/integrations/responseStyle.mjs');
  assert.equal(AGENT_NAME, 'MAX');
  for (const mode of ['text', 'voice']) {
    const prompt = responseStyle(mode);
    assert.match(prompt, /名为 MAX 的独立 AI 助手/); assert.match(prompt, /DeepSeek 只是当前使用的模型 API 提供方/);
    assert.doesNotMatch(prompt, /BLACK|你叫 DeepSeek/); assert.match(prompt, /不减少.*使用已授权工具/);
  }
  assert.match(read('src/integrations/deepseekClient.mjs'), /https:\/\/api\.deepseek\.com\/chat\/completions/);
});

test('chat views and accessibility labels use the product identity, not a provider-branded chat implementation', () => {
  for (const file of ['src/integrations/AgentChat.tsx', 'src/integrations/AgentChatHost.tsx', 'src/features/chat/ChatMessages.tsx']) {
    const text = read(file); assert.match(text, /AGENT_NAME/); assert.doesNotMatch(text, /DeepSeek|DeepseekChat|BLACK/);
  }
  for (const file of ['src/integrations/DeepseekChat.tsx', 'src/integrations/DeepseekChatHost.tsx'])
    assert.equal(fs.existsSync(path.join(__dirname, '..', file)), false, 'Retired provider-branded UI must not remain as a duplicate');
  assert.match(read('App.tsx'), /<AgentChatHost>/);
  assert.match(read('src/integrations/ServiceSettings.tsx'), /DeepSeek/); // Connection settings must not disguise the actual provider.
});

test('actual native wake dictionary and its hash manifest are MAX, not a cosmetic UI rename', () => {
  const prefix = 'modules/uncover-voice/android/src/main/assets/black-voice/';
  const bytes = fs.readFileSync(path.join(__dirname, '..', prefix + 'keywords.txt'));
  assert.deepEqual(bytes.toString('utf8').trim().split(/\r?\n/), ['M AE1 K S @MAX', 'HH EY1 M AE1 K S @HEY_MAX']);
  const manifest = JSON.parse(read(prefix + 'resources.json'));
  assert.equal(manifest.name, 'MAX');
  const entry = manifest.files.find(item => item.path.endsWith('/keywords.txt'));
  assert.equal(entry.sha256, crypto.createHash('sha256').update(bytes).digest('hex')); assert.equal(entry.bytes, bytes.length);
  assert.match(read('modules/uncover-voice/android/src/main/java/uncover/voice/VoiceBrand.kt'), /NAME = "MAX"/);
  assert.match(read('modules/uncover-voice/android/src/main/java/uncover/voice/VoiceTurnBuffer.kt'), /VoiceBrand\.NAME/);
  assert.doesNotMatch(read('modules/uncover-voice/android/src/main/java/uncover/voice/UncoverVoiceModule.kt'), /BLACK/);
});

test('renaming preserves saved permission settings and Android assistant components instead of requiring new enrollment', () => {
  const state = read('modules/uncover-voice/android/src/main/java/uncover/voice/VoiceState.kt');
  assert.match(state, /getSharedPreferences\("black_voice_v1"/); assert.match(state, /put\("name", VoiceBrand\.NAME\)/);
  const manifest = read('modules/uncover-voice/android/src/main/AndroidManifest.xml');
  assert.match(manifest, /uncover\.voice\.BlackAssistantService/); assert.match(manifest, /@string\/max_voice_assistant/);
  assert.match(read('modules/uncover-voice/android/src/main/res/values/strings.xml'), /MAX 语音助手/);
});
