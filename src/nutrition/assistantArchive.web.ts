import { archiveCursor, archiveSearchTokens, rankArchive, validatedTurn, type AssistantArchive } from './assistantArchiveCore';
import { memoryTokens, memoryTimeRange } from './personalKnowledge';
import type { AssistantConversation } from './assistantState';

let database: Promise<IDBDatabase> | undefined;
function db() {
  if (!database) database = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('浏览器不支持长期记忆数据库；原数据仍保留。')); return; }
    const r = indexedDB.open('uncover-assistant-memory-v2', 1);
    r.onupgradeneeded = () => {
      const turns = r.result.createObjectStore('turns', { keyPath: 'id' });
      turns.createIndex('cursor', 'cursor', { unique: true }); turns.createIndex('tokens', 'tokens', { multiEntry: true });
      r.result.createObjectStore('meta');
    };
    r.onerror = () => reject(new Error('长期记忆数据库读取失败，未覆盖原数据。'));
    r.onblocked = () => reject(new Error('记忆数据库升级被其他页面占用，请关闭重复页面重试。'));
    r.onsuccess = () => { const value = r.result; value.onversionchange = () => { value.close(); database = undefined; }; resolve(value); };
  }).catch(error => { database = undefined; throw error; });
  return database;
}
async function transaction<T>(mode: IDBTransactionMode, run: (tx: IDBTransaction, done: (value: T) => void) => void): Promise<T> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(['turns', 'meta'], mode); let value: T;
    tx.oncomplete = () => resolve(value);
    tx.onabort = tx.onerror = () => reject(new Error('长期记忆未能读写，请检查浏览器权限或剩余空间。'));
    try { run(tx, result => { value = result; }); } catch (error) { tx.abort(); reject(error); }
  });
}
const row = (t: AssistantConversation) => ({ ...t, cursor: archiveCursor(t), tokens: memoryTokens(t.question) });
const clean = (t: AssistantConversation) => validatedTurn(t);
export const assistantArchive: AssistantArchive = {
  async migrate(turns) {
    const valid = turns.map(validatedTurn);
    await transaction<void>('readwrite', tx => {
      const r = tx.objectStore('meta').get('legacy-imported');
      r.onsuccess = () => { if (!r.result) { for (const t of valid) tx.objectStore('turns').put(row(t)); tx.objectStore('meta').put(true, 'legacy-imported'); } };
    });
  },
  async put(turn) { const t = validatedTurn(turn); await transaction<void>('readwrite', tx => { tx.objectStore('turns').put(row(t)); }); },
  async list(query = {}) {
    const range = memoryTimeRange(query.question || '', query.now), tokens = archiveSearchTokens(query.question || '');
    const temporal = !!range || !tokens.length;
    const rows = await transaction<AssistantConversation[]>('readonly', (tx, done) => {
      const store = tx.objectStore('turns'), found = new Map<string, AssistantConversation>();
      if (query.question && tokens.length && !temporal) {
        let remaining = tokens.length;
        for (const token of tokens) {
          const r = store.index('tokens').getAll(token);
          r.onsuccess = () => { r.result.forEach(t => found.set(t.id, clean(t))); if (!--remaining) done([...found.values()]); };
        }
      } else {
        const bounds = query.before ? IDBKeyRange.upperBound(query.before, true) : undefined;
        const r = store.index('cursor').openCursor(bounds, 'prev');
        r.onsuccess = () => {
          const cursor = r.result;
          if (!cursor) { done([...found.values()]); return; }
          const t = clean(cursor.value);
          if ((!query.topic || !t.topic || query.topic === t.topic) && (!range || t.createdAt >= range.start && t.createdAt < range.end)) found.set(t.id, t);
          if (found.size >= (query.limit || 30)) done([...found.values()]); else cursor.continue();
        };
      }
    });
    return rankArchive(rows, query);
  },
  async forget(text) {
    if (!text.trim()) throw new Error('待忘记的信息不能为空。');
    await transaction<void>('readwrite', tx => {
      const r = tx.objectStore('turns').openCursor();
      r.onsuccess = () => { const cursor = r.result; if (!cursor) return; const t = cursor.value; if (t.question.includes(text) || t.answer.includes(text)) cursor.delete(); cursor.continue(); };
    });
  },
  async clear() { await transaction<void>('readwrite', tx => { tx.objectStore('turns').clear(); }); },
  async exportAll() { return transaction<AssistantConversation[]>('readonly', (tx, done) => { const r = tx.objectStore('turns').index('cursor').getAll(); r.onsuccess = () => done(r.result.map(clean)); }); },
};
