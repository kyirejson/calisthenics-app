// Deterministic asset packaging, never image synthesis or imported book photography.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const folder = path.join(root, 'assets/equipment-demos');
const local = path.join(folder, 'sources.local');
const manifest = require(path.join(folder, 'prompts.json'));
fs.mkdirSync(local, { recursive: true });
const recordMode = process.argv[2] === '--record';
const allowPartial = process.argv.includes('--partial');

async function record(id, sourcePath) {
  const entry = manifest.movements.find(item => item.id === id);
  if (!entry || !sourcePath || !fs.existsSync(sourcePath)) throw new Error('Unknown movement or missing original: ' + id);
  const sharp = require(process.env.EQUIPMENT_SHARP_PATH || 'sharp');
  // Preserve the complete image; resizing/compression cannot alter technical geometry.
  const image = await sharp(sourcePath).rotate().resize({ width: 1448, height: 1086, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 91, mozjpeg: true }).toFile(path.join(folder, id + '.jpg'));
  const thumb = await sharp(sourcePath).rotate().resize({ width: 480, height: 360, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88, mozjpeg: true }).toFile(path.join(folder, id + '-thumb.jpg'));
  const result = { id, variant: entry.variant, width: image.width, height: image.height, bytes: image.size, thumbnailBytes: thumb.size, sourcePath, provenance: manifest.provenance };
  fs.writeFileSync(path.join(local, id + '.json'), JSON.stringify(result, null, 2) + '\n');
  return result;
}

function assemble() {
  const details = manifest.movements.flatMap(entry => {
    const filename = path.join(local, entry.id + '.json');
    if (!fs.existsSync(filename)) { if (allowPartial) return []; throw new Error('Missing image: ' + entry.id); }
    const { sourcePath, ...asset } = JSON.parse(fs.readFileSync(filename, 'utf8'));
    for (const suffix of ['.jpg', '-thumb.jpg']) if (!fs.existsSync(path.join(folder, entry.id + suffix))) throw new Error('Missing packaged asset: ' + entry.id + suffix);
    return [asset];
  });
  const lines = ["import type { ImageSourcePropType } from 'react-native';", '', 'export type EquipmentArtwork = { source: ImageSourcePropType; thumbnail: ImageSourcePropType; width: number; height: number; variant: string };', '// Independently generated demonstration assets, not book photographs or real-person photography.', 'export const equipmentArtwork: Readonly<Record<string, EquipmentArtwork>> = {'];
  for (const entry of details) lines.push(`  ${JSON.stringify(entry.id)}: { source: require('../../assets/equipment-demos/${entry.id}.jpg'), thumbnail: require('../../assets/equipment-demos/${entry.id}-thumb.jpg'), width: ${entry.width}, height: ${entry.height}, variant: ${JSON.stringify(entry.variant)} },`);
  lines.push('};', '');
  fs.writeFileSync(path.join(root, 'src/data/equipmentArtwork.ts'), lines.join('\n'));
  fs.writeFileSync(path.join(folder, 'provenance.json'), JSON.stringify({ date: '2026-10-01', tool: 'built-in image_gen', style: manifest.style, entries: details }, null, 2) + '\n');
  console.log(JSON.stringify({ count: details.length, total: manifest.movements.length, imageBytes: details.reduce((total, item) => total + item.bytes + item.thumbnailBytes, 0) }));
}

(async () => {
  if (recordMode) console.log(JSON.stringify(await record(process.argv[3], process.argv[4])));
  else assemble();
})().catch(error => { console.error(error); process.exitCode = 1; });
