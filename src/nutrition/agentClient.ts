import { normalizeAssistantIntent, normalizeAssistantReply, type AssistantFact, type AssistantIntent } from './assistantState';
import { Platform } from 'react-native';
import { normalizeIngredientRecognition, type IngredientRecognition } from './ingredientCapture';
import { normalizeAgentAction } from './state';
import { normalizeFoodLabelDraft, validFoodBarcode } from './foodImport';
import type { FoodLabelDraft } from './types';
import type { DailyMenu, MealSlot, Nutrients, NutritionAgentAction, NutritionPreferences, NutritionTrainingContext, TrainingTime } from './types';
import type { MemoryEvidence, PersonalTrainingProfile } from './personalKnowledge';
import type { AssistantAuthorization } from './assistantState';
import type { AssistantTrainingSnapshot } from './assistantTraining';
import { publicSourceURL } from './sourceURL.mjs';
import { normalizeDishFood, type DishSearchResult } from './dishEstimate';
import { FOODS } from './catalog';
import { boundedAdviceHistory } from './assistantReply.mjs';
import type { AgentWeightContext } from '../agent/weightContext';
import { getConnection, subscribeConnection } from '../agent/connectionRuntime.mjs';
import { createPersonalTransport } from '../agent/personalTransport.mjs';
export type HarnessContext = { version: 2; mode: AssistantAuthorization['mode']; policyVersion: number; scene?: string; personalProfile: PersonalTrainingProfile | null; evidence: MemoryEvidence[]; trainingSnapshot: AssistantTrainingSnapshot | null };

export type AdviceContext = {
  safetyStatus: DailyMenu['targets']['status'];
  preferences: NutritionPreferences | null;
  targets: DailyMenu['targets'];
  consumed: Nutrients;
  menu: { slot: MealSlot; name: string; nutrients: Nutrients; editable?: boolean }[];
  logging?: { date: string; confirmedSlots: MealSlot[]; skippedSlots?: MealSlot[]; recordedSlots?: MealSlot[]; complete: boolean; recordCount: number; containsPhoto: boolean };
  training?: NutritionTrainingContext & { time: TrainingTime };
  weekly?: { completeDays: number; comparableDays: number; trainingDays: number; photoDays: number; status: 'insufficient' | 'ready' | 'goal_changed' | 'paused'; average: Nutrients | null };
  weightTrend?: AgentWeightContext;
  toolsAllowed?: boolean;
};
export type KnowledgeReference = { id: string; title: string; excerpt: string; lineStart: number; lineEnd: number };
export type SearchStatus = { status: 'searched' | 'empty' | 'unconfigured' | 'unavailable'; count: number };
export type NutritionAdvice = { answer: string; sources: { title: string; url: string }[]; references?: KnowledgeReference[]; action?: NutritionAgentAction; intent?: AssistantIntent; search?: SearchStatus; searchSources?: { title: string; url: string }[] };
export type AdviceTurn = { role: 'user' | 'assistant'; content: string };

function serviceURL() {
  const configured = process.env.EXPO_PUBLIC_NUTRITION_API_URL?.trim();
  if (configured) {
    let url: URL;
    try { url = new URL(configured); } catch { throw new Error('营养服务地址无效，请检查配置。'); }
    if (url.username || url.password || url.search || url.hash
      || (url.protocol !== 'https:' && !(typeof __DEV__ !== 'undefined' && __DEV__ && url.protocol === 'http:')))
      throw new Error('正式版营养服务必须使用 HTTPS。');
    return configured.replace(/\/$/, '');
  }
  // Loopback-only development backend. Never ship a shared API secret in EXPO_PUBLIC variables.
  if (Platform.OS === 'web' && typeof window !== 'undefined'
    && ['localhost', '127.0.0.1'].includes(window.location.hostname)) return 'http://127.0.0.1:8787';
  throw new Error('营养服务尚未配置。请设置受保护的 HTTPS 服务地址后重新构建。');
}

