import { JOURNAL_KEY } from './journalStore.mjs';

const owned = key => key === JOURNAL_KEY || key.startsWith(JOURNAL_KEY + ':');

// The small committed head and anonymous identity stay in existing native storage.
// Immutable event/artifact bodies use private files, outside AsyncStorage's shared DB quota.
export function createFileJournalStorage(metadata, files) {
  const body = key => key.startsWith(JOURNAL_KEY + ':');
  return {
    getItem: key => body(key) ? files.read(key) : metadata.getItem(key),
    setItem: (key, value) => body(key) ? files.write(key, value) : metadata.setItem(key, value),
    removeItem: key => body(key) ? files.remove(key) : metadata.removeItem(key),
    getAllKeys: async () => [...await metadata.getAllKeys(), ...await files.keys()],
  };
}

// Browser bodies and commit pointers use one IndexedDB object store. Requests resolve
// on transaction completion, not merely on the request's earlier onsuccess callback.
export function createIndexedJournalStorage(metadata, indexedDB) {
  let opening = null;
  function open() {
    if (!indexedDB) return Promise.reject(Error('浏览器未提供 IndexedDB，无法可靠保存会话；请使用正常浏览窗口。'));
    if (!opening) {
      const job = new Promise((resolve, reject) => {
        const request = indexedDB.open(JOURNAL_KEY, 1);
        let abandoned = false;
        request.onupgradeneeded = () => request.result.createObjectStore('records');
        request.onerror = () => reject(request.error || Error('无法打开浏览器会话存储。'));
        request.onblocked = () => { abandoned = true; reject(Error('浏览器会话存储升级被旧窗口占用，请关闭旧窗口重试。')); };
        request.onsuccess = () => {
          const db = request.result;
          if (abandoned) { db.close(); return; }
          db.onversionchange = () => { db.close(); opening = null; };
          resolve(db);
        };
      }).catch(error => { if (opening === job) opening = null; throw error; });
      opening = job;
    }
    return opening;
  }
  async function transaction(mode, action) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('records', mode);
      const request = action(tx.objectStore('records'));
      tx.oncomplete = () => resolve(request.result ?? null);
      tx.onerror = tx.onabort = () => reject(tx.error || request.error || Error('浏览器会话保存失败，未提交本次记录。'));
    });
  }
  return {
    getItem: key => owned(key) ? transaction('readonly', store => store.get(key)) : metadata.getItem(key),
    setItem: (key, value) => owned(key) ? transaction('readwrite', store => store.put(value, key)) : metadata.setItem(key, value),
    removeItem: key => owned(key) ? transaction('readwrite', store => store.delete(key)) : metadata.removeItem(key),
    getAllKeys: async () => [...await metadata.getAllKeys(), ...await transaction('readonly', store => store.getAllKeys())],
  };
}
