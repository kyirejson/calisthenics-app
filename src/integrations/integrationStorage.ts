import { Platform } from 'react-native';

// Browser storage is local to this origin; native credentials use SecureStore.
export async function readIntegrationValue(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return window.localStorage.getItem(key);
  const store = await import('expo-secure-store');
  if (!(await store.isAvailableAsync())) throw Error('系统安全存储不可用。');
  return store.getItemAsync(key);
}
export async function writeIntegrationValue(key: string, value: string | null): Promise<void> {
  if (Platform.OS === 'web') {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
    return;
  }
  const store = await import('expo-secure-store');
  if (!(await store.isAvailableAsync())) throw Error('系统安全存储不可用。');
  if (value === null) await store.deleteItemAsync(key);
  else await store.setItemAsync(key, value, { keychainAccessible: store.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}
