// Check the actual release artifact, not just the source submitted to the builder.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { unzipSync } = require('fflate');
const file = process.argv[2];
assert.ok(file, 'Usage: node scripts/inspect-apk-running-diagnostics.cjs <apk>');
const entries = unzipSync(fs.readFileSync(file), { filter: entry => /^classes\d*\.dex$/.test(entry.name) });
const dex = Object.values(entries).map(bytes => Buffer.from(bytes));
assert.ok(dex.length, 'APK has no DEX files');
for (const symbol of ['Luncover/running/GpsDiagnostics;', 'Luncover/running/GpsSubscription;', 'Luncover/running/MotionGate;', 'Luncover/running/MotionSources;', 'Luncover/running/RunSteps;', 'Luncover/running/StepEvidence;', 'Luncover/running/RunVoice;', 'mapLocation', 'mapPosition', 'auxiliaryProviders', 'networkAvailable', 'autoPaused', 'stepCount']) {
  assert.ok(dex.some(bytes => bytes.includes(Buffer.from(symbol))), `GPS repair missing from APK: ${symbol}`);
}
const figures = [];
unzipSync(fs.readFileSync(file), { filter: entry => { if (/^res\//.test(entry.name) && /originalimages/.test(entry.name)) figures.push(entry.name); return false; } });
assert.ok(figures.length >= 100, `Original action figures missing from APK (${figures.length})`);
console.log(`APK includes GPS diagnostics, automatic pause, hardware step tracking, speech and ${figures.length} original action figures`);
