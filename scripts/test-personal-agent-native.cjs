const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path'), os = require('node:os');
const root = path.resolve(__dirname, '..');
test('native config plugin adds only official music queries and registers the Siri source once', () => {
  const handlers = {}, registrations = [];
  const configPlugins = {
    withAndroidManifest: (config, handler) => { handlers.android = handler; return config; },
    withInfoPlist: (config, handler) => { handlers.ios = handler; return config; },
    withXcodeProject: (config, handler) => { handlers.xcode = handler; return config; },
    createRunOncePlugin: plugin => plugin,
    IOSConfig: { XcodeUtils: { addBuildSourceFileToGroup: ({ filepath }) => registrations.push(filepath) } },
  };
  const file = path.join(root, 'plugins/with-personal-agent.cjs'), module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), { module, require: id => id === 'expo/config-plugins' ? configPlugins : require(id) }, { filename: file });
  module.exports({});
  const android = { modResults: { manifest: {} } }; handlers.android(android); handlers.android(android);
  assert.equal(android.modResults.manifest.queries.length, 1); assert.equal(android.modResults.manifest.queries[0].intent[0].data[0].$['android:scheme'], 'orpheus');
  const ios = { modResults: { LSApplicationQueriesSchemes: ['other'] } }; handlers.ios(ios); handlers.ios(ios);
  assert.equal(JSON.stringify(ios.modResults.LSApplicationQueriesSchemes), JSON.stringify(['other', 'orpheus']));
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'uncover-native-agent-'));
  try {
    fs.mkdirSync(path.join(directory, 'Uncover'));
    const xcode = { modRequest: { projectName: 'Uncover', platformProjectRoot: directory, projectRoot: root }, modResults: { hasFile: file => registrations.includes(file) } };
    handlers.xcode(xcode); handlers.xcode(xcode);
    assert.deepEqual(registrations, ['Uncover/UncoverAgentIntents.swift']);
    const source = fs.readFileSync(path.join(directory, registrations[0]), 'utf8');
    assert.match(source, /openAppWhenRun = true/); assert.doesNotMatch(source, /OpenURLIntent|http|startRecording/);
    assert.match(source, /pending\.text/); assert.match(source, /pending\.at/);
  } finally {
    const resolved = fs.realpathSync(directory); assert.ok(resolved.startsWith(fs.realpathSync(os.tmpdir()) + path.sep + 'uncover-native-agent-'));
    fs.rmSync(resolved, { recursive: true });
  }
});
test('wake service is private opt-in, non-sticky, releases audio and never leaks keys or auto-submits', () => {
  const dir = path.join(root, 'modules/uncover-copilot/android');
  const manifest = fs.readFileSync(path.join(dir, 'src/main/AndroidManifest.xml'), 'utf8');
  const service = fs.readFileSync(path.join(dir, 'src/main/java/expo/modules/uncovercopilot/CopilotWakeService.kt'), 'utf8');
  assert.match(manifest, /android:exported="false"/); assert.match(manifest, /foregroundServiceType="microphone"/);
  assert.match(service, /START_NOT_STICKY/); assert.doesNotMatch(service, /START_STICKY|Log\.|println\(|onBoot|BOOT_COMPLETED/);
  assert.match(service, /releaseMic\(\)/); assert.match(service, /setKeywordPath\("uncover-wake.ppn"\)/);
  assert.match(service, /removeExtra\("accessKey"\)/); assert.match(service, /setOnClickListener \{ startActivity/);
  const bridge = fs.readFileSync(path.join(dir, 'src/main/java/expo/modules/uncovercopilot/UncoverCopilotModule.kt'), 'utf8');
  assert.match(bridge, /hasWindowFocus/); assert.match(bridge, /canDrawOverlays/);
});
