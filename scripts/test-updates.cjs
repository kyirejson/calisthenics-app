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
