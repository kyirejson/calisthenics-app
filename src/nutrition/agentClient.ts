import { normalizeAssistantIntent, shortAssistantReply, type AssistantFact, type AssistantIntent } from './assistantState';
import { Platform } from 'react-native';
import { normalizeIngredientRecognition, type IngredientRecognition } from './ingredientCapture';
import { normalizeAgentAction } from './state';
import { normalizeFoodLabelDraft, validFoodBarcode } from './foodImport';
import type { FoodLabelDraft } from './types';
import type { DailyMenu, MealSlot, Nutrients, NutritionAgentAction, NutritionPreferences, NutritionTrainingContext, TrainingTime } from './types';

export type AdviceContext = {
  safetyStatus: DailyMenu['targets']['status'];
  preferences: NutritionPreferences | null;
  targets: DailyMenu['targets'];
  consumed: Nutrients;
  menu: { slot: MealSlot; name: string; nutrients: Nutrients; editable?: boolean }[];
  logging?: { date: string; confirmedSlots: MealSlot[]; complete: boolean; recordCount: number; containsPhoto: boolean };
  training?: NutritionTrainingContext & { time: TrainingTime };
  weekly?: { completeDays: number; comparableDays: number; trainingDays: number; photoDays: number; status: 'insufficient' | 'ready' | 'goal_changed' | 'paused'; average: Nutrients | null };
  toolsAllowed?: boolean;
};
export type KnowledgeReference = { id: string; title: string; excerpt: string; lineStart: number; lineEnd: number };
export type NutritionAdvice = { answer: string; sources: { title: string; url: string }[]; references?: KnowledgeReference[]; action?: NutritionAgentAction; intent?: AssistantIntent };
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
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) { controller.abort(); throw new Error('请求已取消。'); }
  signal?.addEventListener('abort', cancel);
  let timeout = false;
  // Render's free instance may need about a minute to wake before the model call begins.
  const timer = setTimeout(() => { timeout = true; controller.abort(); }, 110000);
  try {
    const response = await fetch(serviceURL() + path, { method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal });
    const data = await response.json();
    if (!response.ok) throw new Error(typeof data?.error?.message === 'string' ? data.error.message.slice(0, 250) : '营养服务暂不可用，请稍后重试。');
    return data;
  } catch (error) {
    if (controller.signal.aborted) throw new Error(timeout ? '营养服务请求超时，请稍后重试。' : '请求已取消。');
    if (error instanceof TypeError) throw new Error('营养服务未连接，请检查网络和本地服务。');
    throw error;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
}

export async function getNutritionServiceStatus(signal?: AbortSignal): Promise<{ configured: boolean; provider: string; model: string }> {
  const data = await request('/health', undefined, signal) as Record<string, unknown>;
  if (!data || typeof data.configured !== 'boolean' || typeof data.provider !== 'string' || typeof data.model !== 'string') throw new Error('营养服务响应无效。');
  return { configured: data.configured, provider: data.provider, model: data.model };
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

export async function askNutritionAgent(question: string, context: AdviceContext, signal?: AbortSignal, history: AdviceTurn[] = [], memory: AssistantFact[] = []): Promise<NutritionAdvice> {
  const data = await request('/v1/nutrition/advice', { question, context, history: history.slice(-6), assistantMode: true, memory: memory.slice(-40).map(({kind, text}) => ({kind, text})) }, signal) as NutritionAdvice;
  if (!data || typeof data.answer !== 'string' || !data.answer.trim() || data.answer.length > 8000 || !Array.isArray(data.sources)
    || data.sources.length > 8 || data.sources.some(source => !source || typeof source.title !== 'string' || !source.title.trim() || source.title.length > 200 || typeof source.url !== 'string' || source.url.length > 2000
      || !/^https:\/\/(?:pmc\.ncbi\.nlm\.nih\.gov|pubmed\.ncbi\.nlm\.nih\.gov|www\.niddk\.nih\.gov|fdc\.nal\.usda\.gov)\//.test(source.url))) throw new Error('营养助手响应无效，请重试。');
  const action = data.action === undefined ? null : normalizeAgentAction(data.action);
  if (data.action !== undefined && !action) throw new Error('营养助手操作无效，未修改任何记录。');
  const intent = data.intent === undefined ? null : normalizeAssistantIntent(data.intent);
  if (data.intent !== undefined && (!intent || action)) throw new Error('助手操作无效，未改动记录。');
  const references = data.references;
  if (references !== undefined && (!Array.isArray(references) || references.length > 3 || references.some(r => !r || !/^cc-[a-f0-9]{24}$/.test(r.id) || typeof r.title !== 'string' || r.title.length > 200 || typeof r.excerpt !== 'string' || r.excerpt.length > 850 || !Number.isInteger(r.lineStart) || r.lineStart < 1 || !Number.isInteger(r.lineEnd) || r.lineEnd < r.lineStart))) throw new Error('知识来源无效，请重试。');
  const answer = shortAssistantReply(data.answer);
  if (answer !== data.answer.trim()) return { answer, sources: [] };
  return { answer, sources: data.sources, ...(references?.length ? { references } : {}), ...(action ? { action } : {}), ...(intent ? { intent } : {}) };
}
