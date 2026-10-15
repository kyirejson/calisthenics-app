export const DEFAULT_PERSONAL_MODEL = 'deepseek-flash';
let current = null, resetter = null, modelVerified = false;
const subscribers = new Set();
export function normalizeConnection(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) value = {};
  const key = (input, prefix) => {
    if (input === '' || input == null) return '';
    if (typeof input !== 'string' || !new RegExp('^' + prefix + '[A-Za-z0-9_-]{8,500}$').test(input.trim())) throw Error('密钥格式不正确，请从相应官方平台复制。');
    return input.trim();
  };
  const provider = 'deepseek', model = value.model == null || value.model === '' ? DEFAULT_PERSONAL_MODEL : value.model;
  if (typeof model !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$/.test(model.trim())) throw Error('模型 ID 格式不正确，请使用 DeepSeek 平台提供的模型 ID。');
  return { version: 1, mode: 'personal',
    provider, model: model.trim(),
    deepseekKey: key(value.deepseekKey, 'sk-') };
}
export function getConnection() { return { ...(current || normalizeConnection(null)) }; }
export function installConnection(value) {
  const next = normalizeConnection(value), old = getConnection();
  if (next.deepseekKey !== old.deepseekKey || next.model !== old.model) modelVerified = false;
  current = Object.freeze(next);
  for (const listener of subscribers) { try { listener(); } catch { /* Observer cannot break saved configuration. */ } }
}
export function connectionSummary() {
  const value = getConnection();
  return { mode: value.mode, provider: value.provider, model: value.model, hasDeepseek: !!value.deepseekKey, modelVerified };
}
// Verification is session-only, bound to the exact model/key tested. It cannot
// survive a key change or be inferred from merely having a saved credential.
export function setModelConnectionVerified(tested, verified) {
  const value = getConnection();
  if (!value.deepseekKey || value.deepseekKey !== tested.deepseekKey || value.model !== tested.model) return false;
  modelVerified = verified === true;
  for (const listener of subscribers) { try { listener(); } catch { /* Isolated observer. */ } }
  return true;
}

export function subscribeConnection(listener) { subscribers.add(listener); return () => { subscribers.delete(listener); }; }
export function registerConnectionResetter(callback) { resetter = callback; }
export async function resetConnection() {
  if (resetter) await resetter();
  else installConnection({ mode: 'personal' });
}
