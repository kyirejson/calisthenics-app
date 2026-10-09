import type { KnowledgeVault } from './types';
import { createKnowledgeStore } from './collection.mjs';
import { validateVault } from './atomicVault.mjs';
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let blocked = false;
    const request = indexedDB.open('uncover-knowledge', 2);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains('notes')) db.createObjectStore('notes');
      if (!db.objectStoreNames.contains('libraries'))
        db.createObjectStore('libraries', { keyPath: 'id' });
      if (event.oldVersion === 1) request.transaction!.objectStore('notes').clear();
    };
    request.onsuccess = () => {
      if (blocked) request.result.close();
      else resolve(request.result);
    };
    request.onerror = () => reject(request.error ?? Error('无法打开知识库'));
    request.onblocked = () => {
      blocked = true;
      reject(Error('请关闭旧版知识库页面后重试'));
    };
  });
}
const store = createKnowledgeStore(
  {
    async resetLegacy() {
      const db = await database();
      db.close();
    },
    async readAll() {
      const db = await database();
      try {
        return await new Promise<KnowledgeVault[]>((resolve, reject) => {
          const tx = db.transaction(['libraries', 'notes']),
            request = tx.objectStore('libraries').getAll();
          let libraries: KnowledgeVault[] = [];
          request.onsuccess = () => {
            try {
              libraries = request.result;
              for (const library of libraries) {
                validateVault(library);
                for (const note of library.documents) {
                  const read = tx.objectStore('notes').get(library.id + '/' + note.path);
                  read.onsuccess = () => {
                    if (typeof read.result !== 'string') {
                      tx.abort();
                      return;
                    }
                    note.markdown = read.result;
                  };
                }
              }
            } catch (error) {
              tx.abort();
              reject(error);
            }
          };
          tx.oncomplete = () => resolve(libraries);
          tx.onabort = tx.onerror = () => reject(tx.error ?? Error('知识库读取失败'));
        });
      } finally {
        db.close();
      }
    },
    async writeVault(vault) {
      validateVault(vault);
      const db = await database();
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(['libraries', 'notes'], 'readwrite');
          tx.oncomplete = () => resolve();
          tx.onerror = tx.onabort = () => reject(tx.error ?? Error('知识库保存失败'));
          // A synchronous put/delete error must also cancel requests already queued in this transaction.
          const fail = (error: unknown) => {
            try {
              tx.abort();
            } catch {
              /* Already inactive. */
            }
            reject(error);
          };
          try {
            const previous = tx.objectStore('libraries').get(vault.id);
            previous.onsuccess = () => {
              try {
                const keep = new Set(vault.documents.map((note) => note.path));
                for (const note of previous.result?.documents ?? [])
                  if (!keep.has(note.path))
                    tx.objectStore('notes').delete(vault.id + '/' + note.path);
              } catch (error) {
                fail(error);
              }
            };
            tx.objectStore('libraries').put({
              ...vault,
              documents: vault.documents.map(({ markdown, ...note }) => ({
                ...note,
                markdown: '',
              })),
            });
            for (const note of vault.documents)
              tx.objectStore('notes').put(note.markdown, vault.id + '/' + note.path);
          } catch (error) {
            fail(error);
          }
        });
      } finally {
        db.close();
      }
    },
  },
  async () => (await import('./private/bundle')).default as KnowledgeVault[],
);
export const loadKnowledgeLibraries = store.list;
export const createKnowledgeLibrary = store.create;
export const importKnowledgeNotes = store.importNotes;
export const resolveKnowledgeConflict = store.resolveConflict;
