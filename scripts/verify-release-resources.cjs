// Production must never silently turn missing book assets into empty mobile tabs.
const fs = require('node:fs');
const path = require('node:path');
function verifyReleaseResources(root = path.resolve(__dirname, '..')) {
 const texts = path.join(root, 'src/data/private/originalTexts.ts');
 if (!fs.existsSync(texts) || fs.statSync(texts).size < 100000) throw Error('正式安装包缺少动作原文；请在构建前提供已授权资料，不能发布空原文页。');
 let count = 0;
 for (const name of ['imageMap.ts', 'recoveryImageMap.ts', 'supplementalImageMaps.ts']) {
  const mapPath = path.join(root, 'src/data/private', name);
  if (!fs.existsSync(mapPath)) throw Error('正式安装包缺少图片索引：' + name);
  const source = fs.readFileSync(mapPath, 'utf8');
  for (const match of source.matchAll(/require\(['"]([^'"]+)['"]\)/g)) {
   if (!fs.existsSync(path.resolve(path.dirname(mapPath), match[1]))) throw Error('正式安装包缺少图片：' + match[1]);
   count++;
  }
 }
 if (count < 100) throw Error('正式安装包原图索引为空或不完整。');
 return count;
}
if (require.main === module && process.env.EAS_BUILD_PROFILE === 'production') console.log('Verified production source figures:', verifyReleaseResources());
module.exports = { verifyReleaseResources };
