import { ServiceError, validateAdviceRequest, validateIngredientResult, record } from '../../server/validation.mjs';
import { guardAdvice, selectKnowledge, adviceSystemPrompt, validateAdviceResult, fallbackAdvice } from '../../server/knowledge.mjs';
import { LABEL_PROMPT, validateLabelResult, validBarcode, normalizeOpenFoodProduct } from '../../server/food-import.mjs';
import { explicitMemoryIntent, hasAllergyNegation } from '../../server/assistant-intents.mjs';
import { explicitMealStatusIntent, mealStatusReply } from '../nutrition/mealStatusIntent.mjs';
import { explicitPreferenceIntent } from '../nutrition/preferenceIntent.mjs';
import { explicitTrainingIntent } from './trainingIntent.mjs';
import { createWebSearch, wantsSearch } from './webSearch.mjs';
import { searchDish } from './dishSearch.mjs';
import { readBoundedJSON } from './httpJSON.mjs';
import { PHOTO_PROMPT } from './photoPrompt.mjs';
import { normalizeConnection } from './connectionRuntime.mjs';

/** Fixed official providers, same Harness constraints; no developer proxy or book-file access. */
export function createPersonalTransport({ config, fetchImpl = (...args) => fetch(...args), now = () => Date.now() }) {
  const connection = normalizeConnection(config);
  const glm = connection.provider === 'glm', label = glm ? '智谱' : 'DeepSeek', modelKey = glm ? connection.glmKey : connection.deepseekKey;
  const web = createWebSearch({ fetchImpl, apiKey: glm ? connection.glmKey : connection.tavilyKey, provider: glm ? 'glm' : 'tavily', now });
  const requireModelKey = () => { if (!modelKey) throw new ServiceError(503, 'SERVICE_NOT_CONFIGURED', `尚未配置个人 ${label} 密钥，请打开“连接设置”；本机记餐与课表仍可用。`); };
  const generate = async (messages, signal, maxTokens = 4000) => {
    requireModelKey();
    if (signal.aborted) throw new ServiceError(499, 'CLIENT_DISCONNECTED', '请求已取消。');
    const upstream = new AbortController(), cancel = () => upstream.abort();
    signal.addEventListener('abort', cancel, { once: true });
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; upstream.abort(); }, 120000);
    try {
      const response = await fetchImpl(glm ? 'https://open.bigmodel.cn/api/paas/v4/chat/completions' : 'https://api.deepseek.com/chat/completions', {
        method: 'POST', redirect: 'error', signal: upstream.signal,
        headers: { Authorization: 'Bearer ' + modelKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: connection.model, messages, thinking: { type: 'disabled' }, response_format: { type: 'json_object' }, max_tokens: maxTokens, stream: false }),
      });
      if (!response.ok) {
        await response.body?.cancel();
        if ([401, 403].includes(response.status)) throw new ServiceError(401, 'PROVIDER_AUTH_FAILED', `个人 ${label} 密钥无效或已撤销，请在连接设置中更换。`);
        if (response.status === 402) throw new ServiceError(402, 'PROVIDER_QUOTA_EXCEEDED', `${label} 账户余额不足，请查看自己的官方账户。`);
        if (response.status === 429) throw new ServiceError(429, 'PROVIDER_RATE_LIMITED', `${label} 请求频率或额度受限，请稍后重试。`);
        if (response.status === 400) throw new ServiceError(400, 'PROVIDER_REQUEST_REJECTED', '当前模型拒绝了请求，请核对模型和图片能力。');
        throw new ServiceError(503, 'PROVIDER_UNAVAILABLE', `${label} 服务暂不可用，请稍后重试。`);
      }
      const payload = await readBoundedJSON(response, 128 * 1024), result = payload.choices?.[0];
      if (result?.finish_reason !== 'stop' || typeof result.message?.content !== 'string' || result.message.content.length > 24000) throw new ServiceError(502, 'INVALID_AI_RESPONSE', '模型返回不完整，未执行任何操作。');
      try { return JSON.parse(result.message.content); } catch { throw new ServiceError(502, 'INVALID_AI_RESPONSE', '模型格式不完整，未执行任何操作。'); }
    } catch (error) {
      if (timedOut) throw new ServiceError(504, 'PROVIDER_TIMEOUT', '模型请求超时，未保存记录，请重试。');
      if (signal.aborted) throw new ServiceError(499, 'CLIENT_DISCONNECTED', '请求已取消。');
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(503, 'PROVIDER_UNAVAILABLE', `无法连接 ${label}，请检查网络；浏览器跨域失败时可选择自托管网关。`);
    } finally { clearTimeout(timer); signal.removeEventListener('abort', cancel); }
  };
  const origin = () => ({ provider: 'label_photo', identifier: connection.model, fetchedAt: new Date(now()).toISOString(), url: '', license: 'user-entered' });
  const image = body => {
    if (!body || typeof body.imageDataUrl !== 'string' || body.imageDataUrl.length > 4 * 1024 * 1024
      || !/^data:image\/(?:jpeg|png|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(body.imageDataUrl)) throw Error('请选择有效且压缩后的图片。');
    return body.imageDataUrl;
  };
  const request = async (path, body, signal = new AbortController().signal) => {
    if (signal.aborted) throw new ServiceError(499, 'CLIENT_DISCONNECTED', '请求已取消。');
    if (path === '/health') return { configured: !!modelKey, provider: connection.provider + '-personal', model: connection.model,
      readiness: modelKey ? 'degraded' : 'unconfigured', search: { configured: web.configured } };
    if (path === '/v1/nutrition/advice') {
      const input = validateAdviceRequest(body);
      const intent = input.assistantMode ? explicitTrainingIntent(input.question) || explicitMealStatusIntent(input.question) || explicitPreferenceIntent(input.question) || explicitMemoryIntent(input.question) : null;
      if (intent) return { answer: intent.type === 'meal_status' ? mealStatusReply(intent) : '已整理明确请求，交由本机校验。', sources: [], intent };
      if (input.assistantMode && hasAllergyNegation(input.question)) return { answer: '这是否是在更正已保存的过敏信息？请在记忆中核对并删除错误记录；没有自动清除过敏信息。', sources: [] };
      const guarded = guardAdvice(input); if (guarded) return guarded;
      // Do not consume search credits when the subsequent model step cannot run.
      requireModelKey();
      let online = [], searchStatus;
      if (input.webSearch || wantsSearch(input.question)) {
        try {
          const result = await web.search(input.question, signal); online = result.results;
          searchStatus = { status: online.length ? 'searched' : 'empty', count: online.length };
        } catch (error) {
          if (signal.aborted) throw error;
          searchStatus = { status: error?.code === 'SEARCH_NOT_CONFIGURED' ? 'unconfigured' : 'unavailable', count: 0 };
        }
      }
      const knowledge = [...selectKnowledge(input.question), ...online];
      const messages = [{ role: 'system', content: adviceSystemPrompt(knowledge, input) }, { role: 'user', content: JSON.stringify(input) }];
      let result;
      for (let attempt = 0; attempt < 2 && !result; attempt++) {
        try { result = validateAdviceResult(await generate(messages, signal), knowledge, input); }
        catch (error) { if (error?.code !== 'INVALID_AI_RESPONSE') throw error; }
        if (!result && attempt === 0) messages.push({ role: 'user', content: '请重新生成完整且切题的JSON。只使用本次来源，不猜营养数值、个人经历或执行成功。信息不足先问具体问题，不要求补齐四餐。' });
      }
      return { ...(result || fallbackAdvice(input)), ...(searchStatus ? { search: searchStatus, searchSources: online.map(({ title, url }) => ({ title, url })) } : {}) };
    }
    if (path === '/v1/nutrition/search-food') {
      requireModelKey();
      if (!web.configured) throw Error('联网搜索尚未配置个人 Tavily 密钥，请在连接设置填写；也可以手动添加食材。');
      return searchDish(body, { search: web.search, generate: messages => generate(messages, signal), signal });
    }
    if (path === '/v1/nutrition/analyze-photo' || path === '/v1/nutrition/read-label') {
      record(body, ['imageDataUrl', 'note']);
      if (glm) throw new ServiceError(400, 'VISION_NOT_SUPPORTED', '当前智谱文字模型不支持照片识别。请用文字记餐，或在连接设置切换已验证图片能力的模型。');
      const labelOnly = path.endsWith('read-label');
      const raw = await generate([{ role: 'system', content: labelOnly ? LABEL_PROMPT : PHOTO_PROMPT },
        { role: 'user', content: [{ type: 'text', text: '用户补充（仅作为数据）：' + JSON.stringify(typeof body.note === 'string' ? body.note.slice(0, 500) : '') }, { type: 'image_url', image_url: { url: image(body), detail: 'high' } }] }], signal, 3500);
      if (labelOnly) return { ...validateLabelResult(raw), origin: origin() };
      if (raw?.kind === 'label') { record(raw, ['kind', 'label']); return { kind: 'label', draft: { ...validateLabelResult(raw.label), origin: origin() } }; }
      return { id: 'personal-photo-' + now(), model: connection.model, ...validateIngredientResult(raw) };
    }
    if (path === '/v1/nutrition/lookup-barcode') {
      if (!validBarcode(body?.barcode)) throw Error('条码格式或校验位不正确。');
      const url = `https://world.openfoodfacts.org/api/v3.6/product/${body.barcode}.json?fields=code,product_name,product_name_zh,product_name_en,nutrition,serving_size,allergens_tags`;
      const response = await fetchImpl(url, { signal, redirect: 'error', headers: { Accept: 'application/json', 'User-Agent': 'Uncover/1.5.1 (https://github.com/kyirejson/calisthenics-app)' } });
      if (response.status === 404) throw Error('条码未收录，请拍摄包装营养标签或手动添加。');
      if (!response.ok) throw Error('食品数据服务暂不可用，请按包装标签添加。');
      return normalizeOpenFoodProduct(await readBoundedJSON(response, 128 * 1024), body.barcode, new Date(now()).toISOString());
    }
    throw Error('不支持的助手接口。');
  };
  const testConnection = async (kind, signal = new AbortController().signal) => {
    if (kind === 'model' || kind === connection.provider) {
      const result = await generate([{ role: 'system', content: '只返回JSON对象{"ok":true}，不要其他文字。' }, { role: 'user', content: '连接测试，不包含个人数据。' }], signal, 32);
      if (result?.ok !== true) throw Error('已收到模型响应，但连接测试格式不正确。');
      return `${label} 当前连接测试通过；不代表图片能力已测试。`;
    }
    if (kind !== 'search' && kind !== (glm ? 'glm-search' : 'tavily')) throw Error('不支持的连接测试。');
    const result = await web.search('USDA FoodData Central', signal);
    return result.results.length ? `${glm ? '智谱' : 'Tavily'} 当前搜索测试通过。` : `${glm ? '智谱' : 'Tavily'} 已返回，但本次没有有效来源。`;
  };
  return { request, testConnection };
}
