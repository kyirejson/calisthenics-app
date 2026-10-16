const test = require('node:test'), assert = require('node:assert/strict');
const { phoneArchitectures, phoneGradleProperties, assertPhoneApkArchitectures } = require('./lib/android-abis.cjs');

test('phone prebuild removes default ABI duplicates without touching unrelated properties', () => {
  const other = { type: 'property', key: 'hermesEnabled', value: 'true' };
  const comment = { type: 'comment', value: 'Emulators can use a CLI property override.' };
  const input = [comment, { type: 'property', key: 'reactNativeArchitectures', value: 'armeabi-v7a,arm64-v8a,x86,x86_64' }, other,
    { type: 'property', key: 'reactNativeArchitectures', value: 'x86' }];
  const before = JSON.stringify(input), result = phoneGradleProperties(input);
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(result, [comment, { type: 'property', key: 'reactNativeArchitectures', value: 'arm64-v8a' }, other]);
  assert.deepEqual(phoneGradleProperties(result), result);
});

test('a fresh Expo project receives a single ARM64 default', () => {
  assert.deepEqual(phoneGradleProperties([]), [{ type: 'property', key: 'reactNativeArchitectures', value: 'arm64-v8a' }]);
  assert.deepEqual(phoneArchitectures, ['arm64-v8a']);
  const config = require('../app.json').expo;
  assert.ok(config.plugins.includes('./plugins/withAndroidArchitectures.cjs'));
  assert.ok(require('../plugins/withAndroidArchitectures.cjs')({ name: 'Uncover', slug: 'uncover' }).mods.android.gradleProperties);
});

test('release guard rejects any foreign ABI, even when voice libraries themselves are ARM64', () => {
  assert.doesNotThrow(() => assertPhoneApkArchitectures(['arm64-v8a']));
  for (const abis of [[], ['x86_64'], ['arm64-v8a', 'x86_64'], ['arm64-v8a', 'armeabi-v7a'], ['arm64-v8a', 'x86']]) {
    assert.throws(() => assertPhoneApkArchitectures(abis), /ARM64 only/);
  }
});