async function request(path: string, body?: unknown, signal?: AbortSignal): Promise<unknown> {
  const defaultMode = Platform.OS === 'web' && typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname) ? 'gateway' : 'personal';
  // Native builds do not silently send requests to an old compiled developer gateway.
  if (Platform.OS !== 'web') await (await import('../agent/credentials')).loadAgentConnection();
  const connection = getConnection(defaultMode);
  if (connection.mode === 'personal') {
    const controller = new AbortController(), cancel = () => controller.abort();
    if (signal?.aborted) throw Error('请求已取消。');
    signal?.addEventListener('abort', cancel);
    const unsubscribe = subscribeConnection(cancel);
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 150000);
    try { return await createPersonalTransport({ config: connection }).request(path, body, controller.signal); }
    catch (error) { if (controller.signal.aborted) throw Error(timedOut ? '请求超时，请重试。' : '请求已取消或连接配置已变化，请重新发送。'); throw error; }
    finally { clearTimeout(timer); unsubscribe(); signal?.removeEventListener('abort', cancel); }
  }
  const baseURL = serviceURL();
  const endpoint = new URL(baseURL);
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname);
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) { controller.abort(); throw new Error('请求已取消。'); }
  signal?.addEventListener('abort', cancel);
  let timeout = false;
  // Allow slow provider responses; caller cancellation and a bounded timeout still apply.
  const timer = setTimeout(() => { timeout = true; controller.abort(); }, 150000);
  try {
    const response = await fetch(baseURL + path, { method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal });
    if (!/application\/json/i.test(response.headers.get('content-type') || '')) throw new Error('营养服务未返回有效数据，可能正在启动，请稍后重试。');
    let data;
    try { data = await response.json(); } catch { throw new Error('营养服务返回内容异常，请稍后重试。'); }
    if (!response.ok) throw new Error(typeof data?.error?.message === 'string' ? data.error.message.slice(0, 250) : '营养服务暂不可用，请稍后重试。');
    return data;
  } catch (error) {
    if (controller.signal.aborted) throw new Error(timeout ? '营养服务请求超时，请稍后重试。' : '请求已取消。');
    if (error instanceof TypeError) throw new Error(local ? `无法连接本机营养服务（${endpoint.port || (endpoint.protocol === 'https:' ? '443' : '80')}），请启动后端后重试。` : '无法连接公网营养服务，请检查网络或服务状态。');
    throw error;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
}

export type NutritionServiceStatus = { configured: boolean; provider: string; model: string; readiness: 'ready' | 'degraded' | 'unconfigured' | 'unknown'; searchConfigured: boolean };
export async function getNutritionServiceStatus(signal?: AbortSignal): Promise<NutritionServiceStatus> {
  const data = await request('/health', undefined, signal) as Record<string, unknown>;
  if (!data || typeof data.configured !== 'boolean' || typeof data.provider !== 'string' || typeof data.model !== 'string') throw new Error('营养服务响应无效。');
  return { configured: data.configured, provider: data.provider, model: data.model,
    readiness: data.readiness === 'ready' || data.readiness === 'degraded' || data.readiness === 'unconfigured' ? data.readiness : 'unknown', searchConfigured: !!data.search && typeof data.search === 'object' && (data.search as Record<string, unknown>).configured === true };
}

export type PhotoCaptureResult = { kind: 'ingredients'; recognition: IngredientRecognition } | { kind: 'label'; draft: FoodLabelDraft };
export async function analyzeFoodPhoto(imageDataUrl: string, signal?: AbortSignal, note?: string): Promise<PhotoCaptureResult> {
  const data = await request('/v1/nutrition/analyze-photo', { imageDataUrl, ...(note?.trim() ? { note: note.trim().slice(0, 200) } : {}) }, signal);
  if (data && typeof data === 'object' && (data as Record<string, unknown>).kind === 'label') {
    const draft = normalizeFoodLabelDraft((data as Record<string, unknown>).draft);
    if (!draft || draft.origin.provider !== 'label_photo') throw new Error('包装识别结果无效，请补拍清晰的营养标签。');
    return { kind: 'label', draft };
  }
  const recognition = normalizeIngredientRecognition(data);
  if (!recognition) throw new Error('未得到有效的食材结果，请换个角度重新拍照。');
  return { kind: 'ingredients', recognition };
}

