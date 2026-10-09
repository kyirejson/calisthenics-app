import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// One-time removal migration. Business records and nutrition photos are not targets.
export async function clearRetiredAssistantStorage(): Promise<void> {
  const marker = 'retired_harness_preserve_integrations_v2';
  if (await AsyncStorage.getItem(marker)) return;
  if (Platform.OS === 'web') {
    if (typeof indexedDB !== 'undefined')
      for (const name of ['uncover-assistant-memory-v2', 'uncover-agent-markdown-v3']) {
        await new Promise<void>((resolve, reject) => {
          const request = indexedDB.deleteDatabase(name);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(Error('旧助手数据清理失败。'));
          request.onblocked = () => reject(Error('请关闭旧版本页面后刷新，以清理旧助手数据。'));
        });
      }
  } else {
    const { Directory, File, Paths } = await import('expo-file-system');
    const memory = new Directory(Paths.document, 'agent-private-memory-v3');
    if (memory.exists) memory.delete();
    // SQLite is no longer a dependency. Delete only the two retired owned files.
    for (const name of ['agent-memory-pointer-v3.db', 'uncover-assistant-memory-v2.db']) {
      for (const suffix of ['', '-wal', '-shm', '-journal']) {
        const file = new File(Paths.document, 'SQLite', name + suffix);
        if (file.exists) file.delete();
      }
    }
  }
  await AsyncStorage.multiRemove(['agent_connection_return_v1']);
  await AsyncStorage.setItem(marker, '1');
}
