// Check the actual release artifact, not just the source submitted to the builder.
const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { unzipSync } = require('fflate');
const file = process.argv[2];
assert.ok(file, 'Usage: node scripts/inspect-apk-running-diagnostics.cjs <apk>');
const entries = unzipSync(fs.readFileSync(file), { filter: entry => /^classes\d*\.dex$/.test(entry.name) });
const dex = Object.values(entries).map(bytes => Buffer.from(bytes));
assert.ok(dex.length, 'APK has no DEX files');
for (const symbol of ['Luncover/running/GpsDiagnostics;', 'Luncover/running/GpsSubscription;', 'Luncover/running/MotionGate;', 'Luncover/running/MotionSources;', 'Luncover/running/RunSteps;', 'Luncover/running/StepEvidence;', 'Luncover/running/RunVoice;', 'Luncover/running/KilometreAnnouncement;', 'setVoice', 'mapLocation', 'mapPosition', 'auxiliaryProviders', 'networkAvailable', 'autoPaused', 'stepCount']) {
  assert.ok(dex.some(bytes => bytes.includes(Buffer.from(symbol))), `GPS repair missing from APK: ${symbol}`);
}
// Release resource optimization shortens ZIP paths (for example res/-4.jpeg).
// Verify actual image bytes against Metro's embedded asset hashes, not filenames.
const resources = unzipSync(fs.readFileSync(file), { filter: entry => entry.name === 'assets/app.manifest' || /^res\/.*\.(jpe?g|png|webp)$/.test(entry.name) });
assert.ok(resources['assets/app.manifest'], 'Embedded asset manifest missing from APK');
const manifest = JSON.parse(Buffer.from(resources['assets/app.manifest']).toString('utf8'));
const figures = manifest.assets.filter(asset => asset.resourcesFilename?.includes('originalimages'));
assert.ok(figures.length >= 100, `Original action figures missing from APK (${figures.length})`);
const packagedHashes = new Set(Object.entries(resources).filter(([name]) => name.startsWith('res/')).map(([, bytes]) => crypto.createHash('md5').update(bytes).digest('hex')));
for (const figure of figures) assert.ok(packagedHashes.has(figure.packagerHash), `Original figure bytes missing or altered: ${figure.name}`);
const bundle = unzipSync(fs.readFileSync(file), { filter: entry => /(?:^|\/)index\.android\.bundle$/.test(entry.name) });
const js = Object.values(bundle).map(bytes => Buffer.from(bytes));
assert.ok(js.length, 'Embedded Android JS bundle missing from APK');
for (const marker of ['running-data-section', 'running-mileage-chart', 'running-milestone', 'profile-latest-history', 'all-training-history', 'bottom-navigation']) {
  assert.ok(js.some(bytes => bytes.includes(Buffer.from(marker))), `Running/history UI missing from embedded bundle: ${marker}`);
}
console.log(`APK includes GPS diagnostics, active voice control, kilometre speech, migrated history/running statistics and ${figures.length} hash-verified original action figures`);
