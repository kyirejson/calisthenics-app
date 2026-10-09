import fs from 'node:fs';
import path from 'node:path';
import { validateLibraryId } from '../../../src/knowledge/collection.mjs';
import { validateVault } from '../../../src/knowledge/atomicVault.mjs';

// Distribution is explicit: newly imported libraries remain local/private.
const publishedIds = new Set(['nutrition', 'prisoner']);

export function validateLibraries(libraries) {
  if (!Array.isArray(libraries)) throw Error('知识库种子必须是资料库数组。');
  const ids = new Set();
  for (const library of libraries) {
    validateVault(library);
    validateLibraryId(library?.id);
    if (ids.has(library.id)) throw Error('资料库 ID 重复：' + library.id);
    ids.add(library.id);
    if (library.version !== 1 || typeof library.name !== 'string' || !library.name.trim() || !Array.isArray(library.documents)) throw Error('资料库结构无效。');
    const paths = new Set();
    for (const note of library.documents) {
      if (typeof note.path !== 'string' || typeof note.markdown !== 'string' || paths.has(note.path)) throw Error('笔记结构无效或路径重复。');
      paths.add(note.path);
    }
  }
  return libraries;
}
export function buildSeedModules(libraries) {
  validateLibraries(libraries);
  const published = libraries.filter(library => publishedIds.has(library.id));
  const privateOnly = libraries.filter(library => !publishedIds.has(library.id));
  return {
    publicModule: '// Generated public text reference libraries; source Markdown is authoritative.\nexport default ' + JSON.stringify(published) + ';\n',
    privateModule: privateOnly.length
      ? "// Generated private overlay; approved text is stored only in referenceBundle.\nimport referenceLibraries from '../referenceBundle';\nexport default [...referenceLibraries, ..." + JSON.stringify(privateOnly) + '];\n'
      : "// Approved text is stored only in referenceBundle.\nexport { default } from '../referenceBundle';\n",
  };
}

export function writeKnowledgeBundles(project, libraries) {
  // Validate every input before touching generated outputs. Never write notes.
  const modules = buildSeedModules(libraries);
  const directory = path.join(project, 'src', 'knowledge');
  fs.mkdirSync(path.join(directory, 'private'), { recursive: true });
  fs.writeFileSync(path.join(directory, 'referenceBundle.ts'), modules.publicModule);
  fs.writeFileSync(path.join(directory, 'private', 'bundle.ts'), modules.privateModule);
  return { libraries: libraries.length, publicBytes: Buffer.byteLength(modules.publicModule), privateBytes: Buffer.byteLength(modules.privateModule) };
}
