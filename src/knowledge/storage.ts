import { Directory, File, Paths } from 'expo-file-system';
import type { KnowledgeVault } from './types';
import { createKnowledgeStore, validateLibraryId } from './collection.mjs';
import { normalizedPath } from './vault.mjs';
import { createAtomicVaultWriter, validateVault } from './atomicVault.mjs';

const root = new Directory(Paths.document, 'knowledge', 'libraries');
const catalogue = new File(root, 'libraries.json');
const journal = new File(root, 'transaction.json');
const rollback = new File(root, 'transaction.rollback');
function readCatalog(): { id: string; name: string }[] {
  const entries = catalogue.exists ? JSON.parse(catalogue.textSync()) : [];
  if (!Array.isArray(entries)) throw Error('知识库目录损坏，未覆盖原文件');
  for (const entry of entries) validateLibraryId(entry.id);
  return entries;
}
function noteFile(id: string, path: string, create = false) {
  validateLibraryId(id);
  if (normalizedPath(path) !== path || !path.endsWith('.md')) throw Error('笔记路径无效');
  const parts = path.split('/'),
    name = parts.pop()!;
  const folder = new Directory(root, id, ...parts);
  if (create) folder.create({ intermediates: true, idempotent: true });
  return new File(folder, name);
}
async function readVault(id: string): Promise<KnowledgeVault | null> {
  validateLibraryId(id);
  const metadata = new File(root, id, 'library.json');
  if (!metadata.exists) return null;
  const vault: KnowledgeVault = JSON.parse(await metadata.text());
  if (vault.id !== id) throw Error('知识库标识与目录不一致');
  const documents = await Promise.all(
    vault.documents.map(async (note) => ({
      ...note,
      markdown: await noteFile(id, note.path).text(),
    })),
  );
  return validateVault({ ...vault, documents });
}
function write(file: File, text: string) {
  if (!file.exists) file.create();
  file.write(text);
}
const writer = createAtomicVaultWriter({
  readJournal: async () => (journal.exists ? journal.text() : null),
  isRollback: async () => rollback.exists,
  async prepare(text) {
    root.create({ intermediates: true, idempotent: true });
    if (rollback.exists) rollback.delete();
    const staged = new File(root, 'transaction.staged');
    write(staged, JSON.stringify({ ...JSON.parse(text), catalogue: readCatalog() }));
    staged.move(journal); // New journal path: there is no overwritten intent to tear.
  },
  async markRollback() {
    if (!rollback.exists) rollback.create();
  },
  async apply(vault, id, previous) {
    const keep = new Set(vault?.documents.map((note) => note.path) ?? []);
    if (vault) {
      new Directory(root, id).create({ intermediates: true, idempotent: true });
      for (const note of vault.documents) write(noteFile(id, note.path, true), note.markdown);
      write(
        new File(root, id, 'library.json'),
        JSON.stringify({
          ...vault,
          documents: vault.documents.map(({ markdown, ...note }) => ({ ...note, markdown: '' })),
        }),
      );
    } else {
      const metadata = new File(root, id, 'library.json');
      if (metadata.exists) metadata.delete();
    }
    // Recover from a torn catalogue using the complete catalogue in the durable intent.
    const saved = JSON.parse(await journal.text()).catalogue;
    if (!Array.isArray(saved)) throw Error('恢复日志缺少资料库目录');
    for (const entry of saved) validateLibraryId(entry.id);
    const entries = saved.filter((entry: { id: string; name: string }) => entry.id !== id);
    if (vault) entries.push({ id, name: vault.name });
    write(catalogue, JSON.stringify(entries));
    for (const note of previous?.documents ?? [])
      if (!keep.has(note.path)) {
        const file = noteFile(id, note.path);
        if (file.exists) file.delete();
      }
  },
  async removeJournal() {
    // Delete the intent first; an orphan rollback marker is harmless and removed on next prepare.
    if (journal.exists) journal.delete();
    if (rollback.exists) rollback.delete();
  },
});
const store = createKnowledgeStore(
  {
    async resetLegacy() {
      await writer.recover();
      // Only the retired one-library application cache, never source books or MEMORY.md.
      const old = new Directory(Paths.document, 'knowledge', 'prisoner');
      if (old.exists) old.delete();
    },
    async readAll() {
      await writer.recover();
      const libraries: KnowledgeVault[] = [];
      for (const entry of readCatalog()) {
        const vault = await readVault(entry.id);
        if (!vault) throw Error('知识库目录缺少正文，未写入空记录');
        libraries.push(vault);
      }
      return libraries;
    },
    async writeVault(vault) {
      await writer.write(await readVault(vault.id), vault);
    },
  },
  async () => (await import('./private/bundle')).default as KnowledgeVault[],
);
export const loadKnowledgeLibraries = store.list;
export const createKnowledgeLibrary = store.create;
export const importKnowledgeNotes = store.importNotes;
export const resolveKnowledgeConflict = store.resolveConflict;
