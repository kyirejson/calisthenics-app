// Inspect the actual production artifact, not just source presence or Gradle success.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { execFileSync } = require('node:child_process');
const { unzipSync } = require('fflate');
const { assertPhoneApkArchitectures } = require('./lib/android-abis.cjs');
const file = process.argv[2]; assert.ok(file, 'Provide the signed phone APK');
const names = [], abis = new Set();
const entries = unzipSync(fs.readFileSync(file), { filter: entry => {
  names.push(entry.name); const abi = /^lib\/([^/]+)\/.+\.so$/.exec(entry.name)?.[1]; if (abi) abis.add(abi);
  return /^classes\d*\.dex$/.test(entry.name) || /index\.android\.bundle$/.test(entry.name) || entry.name === 'assets/phone-control-notice.txt';
} });
assertPhoneApkArchitectures(abis);
const dex = Object.entries(entries).filter(([name]) => /^classes\d*\.dex$/.test(name)).map(([, value]) => Buffer.from(value));
for (const name of ['UncoverDeviceModule', 'PhoneApps', 'PhoneUi', 'PhoneController', 'PhoneExecutionService', 'PhoneLedger', 'PhoneOcr'])
  assert.ok(dex.some(value => value.includes(Buffer.from('Luncover/device/' + name + ';'))), 'Missing real native phone component: ' + name);
for (const name of ['PhoneControlTest', 'PhoneFixtureActivity', 'PhoneFixtureService'])
  assert.ok(!dex.some(value => value.includes(Buffer.from('Luncover/device/' + name + ';'))), 'Test-only control fixture shipped: ' + name);
for (const marker of ['uncertain_operation', 'operation_conflict', 'phone_consent_required', 'stale_screen', 'wrong_request', 'imageUploaded', 'local_ocr'])
  assert.ok(dex.some(value => value.includes(Buffer.from(marker))), 'Missing native execution/observation rule: ' + marker);
const bundle = Object.entries(entries).filter(([name]) => /index\.android\.bundle$/.test(name)).map(([, value]) => Buffer.from(value));
for (const marker of ['UncoverDevice', 'read_phone_status', 'find_apps', 'open_app', 'read_phone_screen', 'phone_ui_action', 'phone_gesture', 'phone_global_action', 'MAX 通用手机控制', 'visualText'])
  assert.ok(bundle.some(value => value.includes(Buffer.from(marker)) || value.includes(Buffer.from(marker, 'utf16le'))), 'Missing embedded phone Agent feature: ' + marker);
assert.ok(entries['assets/phone-control-notice.txt'], 'Missing local OCR disclosure');
assert.ok(names.some(name => /assets\/.+(chinese|ocr|text_recognition)/i.test(name)), 'Missing bundled offline OCR resources');
const sdk = process.env.ANDROID_HOME || 'D:/UncoverBuildTools/android-sdk';
const tools = fs.readdirSync(path.join(sdk, 'build-tools')).filter(name => fs.existsSync(path.join(sdk, 'build-tools', name, 'aapt.exe'))).sort().at(-1);
const aapt = path.join(sdk, 'build-tools', tools, 'aapt.exe');
const xml = execFileSync(aapt, ['dump', 'xmltree', file, 'AndroidManifest.xml'], { encoding: 'utf8', windowsHide: true });
for (const marker of ['uncover.device.PhoneExecutionService', 'uncover.music.MusicAccessibilityService', 'uncover.phone_control', 'android.intent.category.LAUNCHER']) assert.ok(xml.includes(marker), 'Missing phone manifest wiring: ' + marker);
assert.ok(!xml.includes('android.permission.QUERY_ALL_PACKAGES'), 'Unnecessary all-package permission shipped');
const access = execFileSync(aapt, ['dump', 'xmltree', file, 'res/xml/uncover_music_accessibility.xml'], { encoding: 'utf8', windowsHide: true });
assert.match(access, /canTakeScreenshot.*0xffffffff/); assert.doesNotMatch(access, /packageNames/);
console.log('Phone APK includes dynamic all-launchable-app discovery, real shared UI execution, independent opt-in, operation journal/cancellation, local-only OCR and all seven model tools; ARM64 only, no isolated test fixtures. Real WeChat delivery/maps routes still require actual-account/device acceptance.');
