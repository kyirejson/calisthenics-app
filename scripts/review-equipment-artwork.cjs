// Visual QA sheets, not app images. App assets remain separate single-pose images.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sharp = require(process.env.EQUIPMENT_SHARP_PATH || 'sharp');
const root = path.resolve(__dirname, '..');
const folder = path.join(root, 'assets/equipment-demos');
const manifest = require(path.join(folder, 'prompts.json'));
const selectedGroup = process.argv[2];
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'uncover-equipment-review-'));
(async () => {
  for (const group of ['chest', 'shoulders', 'back', 'legs', 'core', 'arms']) {
    if (selectedGroup && selectedGroup !== group) continue;
    const entries = manifest.movements.filter(item => item.id.startsWith('equipment_' + group + '_') && fs.existsSync(path.join(folder, item.id + '.jpg')));
    if (!entries.length) continue;
    const columns = 3, tileWidth = 480, imageHeight = 360, tileHeight = 398;
    const layers = [];
    for (const [i, item] of entries.entries()) {
      const image = await sharp(path.join(folder, item.id + '.jpg')).resize(tileWidth, imageHeight, { fit: 'contain', background: '#202630' }).toBuffer();
      const escaped = item.variant.replace(/&/g, '&amp;').replace(/</g, '&lt;');
      const label = Buffer.from(`<svg width="${tileWidth}" height="38"><rect width="100%" height="100%" fill="#0D1114"/><text x="8" y="24" fill="white" font-family="Microsoft YaHei, sans-serif" font-size="16">${item.id.split('_').at(-1)} ${escaped}</text></svg>`);
      layers.push({ input: image, left: i % columns * tileWidth, top: Math.floor(i / columns) * tileHeight });
      layers.push({ input: label, left: i % columns * tileWidth, top: Math.floor(i / columns) * tileHeight + imageHeight });
    }
    const filename = path.join(output, group + '.png');
    await sharp({ create: { width: columns * tileWidth, height: Math.ceil(entries.length / columns) * tileHeight, channels: 3, background: '#202630' } }).composite(layers).png().toFile(filename);
    console.log(JSON.stringify({ group, count: entries.length, file: filename }));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
