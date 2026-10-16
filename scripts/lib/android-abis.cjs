const assert = require('node:assert/strict');

// Phone distribution only. Emulator builds can explicitly override the Gradle
// property with -PreactNativeArchitectures=x86_64; they are not release APKs.
const phoneArchitectures = Object.freeze(['arm64-v8a']);
const propertyName = 'reactNativeArchitectures';

function phoneGradleProperties(properties) {
  let replaced = false;
  const result = properties.flatMap(property => {
    if (property.type !== 'property' || property.key !== propertyName) return [property];
    if (replaced) return [];
    replaced = true;
    return [{ ...property, value: phoneArchitectures.join(',') }];
  });
  if (!replaced) result.push({ type: 'property', key: propertyName, value: phoneArchitectures.join(',') });
  return result;
}

function assertPhoneApkArchitectures(architectures) {
  assert.deepEqual([...new Set(architectures)].sort(), [...phoneArchitectures], 'Formal phone APK must contain ARM64 only; do not ship emulator or ARM32 libraries');
}

module.exports = { phoneArchitectures, phoneGradleProperties, assertPhoneApkArchitectures };
