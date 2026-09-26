// Public checkouts can build without redistributing privately supplied books/photos.
// Never overwrite local source material. Licensed assets may be provisioned before this step.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const privateDir = path.join(root, 'src/data/private');
fs.mkdirSync(privateDir, { recursive: true });
const resources = {
  'imageMap.ts': "import type { ImageSourcePropType } from 'react-native';\nexport const originalImageMap: Record<string, ImageSourcePropType> = {};\n",
  'recoveryImageMap.ts': "import type { ImageSourcePropType } from 'react-native';\nexport const recoveryImageMap: Record<string, ImageSourcePropType> = {};\n",
  'originalTexts.ts': "import type { OriginalResource } from '../originalResources';\nexport const originalTexts: Record<string, OriginalResource> = {};\n",
  'recoveryTexts.ts': "import type { OriginalResource } from '../originalResources';\nexport const recoveryOriginalTexts: Record<string, OriginalResource> = {};\n",
};
for (const [name, body] of Object.entries(resources)) {
  const target = path.join(privateDir, name);
  if (!fs.existsSync(target)) fs.writeFileSync(target, body);
}
const maps = ['import type { ImageSourcePropType } from \'react-native\';'];
for (const [directory, symbol] of [['skills-images', 'skillsImageMap'], ['demon-images', 'demonImageMap']]) {
  const folder = path.join(root, 'assets', directory);
  const names = fs.existsSync(folder) ? fs.readdirSync(folder).filter(name => /^[\w-]+\.(png|jpe?g|webp)$/.test(name)) : [];
  maps.push(`export const ${symbol}: Record<string, ImageSourcePropType> = {`);
  for (const name of names) maps.push(`  ${JSON.stringify(path.parse(name).name)}: require('../../../assets/${directory}/${name}'),`);
  maps.push('};');
}
fs.writeFileSync(path.join(privateDir, 'supplementalImageMaps.ts'), maps.join('\n') + '\n');
console.log('Public resource fallbacks ready; existing book resources preserved.');
