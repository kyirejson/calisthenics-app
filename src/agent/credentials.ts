import { Platform } from 'react-native';
import { getConnection, installConnection, normalizeConnection, registerConnectionResetter } from './connectionRuntime.mjs';
export type AgentConnection = { version: number; mode: 'personal' | 'gateway'; provider: 'deepseek' | 'glm'; model: string; deepseekKey: string; tavilyKey: string; glmKey: string };
const storageKey = 'uncover.agent.connection.v1';
let loaded: Promise<void> | null = null, pending: Promise<unknown> = Promise.resolve();
export function defaultConnectionMode(): 'personal' | 'gateway' {
  return Platform.OS === 'web' && typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname) ? 'gateway' : 'personal';
}
export function loadAgentConnection(): Promise<void> {
  if (!loaded) loaded = (async () => {
    if (Platform.OS === 'web') { installConnection(normalizeConnection(null, defaultConnectionMode())); return; }
    try {
      const store = await import('expo-secure-store');
      if (!(await store.isAvailableAsync())) throw Error();
      const saved = await store.getItemAsync(storageKey);
      installConnection(normalizeConnection(saved ? JSON.parse(saved) : null));
    } catch { loaded = null; throw Error('无法读取系统安全存储，请安装含 SecureStore 的新版安装包；没有使用普通存储降级。'); }
  })();
  return loaded;
}
export async function saveAgentConnection(value: AgentConnection): Promise<void> {
  await loadAgentConnection();
  const normalized = normalizeConnection(value);
  const task = pending.then(async () => {
    if (Platform.OS !== 'web') {
      try {
        const store = await import('expo-secure-store');
        await store.setItemAsync(storageKey, JSON.stringify(normalized), { keychainAccessible: store.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
      } catch { throw Error('密钥未保存：系统安全存储写入失败。'); }
    }
    installConnection(normalized);
  });
  pending = task.catch(() => undefined); await task;
}
registerConnectionResetter(async () => {
  // Drain a startup read too, otherwise it could reactivate a just-deleted key.
  await loaded?.catch(() => undefined);
  await pending;
  if (Platform.OS !== 'web') {
    try { const store = await import('expo-secure-store'); await store.deleteItemAsync(storageKey); }
    catch { throw Error('密钥清除失败，未确认系统安全存储已清空。'); }
  }
  installConnection(normalizeConnection(null, defaultConnectionMode()));
});
export function currentAgentConnection(): AgentConnection { return getConnection(defaultConnectionMode()) as AgentConnection; }
