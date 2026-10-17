import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { createFileJournalStorage } from './journalPersistence.mjs';

const directory = new Directory(Paths.document, 'max-agent-journal');
const fileFor = (key: string) => new File(directory, encodeURIComponent(key) + '.json');

export const agentStorage = createFileJournalStorage(AsyncStorage, {
  async read(key: string) { const file = fileFor(key); return file.exists ? file.text() : null; },
  async write(key: string, value: string) {
    directory.create({ intermediates: true, idempotent: true });
    // Only the uncommitted suffix is written here; the small DB head is committed afterward.
    const file = fileFor(key); if (!file.exists) file.create(); file.write(value);
  },
  async remove(key: string) { const file = fileFor(key); if (file.exists) file.delete(); },
  async keys() {
    if (!directory.exists) return [];
    return directory.list().flatMap(entry => {
      if (!(entry instanceof File) || !entry.name.endsWith('.json')) return [];
      try { return [decodeURIComponent(entry.name.slice(0, -5))]; } catch { return []; }
    });
  },
});
