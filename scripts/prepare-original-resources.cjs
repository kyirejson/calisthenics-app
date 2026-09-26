// Local-only import of the user's book notes and their attachments.
// The generated text and images are intentionally gitignored until publishing rights are confirmed.
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(projectRoot, '..');
const sourceIndex = path.join(workspaceRoot, 'miniprogram-calisthenics', 'packageDetail', 'exercise-detail', 'exercise-original-texts.js');
const bookRoot = path.join(workspaceRoot, '001号', '囚徒健身全集');
const attachments = path.join(bookRoot, 'attachments');
const outputDir = path.join(projectRoot, 'src', 'data', 'private');
const imageDir = path.join(projectRoot, 'assets', 'original-images');

for (const item of [sourceIndex, bookRoot, attachments]) {
  if (!fs.existsSync(item)) throw new Error(`Missing local source: ${item}`);
}
for (const target of [outputDir, imageDir]) {
  if (!target.startsWith(projectRoot + path.sep)) throw new Error(`Unexpected output path: ${target}`);
  fs.mkdirSync(target, { recursive: true });
}

const source = require(sourceIndex);
const exercises = require(path.join(projectRoot, 'src', 'data', 'legacy', 'exercises.js'));
const resources = {};
const imageNames = new Set();
const unmatched = [];

function normalizeTitle(value) {
  return value.replace(/^(?:魔鬼)?第[一二三四五六七八九十百]+式\s*/, '')
    .replace(/^最终式\s*/, '')
    .replace(/[\s（）()·，,:：]/g, '').toLowerCase();
}

function sectionFor(exercise, original) {
  const file = path.resolve(bookRoot, original.sourceFile);
  if (!file.startsWith(bookRoot + path.sep) || !fs.existsSync(file)) return null;
  const lines = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').split('\n');
  const headings = lines.map((line, index) => {
    const match = /^(#{2,4})\s+(.+?)\s*$/.exec(line);
    return match ? { index, level: match[1].length, title: match[2] } : null;
  }).filter(Boolean);
  const catalogTitle = normalizeTitle(exercise.name);
  // Prefer the actual exercise heading. The mini-program index maps some final
  // moves to an earlier chapter overview with a similar name.
  const match = headings.find((heading) => heading.level >= 3 && normalizeTitle(heading.title) === catalogTitle)
    || headings.find((heading) => heading.title === original.title);
  if (!match) return null;
  let end = lines.length;
  for (const heading of headings) {
    if (heading.index > match.index && heading.level <= match.level) { end = heading.index; break; }
  }
  return {
    title: match.title,
    scope: match.level === 2 ? 'chapter' : 'section',
    markdown: lines.slice(match.index, end).join('\n').trim(),
  };
}

function imageInfo(markdown) {
  const lines = markdown.split('\n');
  const imageRefs = [];
  let primary = null;
  for (let i = 0; i < lines.length; i++) {
    const matches = [...lines[i].matchAll(/!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)];
    if (!matches.length) continue;
    for (const match of matches) {
      const name = path.basename(match[1]);
      const exists = fs.existsSync(path.join(attachments, name));
      imageRefs.push({ name, exists });
    }
    let next = i + 1;
    while (next < lines.length && !lines[next].trim()) next++;
    if (matches.length === 1 && /^!\[\[[^\]]+\]\]\s*$/.test(lines[i].trim()) && imageRefs.at(-1).exists && !primary && /^图\d+[\s　]/.test(lines[next] || '')) primary = imageRefs.at(-1).name;
  }
  if (!primary && imageRefs.length === 1 && imageRefs[0].exists) primary = imageRefs[0].name;
  return { imageRefs, primary };
}

