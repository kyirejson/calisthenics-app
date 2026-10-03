import AsyncStorage from '@react-native-async-storage/async-storage';
import { validSettingsReturn } from './settingsResumeCore.mjs';
const key = 'agent_connection_return_v1';
let tail: Promise<unknown> = Promise.resolve();
function serial<T>(task: () => Promise<T>): Promise<T> {
  const result = tail.then(task); tail = result.catch(() => undefined); return result;
}
/** Only a short-lived route marker. Never store input text or credentials here. */
export function markConnectionReturn() { return serial(() => AsyncStorage.setItem(key, JSON.stringify({ view: 'connection', at: Date.now() }))); }
export function clearConnectionReturn() { return serial(() => AsyncStorage.removeItem(key)); }
export function consumeConnectionReturn() { return serial(async () => {
  const raw = await AsyncStorage.getItem(key); if (!raw) return false;
  await AsyncStorage.removeItem(key);
  try { return validSettingsReturn(JSON.parse(raw)); } catch { return false; }
}); }
