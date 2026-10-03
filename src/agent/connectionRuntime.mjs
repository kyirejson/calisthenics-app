// In-memory runtime channel only. No storage, logging, archive or export here.
export const PERSONAL_MODELS = ['deepseek-flash', 'deepseek-v4-pro'];
export const GLM_MODELS = ['glm-4.7', 'glm-4.5-air'];
let current = null, resetter = null;
const subscribers = new Set();
export function normalizeConnection(value, defaultMode = 'personal') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) value = {};
  const key = (input, prefix) => {
    if (input === '' || input == null) return '';
    if (typeof input !== 'string' || !new RegExp('^' + prefix + '[A-Za-z0-9_-]{8,500}$').test(input.trim())) throw Error('密钥格式不正确，请从相应官方平台复制。');
    return input.trim();
  };
  const provider = value.provider === 'glm' ? 'glm' : 'deepseek', models = provider === 'glm' ? GLM_MODELS : PERSONAL_MODELS;
  const glmKey = value.glmKey == null || value.glmKey === '' ? '' : typeof value.glmKey === 'string' && /^[A-Za-z0-9_-]{8,250}\.[A-Za-z0-9_-]{8,250}$/.test(value.glmKey.trim()) ? value.glmKey.trim() : null;
  if (glmKey === null) throw Error('智谱密钥格式不正确，请从官方平台复制完整 API Key。');
  return { version: 1, mode: value.mode === 'gateway' ? 'gateway' : value.mode === 'personal' ? 'personal' : defaultMode,
    provider, model: models.includes(value.model) ? value.model : models[0],
    deepseekKey: key(value.deepseekKey, 'sk-'), tavilyKey: key(value.tavilyKey, 'tvly-'), glmKey };
}
export function getConnection(defaultMode = 'personal') { return { ...(current || normalizeConnection(null, defaultMode)) }; }
export function installConnection(value) {
  current = Object.freeze(normalizeConnection(value));
  for (const listener of subscribers) { try { listener(); } catch { /* Observer cannot break saved configuration. */ } }
}
export function connectionSummary(defaultMode = 'personal') {
  const value = getConnection(defaultMode);
  return { mode: value.mode, provider: value.provider, model: value.model, hasDeepseek: !!value.deepseekKey, hasTavily: !!value.tavilyKey, hasGlm: !!value.glmKey };
}
export function subscribeConnection(listener) { subscribers.add(listener); return () => { subscribers.delete(listener); }; }
export function registerConnectionResetter(callback) { resetter = callback; }
export async function resetAgentConnection() {
  if (resetter) await resetter();
  installConnection({ mode: 'personal' });
}