export async function readFoodLabel(imageDataUrl: string, signal?: AbortSignal): Promise<FoodLabelDraft> {
  const draft = normalizeFoodLabelDraft(await request('/v1/nutrition/read-label', { imageDataUrl }, signal));
  if (!draft || draft.origin.provider !== 'label_photo') throw new Error('营养标签响应无效，请手动核对包装。');
  return draft;
}
export async function lookupFoodBarcode(barcode: string, signal?: AbortSignal): Promise<FoodLabelDraft> {
  if (!validFoodBarcode(barcode)) throw new Error('请输入校验正确的 8、12、13 或 14 位商品条码。');
  const draft = normalizeFoodLabelDraft(await request('/v1/nutrition/lookup-barcode', { barcode }, signal));
  if (!draft || draft.origin.provider !== 'open_food_facts' || draft.origin.identifier !== barcode) throw new Error('条码查询响应无效，请按包装标签添加。');
  return draft;
}

export async function searchNutritionDish(name: string, state: 'raw' | 'cooked' | 'unknown', signal?: AbortSignal): Promise<DishSearchResult> {
  const data = await request('/v1/nutrition/search-food', { name: name.trim().slice(0, 80), state }, signal) as DishSearchResult;
  if (!data || !Array.isArray(data.candidates) || data.candidates.length > 2 || typeof data.message !== 'string' || data.message.length > 300) throw new Error('菜品检索结果异常，请重新搜索。');
  const candidates = data.candidates.map(f => normalizeDishFood(f, FOODS));
  if (candidates.some(f => !f)) throw new Error('参考配方不完整，请补充主要食材或做法后搜索。');
  return { candidates: candidates.filter(f => f !== null), message: data.message };
}

export async function askNutritionAgent(question: string, context: AdviceContext, signal?: AbortSignal, history: AdviceTurn[] = [], memory: AssistantFact[] = [], harness?: HarnessContext, webSearch = false): Promise<NutritionAdvice> {
  const data = await request('/v1/nutrition/advice', { question, context, history: boundedAdviceHistory(history), assistantMode: true, memory: memory.map(({kind, text}) => ({kind, text})), ...(harness ? { harness } : {}), ...(webSearch ? { webSearch: true } : {}) }, signal) as NutritionAdvice;
  if (!data || typeof data.answer !== 'string' || !data.answer.trim() || data.answer.length > 8000 || !Array.isArray(data.sources)
    || data.sources.length > 8 || data.sources.some(source => !source || typeof source.title !== 'string' || !source.title.trim() || source.title.length > 200 || typeof source.url !== 'string' || source.url.length > 2000
      || !publicSourceURL(source.url))) throw new Error('营养助手响应无效，请重试。');
  if (data.search !== undefined && (!data.search || !['searched', 'empty', 'unconfigured', 'unavailable'].includes(data.search.status) || !Number.isInteger(data.search.count) || data.search.count < 0 || data.search.count > 4)) throw new Error('联网检索状态异常，请重试。');
  if (data.searchSources !== undefined && (!Array.isArray(data.searchSources) || data.searchSources.length > 4 || data.searchSources.some(s => !s || typeof s.title !== 'string' || !s.title.trim() || s.title.length > 200 || !publicSourceURL(s.url)))) throw new Error('联网来源异常，请重试。');
  const action = data.action === undefined ? null : normalizeAgentAction(data.action);
  if (data.action !== undefined && !action) throw new Error('营养助手操作无效，未修改任何记录。');
  const intent = data.intent === undefined ? null : normalizeAssistantIntent(data.intent);
  if (data.intent !== undefined && (!intent || action)) throw new Error('助手操作无效，未改动记录。');
  const references = data.references;
  if (references !== undefined && (!Array.isArray(references) || references.length > 3 || references.some(r => !r || !/^cc-[a-f0-9]{24}$/.test(r.id) || typeof r.title !== 'string' || r.title.length > 200 || typeof r.excerpt !== 'string' || r.excerpt.length > 850 || !Number.isInteger(r.lineStart) || r.lineStart < 1 || !Number.isInteger(r.lineEnd) || r.lineEnd < r.lineStart))) throw new Error('知识来源无效，请重试。');
  const answer = normalizeAssistantReply(data.answer);
  if (answer !== data.answer.trim()) return { answer, sources: [] };
  return { answer, sources: data.sources, ...(references?.length ? { references } : {}), ...(action ? { action } : {}), ...(intent ? { intent } : {}), ...(data.search ? { search: data.search } : {}), ...(data.searchSources ? { searchSources: data.searchSources } : {}) };
}