const recoveryResources = {};
const recoveryImageNames = new Set();
const recoverySpecs = [
  ['recovery_shortBridge', 'trifecta_bridge', '第一式 短桥式'],
  ['recovery_bentHold', 'trifecta_lHold', '第一式 曲腿式'],
  ['recovery_easyTwist', 'trifecta_twist', '第一式 直腿扭转式'],
  ['aux_calfBeginner', 'aux_calfRaise', '阶段1：双腿地面提踵（屈腿）'],
  ['aux_singleLegCalf', 'aux_calfRaise', '阶段4：单腿地面提踵（直腿）'],
];
for (const [id, relatedId, title] of recoverySpecs) {
  const original = source[relatedId];
  const matched = sectionFor({ name: title }, { ...original, title });
  if (!matched) throw new Error(`Missing recovery source section: ${title}`);
  const { imageRefs, primary } = imageInfo(matched.markdown);
  for (const image of imageRefs) if (image.exists) recoveryImageNames.add(image.name);
  recoveryResources[id] = { title: matched.title, kind: 'book', scope: 'section', sourceFile: original.sourceFile,
    markdown: matched.markdown, primaryImageName: primary,
    missingImageNames: imageRefs.filter((image) => !image.exists).map((image) => image.name) };
}
// Neck headings repeat; explicitly match both the movement and its subsection.
const neckSourceFile = '02_囚徒健身2_古老的智慧(关节与弱点)/10_第十章_防弹衣_斗牛犬一样的脖子.md';
const neckBook = fs.readFileSync(path.join(bookRoot, neckSourceFile), 'utf8').replace(/\r\n/g, '\n');
for (const [id, movement, variant] of [
  ['neck_01', '反颈桥', '预备式'], ['neck_02', '反颈桥', '标准式'],
  ['neck_03', '正颈桥', '预备式'], ['neck_04', '正颈桥', '标准式'],
]) {
  const heading = `### ${movement}\n\n#### ${variant}`;
  const start = neckBook.indexOf(heading);
  if (start < 0) throw new Error(`Missing neck section: ${heading}`);
  const end = neckBook.indexOf('\n### ', start + heading.length);
  const markdown = neckBook.slice(start, end < 0 ? undefined : end).trim();
  const { imageRefs, primary } = imageInfo(markdown);
  for (const image of imageRefs) if (image.exists) recoveryImageNames.add(image.name);
  recoveryResources[id] = { title: movement + variant, kind: 'book', scope: 'section', sourceFile: neckSourceFile,
    markdown, primaryImageName: primary, missingImageNames: imageRefs.filter((image) => !image.exists).map((image) => image.name) };
}
const neckTips = neckBook.split('\n').filter((line) => /^1\. 热身。|^4\. 恢复。/.test(line));
if (neckTips.length !== 2) throw new Error('Missing neck warmup or recovery source');
recoveryResources.neck_handResistance = { title: '颈部训练小贴士 · 手阻抬头与恢复', kind: 'book', scope: 'section',
  sourceFile: neckSourceFile, markdown: neckTips.join('\n\n'), primaryImageName: null, missingImageNames: [] };
// This flag refreshes only the supplemental resources, preserving existing imports.
const recoveryOnly = process.argv.includes('--recovery-only');
for (const exercise of recoveryOnly ? [] : exercises) {
  const original = source[exercise.id];
  if (!original) throw new Error(`No mini-program resource for ${exercise.id}`);
  const matched = sectionFor(exercise, original);
  const markdown = matched?.markdown || original.fullText || '';
  const { imageRefs, primary } = imageInfo(markdown);
  for (const image of imageRefs) if (image.exists) imageNames.add(image.name);
  if (!matched) unmatched.push(exercise.id);
  resources[exercise.id] = {
    title: matched?.title || original.title || exercise.name,
    kind: matched ? 'book' : 'mini_program',
    scope: matched?.scope || 'supplement',
    sourceFile: matched ? original.sourceFile : null,
    markdown,
    primaryImageName: primary,
    missingImageNames: matched
      ? imageRefs.filter((image) => !image.exists).map((image) => image.name)
      : (original.images || []).filter((name) => !fs.existsSync(path.join(attachments, name))),
  };
}

for (const name of new Set([...imageNames, ...recoveryImageNames])) {
  fs.copyFileSync(path.join(attachments, name), path.join(imageDir, name));
}

const imageMapLines = [...imageNames].sort().map((name) => `  ${JSON.stringify(name)}: require('../../../assets/original-images/${name}'),`);
fs.writeFileSync(path.join(outputDir, 'recoveryTexts.ts'), [
  '// Generated from verified beginner sections; application dosing remains separate.',
  "import type { OriginalResource } from '../originalResources';",
  `export const recoveryOriginalTexts: Record<string, OriginalResource> = ${JSON.stringify(recoveryResources, null, 2)};`, '',
].join('\n'));
fs.writeFileSync(path.join(outputDir, 'recoveryImageMap.ts'), [
  '// Generated local-only beginner recovery illustrations.',
  "import type { ImageSourcePropType } from 'react-native';",
  'export const recoveryImageMap: Record<string, ImageSourcePropType> = {',
  ...[...recoveryImageNames].sort().map((name) => `  ${JSON.stringify(name)}: require('../../../assets/original-images/${name}'),`),
  '};', '',
].join('\n'));
if (!recoveryOnly) {
fs.writeFileSync(path.join(outputDir, 'imageMap.ts'), [
  '// Generated by scripts/prepare-original-resources.cjs — local-only book assets.',
  "import type { ImageSourcePropType } from 'react-native';",
  'export const originalImageMap: Record<string, ImageSourcePropType> = {',
  ...imageMapLines,
  '};',
  '',
].join('\n'));
fs.writeFileSync(path.join(outputDir, 'originalTexts.ts'), [
  '// Generated by scripts/prepare-original-resources.cjs — local-only source text.',
  "import type { OriginalResource } from '../originalResources';",
  `export const originalTexts: Record<string, OriginalResource> = ${JSON.stringify(resources, null, 2)};`,
  '',
].join('\n'));
}

const missingNames = new Set();
for (const resource of Object.values(resources)) {
  for (const name of resource.missingImageNames) missingNames.add(name);
}
console.log(JSON.stringify(recoveryOnly ? { recoverySections: Object.keys(recoveryResources).length, copiedImages: recoveryImageNames.size } : { exercises: exercises.length, verifiedBookSections: exercises.length - unmatched.length, miniProgramSupplements: unmatched.length, copiedImages: imageNames.size, missingImages: [...missingNames].sort(), unmatched }, null, 2));
