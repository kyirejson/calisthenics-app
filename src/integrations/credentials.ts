import { Platform } from 'react-native';
import { readIntegrationValue, writeIntegrationValue } from './integrationStorage';
import { getConnection, installConnection, normalizeConnection, registerConnectionResetter } from './connectionRuntime.mjs';
export type DeepseekConnection = { version: number; mode: 'personal'; provider: 'deepseek'; model: string; deepseekKey: string };
const storageKey = 'uncover.agent.connection.v1';
let loaded: Promise<void> | null = null, pending: Promise<unknown> = Promise.resolve();
export function loadConnection(): Promise<void> {
  if (!loaded) loaded = (async () => {
    try {
      const saved = await readIntegrationValue(storageKey);
      const normalized = normalizeConnection(saved ? JSON.parse(saved) : null);
      if (saved && JSON.stringify(normalized) !== saved) await writeIntegrationValue(storageKey, JSON.stringify(normalized));
      installConnection(normalized);
    } catch { loaded = null; throw Error(Platform.OS === 'web' ? '无法读取浏览器本机存储，请允许本站保存数据。' : '无法读取系统安全存储，请安装新版安装包。'); }
  })();
  return loaded;
}
export async function saveConnection(value: DeepseekConnection): Promise<void> {
  await loadConnection();
  const normalized = normalizeConnection(value);
  const task = pending.then(async () => {
    try { await writeIntegrationValue(storageKey, JSON.stringify(normalized)); }
    catch { throw Error('密钥未保存：本机存储写入失败。'); }
    installConnection(normalized);
  });
  pending = task.catch(() => undefined); await task;
}
registerConnectionResetter(async () => {
  // Drain a startup read too, otherwise it could reactivate a just-deleted key.
  await loaded?.catch(() => undefined);
  const task = pending.then(async () => {
    try { await writeIntegrationValue(storageKey, null); }
    catch { throw Error('密钥清除失败，未确认本机存储已清空。'); }
    installConnection(normalizeConnection(null));
  });
  pending = task.catch(() => undefined); await task;
});
export function currentConnection(): DeepseekConnection { return getConnection() as DeepseekConnection; }
