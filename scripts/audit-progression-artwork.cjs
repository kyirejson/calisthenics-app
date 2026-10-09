// Read-only inventory. File existence / dimensions do not prove a pose is correct.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
require('./lib/register-typescript.cjs')({ compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, extensions: ['.ts'] });
for (const ext of ['.png', '.jpeg', '.jpg', '.webp']) require.extensions[ext] = (module, filename) => { module.exports = filename; };
const root = path.resolve(__dirname, '..');
const { exercises } = require('../src/domain/training/catalog.ts');
const { progressionSeries, getSeriesExercises } = require('../src/domain/training/progression.ts');
const { getOriginalActionImage, getOriginalResource } = require('../src/data/originalResources.ts');
const { getExerciseArtwork } = require('../src/data/exerciseArtwork.ts');

function dimensions(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  if (bytes[0] !== 255 || bytes[1] !== 216) return null;
  let index = 2;
  while (index + 8 < bytes.length) {
    if (bytes[index++] !== 255) continue;
    while (bytes[index] === 255) index++;
    const marker = bytes[index++];
    if (marker === 217 || marker === 218) break;
    if (marker === 0 || marker === 1 || (marker >= 208 && marker <= 215)) continue;
    const length = bytes.readUInt16BE(index);
    if (length < 2 || index + length > bytes.length) break;
    if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) return { width: bytes.readUInt16BE(index + 5), height: bytes.readUInt16BE(index + 3) };
    index += length;
  }
  return null;
}
function metadata(filename) {
  if (!filename || !fs.existsSync(filename)) return { exists: false };
  const bytes = fs.readFileSync(filename);
  return { exists: true, ...dimensions(bytes), bytes: bytes.length, hash: crypto.createHash('sha256').update(bytes).digest('hex') };
}
const assigned = progressionSeries.flatMap(route => getSeriesExercises(route.key).map(exercise => ({ exercise, series: route.key, group: route.group })));
assigned.push(...exercises.filter(exercise => exercise.category === 'auxiliary').map(exercise => ({ exercise, series: 'auxiliary', group: '关节与支援' })));
const rows = assigned.map(({ exercise, series, group }) => {
  const original = getOriginalActionImage(exercise.id);
  const artwork = getExerciseArtwork(exercise);
  const source = typeof artwork.cover?.source === 'string' ? artwork.cover.source : undefined;
  const resource = getOriginalResource(exercise.id);
  return { id: exercise.id, name: exercise.name, series, group, step: exercise.step, source: source ? path.relative(root, source).replaceAll('\\', '/') : null,
    kind: artwork.cover?.kind || 'missing', missingReason: artwork.missingReason,
    ...metadata(source), originalSource: original ? path.relative(root, original).replaceAll('\\', '/') : null,
    originalMetadata: original ? metadata(original) : null, resource: resource ? { title: resource.title, kind: resource.kind, scope: resource.scope, file: resource.sourceFile, primary: resource.primaryImageName } : null,
    point: exercise.keyPoints?.[0], standard: exercise.standards?.upgrade,
    figures: [...(resource?.markdown || '').matchAll(/!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)].map(match => match[1]),
    displayFrames: artwork.frames.map(frame => ({ key: frame.key, source: typeof frame.source === 'string' ? path.relative(root, frame.source).replaceAll('\\', '/') : undefined })),
  };
});
const byHash = new Map();
for (const row of rows) if (row.hash) { if (!byHash.has(row.hash)) byHash.set(row.hash, []); byHash.get(row.hash).push({ id: row.id, name: row.name, source: row.source }); }
const duplicates = [...byHash.values()].filter(group => group.length > 1);
const summary = { routes: progressionSeries.length, actions: rows.length, local: rows.filter(row => row.exists).length,
  missing: rows.filter(row => !row.exists).map(row => ({ id: row.id, name: row.name })),
  small: rows.filter(row => row.exists && (row.width < 180 || row.height < 180)).map(row => ({ id: row.id, name: row.name, width: row.width, height: row.height })), duplicates };
const ids = process.argv.find(arg => arg.startsWith('--ids='))?.slice(6).split(',');
const requestedGroup = process.argv.find(arg => arg.startsWith('--group='))?.slice(8);
const selected = rows.filter(row => (!ids || ids.includes(row.id)) && (!requestedGroup || row.group === requestedGroup));
if (process.argv.includes('--source-text')) for (const row of selected) row.sourceText = getOriginalResource(row.id)?.markdown || '';
console.log(JSON.stringify(process.argv.includes('--frames-only') ? selected.map(row => ({ id: row.id, figures: row.figures })) : process.argv.includes('--json') ? { summary, rows: selected } : summary, null, 2));
