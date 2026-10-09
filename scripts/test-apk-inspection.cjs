const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { zipSync } = require('fflate');

function fixture() {
  const symbols = ['GpsDiagnostics', 'GpsSubscription', 'MotionGate', 'MotionSources', 'RunSteps', 'StepEvidence', 'RunVoice'].map(name => `Luncover/running/${name};`);
  symbols.push('mapLocation', 'mapPosition', 'auxiliaryProviders', 'networkAvailable', 'autoPaused', 'stepCount');
  const entries = { 'classes.dex': Buffer.from(symbols.join('\n')) };
  const assets = Array.from({ length: 100 }, (_, index) => {
    const bytes = Buffer.from(`synthetic image hash fixture ${index}`);
    entries[`res/${index}.jpeg`] = bytes;
    return { name: `image${index}`, resourcesFilename: `assets_originalimages_image${index}`, packagerHash: crypto.createHash('md5').update(bytes).digest('hex') };
  });
  entries['assets/app.manifest'] = Buffer.from(JSON.stringify({ assets }));
  return entries;
}
function inspect(t, entries) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'uncover-apk-inspection-'));
  t.after(() => fs.rmSync(directory, { recursive: true }));
  const apk = path.join(directory, 'fixture.apk');
  fs.writeFileSync(apk, zipSync(entries));
  return spawnSync(process.execPath, [path.join(__dirname, 'inspect-apk-running-diagnostics.cjs'), apk], { encoding: 'utf8' });
}
test('release resource verification accepts optimized ZIP paths using actual bytes', t => {
  const result = inspect(t, fixture());
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /100 hash-verified original action figures/);
});
test('release resource verification rejects an image declared but not packaged', t => {
  const entries = fixture(); delete entries['res/5.jpeg'];
  const result = inspect(t, entries);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Original figure bytes missing or altered: image5/);
});
test('release resource verification rejects changed image bytes', t => {
  const entries = fixture(); entries['res/7.jpeg'] = Buffer.from('altered');
  const result = inspect(t, entries);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Original figure bytes missing or altered: image7/);
});
test('release resource verification requires the embedded asset manifest', t => {
  const entries = fixture(); delete entries['assets/app.manifest'];
  const result = inspect(t, entries);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Embedded asset manifest missing/);
});
