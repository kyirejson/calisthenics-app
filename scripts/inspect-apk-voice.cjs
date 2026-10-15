const fs = require('node:fs'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { unzipSync } = require('fflate');
const filename = process.argv[2]; assert.ok(filename, 'Provide the formal APK');
const entries = unzipSync(fs.readFileSync(filename), { filter: item => /^classes\d*\.dex$/.test(item.name) || item.name.startsWith('assets/black-voice/') || /index\.android\.bundle$/.test(item.name) || /lib\/.*\/lib(sherpa-onnx-jni|black-echo)\.so$/.test(item.name) });
const dex = Object.entries(entries).filter(([name]) => /^classes\d*\.dex$/.test(name)).map(([, bytes]) => Buffer.from(bytes));
assert.ok(dex.some(bytes => bytes.includes(Buffer.from('语音音频已写入，但播放器尚未就绪'))), 'APK is missing the post-write static playback readiness fix');
assert.ok(!dex.some(bytes => bytes.includes(Buffer.from('系统未能初始化语音播放。'))), 'APK still includes the incorrect pre-write playback failure');
for (const symbol of ['Luncover/voice/VoiceSpeakerPlaybackTest;', 'Luncover/voice/VoicePlaybackActivity;']) assert.ok(!dex.some(bytes => bytes.includes(Buffer.from(symbol))), 'Test-only playback fixture entered formal APK: ' + symbol);
for (const symbol of ['Luncover/voice/BlackVoiceService;', 'Luncover/voice/BlackAssistantService;', 'Luncover/voice/VoiceAgentTaskService;', 'Lcom/k2fsa/sherpa/onnx/KeywordSpotter;', 'executeAndObserve', 'finishWithoutUi']) assert.ok(dex.some(bytes => bytes.includes(Buffer.from(symbol))), 'Missing native voice/music feature: ' + symbol);
const prefix = 'assets/black-voice/';
const manifest = JSON.parse(Buffer.from(entries[prefix + 'resources.json']).toString('utf8'));
for (const item of manifest.files.filter(item => item.path.startsWith('src/main/assets/black-voice/'))) {
  const apkPath = 'assets/' + item.path.slice('src/main/assets/'.length), bytes = entries[apkPath];
  assert.ok(bytes, 'Missing voice resource: ' + apkPath); assert.equal(bytes.length, item.bytes);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), item.sha256);
}
assert.ok(!entries[prefix + 'iam.wav'] && !entries[prefix + 'iam-provenance.json'], 'Obsolete native wake reply must not ship');
assert.ok(entries[prefix + 'LICENSE.txt']); assert.ok(entries[prefix + 'NOTICE.txt']);
assert.ok(entries[prefix + 'ONNX-RUNTIME-LICENSE.txt']);
assert.ok(entries[prefix + 'vad/silero_vad.onnx'], 'Missing local speech activity model');
assert.ok(entries[prefix + 'SILERO-LICENSE.txt']); assert.ok(entries[prefix + 'SPEEX-DSP-LICENSE.txt']);
assert.ok(entries[prefix + 'WEBRTC-AEC3-LICENSE.txt']);
assert.ok(manifest.artifacts.some(item => item.aec && item.sha256 === '3bc3423e71b7280cf96d87b2e429444ed3fee364b94648ce9875ee95b8f485f8'), 'Pinned local AEC3 source is missing');
for (const abi of ['arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64']) {
  assert.ok(entries['lib/' + abi + '/libsherpa-onnx-jni.so'], 'Missing voice ABI: ' + abi);
  assert.ok(entries['lib/' + abi + '/libblack-echo.so'], 'Missing echo cancellation ABI: ' + abi);
}
const bundle = Object.entries(entries).filter(([name]) => /index\.android\.bundle$/.test(name)).map(([, bytes]) => Buffer.from(bytes));
for (const marker of ['UncoverVoiceAgent', 'open_music_and_observe', 'music_ui_action_and_observe', 'control_music_and_observe', 'continue_listening', 'BLACK']) assert.ok(bundle.some(bytes => bytes.includes(Buffer.from(marker))), 'Missing embedded Agent feature: ' + marker);
console.log('Formal APK includes four local wake/ASR/AEC3 ABIs, hash-verified KWS/ASR/VAD assets, model-controlled listening and fused music tools; no local wake reply.');
