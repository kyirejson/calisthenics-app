import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readBundledLibraries, readKnowledgeCollection } from './lib/knowledge/seed-files.mjs';
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundled = readBundledLibraries(project, true);
for (const library of bundled) for (const note of library.documents) {
  if (createHash('sha256').update(note.markdown).digest('hex') !== note.sha256) throw Error('正文哈希不符：' + library.id + '/' + note.path);
}
const local = path.join(project, 'knowledge/libraries');
if (fs.existsSync(local)) {
  const copies = readKnowledgeCollection(project);
  if (JSON.stringify(copies) !== JSON.stringify(bundled)) throw Error('Markdown 副本与安装种子不同，请运行 knowledge:build 后再检查。');
}
console.log(JSON.stringify({ ready: true, libraries: bundled.map(library => ({ id: library.id, name: library.name, notes: library.documents.length })), notes: bundled.reduce((total, library) => total + library.documents.length, 0), sourceCopyChecked: fs.existsSync(local) }));
