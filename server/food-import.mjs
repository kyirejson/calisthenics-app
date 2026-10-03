// Compatibility exports; shared client/server implementation lives in public source.
export * from '../src/agent/core/food-import.mjs';
import { ServiceError, record, text } from '../src/agent/core/validation.mjs';
import { validBarcode, normalizeOpenFoodProduct } from '../src/agent/core/food-import.mjs';

export function createBarcodeLookup({ fetchImpl, environment = 'production', userAgent = 'Uncover/1.3 (https://github.com/kyirejson/calisthenics-app)', now = () => Date.now() }) {
  if (!['production', 'staging'].includes(environment) || typeof userAgent !== 'string' || userAgent.length > 250 || /[\r\n]/.test(userAgent)) throw new Error('食品查询服务配置无效。');
  const cache = new Map();
  let recent = [];
  return async (input, signal) => {
    record(input, ['barcode']);
    if (!validBarcode(input.barcode)) throw new ServiceError(400, 'INVALID_BARCODE', '请输入校验正确的 8、12、13 或 14 位商品条码。');
    const barcode = input.barcode, cached = cache.get(barcode);
    if (cached && now() < cached.until) return structuredClone(cached.data);
    recent = recent.filter(t => now() - t < 65000);
    if (recent.length >= 14) throw new ServiceError(429, 'FOOD_RATE_LIMITED', '条码查询过于频繁，请稍后重试。');
    recent.push(now());
    const timeout = new AbortController();
    const abort = () => timeout.abort();
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    const timer = setTimeout(abort, 10000); timer.unref?.();
    try {
      const host = environment === 'staging' ? 'world.openfoodfacts.net' : 'world.openfoodfacts.org';
      const fields = 'code,product_name,product_name_zh,product_name_en,nutrition,serving_size,allergens_tags';
      const response = await fetchImpl(`https://${host}/api/v3.6/product/${barcode}.json?fields=${fields}`, {
        headers: { 'User-Agent': userAgent, Accept: 'application/json', ...(environment === 'staging' ? { Authorization: 'Basic ' + Buffer.from('off:off').toString('base64') } : {}) },
        signal: timeout.signal, redirect: 'error' });
      if (response.status === 404) throw new ServiceError(404, 'FOOD_NOT_FOUND', '条码未收录，可拍摄包装营养标签添加。');
      if (!response.ok) throw new ServiceError(503, 'FOOD_UNAVAILABLE', '食品数据服务暂不可用，请稍后重试或按标签添加。');
      if (!response.body || Number(response.headers.get('content-length')) > 128 * 1024) throw new Error();
      const reader = response.body.getReader(); let size = 0; const chunks = [];
      try {
        for (;;) {
          const { done, value } = await reader.read(); if (done) break;
          size += value.length;
          if (size > 128 * 1024) { await reader.cancel(); throw new Error(); }
          chunks.push(Buffer.from(value));
        }
      } finally { reader.releaseLock(); }
      const data = normalizeOpenFoodProduct(JSON.parse(Buffer.concat(chunks).toString('utf8')), barcode, new Date(now()).toISOString());
      if (cache.size >= 100) cache.delete(cache.keys().next().value);
      cache.set(barcode, { until: now() + 86400000, data });
      return structuredClone(data);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(503, 'FOOD_UNAVAILABLE', signal.aborted ? '查询已取消。' : '食品数据服务连接失败，请稍后重试或按标签添加。');
    } finally { clearTimeout(timer); signal.removeEventListener('abort', abort); }
  };
}
