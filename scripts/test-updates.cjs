const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(filename, dependencies = {}, extra = {}) {
  const output = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', filename), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports, require: key => { if (!(key in dependencies)) throw Error('Unexpected import: ' + key); return dependencies[key]; }, AbortController, setTimeout, clearTimeout, ...extra });
  return module.exports;
}
const policy = load('src/services/updatePolicy.ts');
const release = (code = 5) => ({ tag_name: 'v1.3.1', name: 'Uncover', body: `App version: 1.3.1\nAndroid versionCode: ${code}`, draft: false, prerelease: false, assets: [{ name: 'uncover.apk', browser_download_url: 'https://github.com/kyirejson/calisthenics-app/releases/download/v1.3.1/uncover.apk' }] });
test('EAS builds use managed app signing rather than the old local debug key', () => {
  const { build } = require('../eas.json');
  assert.equal(build.preview.credentialsSource, 'remote');
  assert.equal(build.production.credentialsSource, 'remote');
  assert.equal(build.preview.distribution, 'internal');
});
test('release metadata, version and trusted download origin are required', () => {
  assert.equal(policy.parseRelease(release(), 4, true).versionCode, 5);
  for (const item of [release(4), release(2), { ...release(), draft: true }, { ...release(), prerelease: true }, { ...release(), body: '' }, { ...release(), assets: [] }, { ...release(), assets: [{ name: 'x.apk', browser_download_url: 'https://evil.example/x.apk' }] }]) assert.equal(policy.parseRelease(item, 4, true), null);
  assert.ok(policy.parseRelease({ ...release(), prerelease: true }, 4, false));
});
test('reload requires downloaded update, a safe screen and foreground app', () => {
  for (const ready of [true, false]) for (const safe of [true, false]) for (const active of [true, false]) assert.equal(policy.canReloadUpdate(ready, safe, active), ready && safe && active);
});
function checker(fetcher, nativeBuild = '4') {
  const cache = new Map();
  const service = load('src/services/updateChecker.ts', {
    '@react-native-async-storage/async-storage': { getItem: async k => cache.get(k), setItem: async (k, v) => cache.set(k, v) },
    'expo-application': { nativeBuildVersion: nativeBuild },
    'expo-constants': { expoConfig: { extra: { updateChannel: 'stable' } } },
    '../../app.json': { expo: { android: { versionCode: 999 } } },
    './updatePolicy': policy,
  }, { fetch: fetcher });
  return { ...service, cache };
}
test('APK checks compare installed binary, cache results and allow force refresh', async () => {
  let calls = 0;
  const service = checker(async () => { calls++; return { ok: true, json: async () => [release()] }; });
  assert.equal((await service.checkForUpdates()).versionCode, 5, 'JS config version 999 must not hide a newer APK');
  await service.checkForUpdates(); assert.equal(calls, 1);
  await service.checkForUpdates(true); assert.equal(calls, 2);
  service.cache.set([...service.cache.keys()][0], 'broken');
  await service.checkForUpdates(); assert.equal(calls, 3);
});
test('network errors do not claim latest version or overwrite a valid cache', async () => {
  const service = checker(async () => { throw Error('offline'); });
  await assert.rejects(service.checkForUpdates(), /offline/);
  assert.equal(service.cache.size, 0);
  const invalid = checker(async () => ({ ok: true, json: async () => ({ message: 'limited' }) }));
  await assert.rejects(invalid.checkForUpdates(), /Invalid release/);
});
test('OTA configuration is opt-in and never automatically reloads at startup', () => {
  const config = require('../app.config.js');
  const old = process.env.EXPO_PROJECT_ID;
  delete process.env.EXPO_PROJECT_ID;
  try {
    assert.equal(config({ config: {} }).updates.enabled, false);
    const linked = config({ config: { extra: { eas: { projectId: '11111111-1111-4111-8111-111111111111' } } } });
    assert.equal(linked.updates.enabled, true);
    assert.equal(linked.updates.checkAutomatically, 'NEVER');
    assert.equal(linked.runtimeVersion.policy, 'fingerprint');
  } finally { if (old !== undefined) process.env.EXPO_PROJECT_ID = old; }
});
test('linked app resolves the confirmed personal project and matching update channels', () => {
  const resolve = require('../app.config.js');
  const app = require('../app.json').expo;
  const keys = ['EXPO_PROJECT_ID', 'EAS_BUILD_PROFILE', 'EXPO_UPDATE_CHANNEL'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];
  try {
    assert.equal(app.owner, 'kyirechou');
    assert.equal(app.extra.eas.projectId, 'f6e5af9d-46ec-4f38-be5e-ec267e071eb7');
    const preview = resolve({ config: app });
    assert.equal(preview.updates.enabled, true);
    assert.equal(preview.updates.url, `https://u.expo.dev/${app.extra.eas.projectId}`);
    assert.equal(preview.updates.requestHeaders['expo-channel-name'], 'preview');
    assert.equal(preview.extra.updateChannel, 'preview');
    assert.equal(preview.updates.checkAutomatically, 'NEVER');
    process.env.EAS_BUILD_PROFILE = 'production';
    const production = resolve({ config: app });
    assert.equal(production.updates.requestHeaders['expo-channel-name'], 'production');
    assert.equal(production.extra.updateChannel, 'stable');
    assert.equal(production.updates.url, preview.updates.url);
    // EAS_BUILD_PROFILE is set remotely but is not guaranteed during local hashing.
    // Explicit profile env must produce exactly the same config in both places.
    const profiles = require('../eas.json').build;
    for (const name of ['preview', 'production']) {
      delete process.env.EAS_BUILD_PROFILE;
      process.env.EXPO_UPDATE_CHANNEL = profiles[name].env.EXPO_UPDATE_CHANNEL;
      assert.equal(process.env.EXPO_UPDATE_CHANNEL, name);
      const local = resolve({ config: app });
      process.env.EAS_BUILD_PROFILE = name;
      assert.deepEqual(resolve({ config: app }), local, `${name}: local/cloud config must agree`);
    }
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
