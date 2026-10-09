import fs from 'node:fs';
import path from 'node:path';
import { validateLibraries } from './bundle-writer.mjs';
export function readBundledLibraries(project, includePrivate = false) {
  const decode = source => JSON.parse(source.split('export default ')[1].trim().replace(/;$/, ''));
  const approved = decode(fs.readFileSync(path.join(project, 'src/knowledge/referenceBundle.ts'), 'utf8'));
  if (!includePrivate) return validateLibraries(approved);
  const file = path.join(project, 'src/knowledge/private/bundle.ts');
  if (!fs.existsSync(file)) return validateLibraries(approved);
  const source = fs.readFileSync(file, 'utf8');
  if (/export\s*\{\s*default\s*\}/.test(source)) return validateLibraries(approved);
  const match = /export default \[\.\.\.referenceLibraries,\s*\.\.\.(\[[\s\S]*\])\];?\s*$/.exec(source);
  const libraries = match ? [...approved, ...JSON.parse(match[1])] : decode(source);
  return validateLibraries(libraries);
}
export function readKnowledgeCollection(project) {
  const root = path.join(project, 'knowledge/libraries');
  if (!fs.existsSync(root)) throw Error('缺少本机 Markdown 副本，请先运行 knowledge:import；安装包读取不需要这个目录。');
  const libraries = fs.readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory() && !entry.isSymbolicLink()).map(entry => {
    const directory = path.join(root, entry.name), metadata = JSON.parse(fs.readFileSync(path.join(directory, 'library.json'), 'utf8'));
    const documents = metadata.documents.map(note => {
      const file = path.resolve(directory, note.path);
      if (!file.startsWith(path.resolve(directory) + path.sep) || fs.lstatSync(file).isSymbolicLink()) throw Error('不允许资料库外笔记或符号链接');
      return { ...note, markdown: fs.readFileSync(file, 'utf8') };
    });
    return { version: metadata.version, id: metadata.id, name: metadata.name, documents };
  });
  return validateLibraries(libraries);
}
