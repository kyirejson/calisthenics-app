import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { publicWebUrl } from './webTools.mjs';
type Page = { url: string; contentType: string; text: string };
const native = Platform.OS === 'android' ? requireOptionalNativeModule<{ read(id: string, url: string): Promise<string>; cancel(id: string): Promise<void> }>('UncoverWeb') : null;
export async function requestPublicWeb(url: string, signal?: AbortSignal): Promise<Page> {
  if (signal?.aborted) throw Error('请求已取消。');
  url = publicWebUrl(url);
  const id = `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  if (native) {
    const abort = () => { void native.cancel(id).catch(() => {}); };
    signal?.addEventListener('abort', abort, { once: true });
    try { const result = JSON.parse(await native.read(id, url)); if (signal?.aborted) throw Error('请求已取消。'); return result; }
    finally { signal?.removeEventListener('abort', abort); }
  }
  let response: Response;
  try { response = await fetch(url, { signal, credentials: 'omit', redirect: 'error' }); }
  catch (error) { if (signal?.aborted) throw Error('请求已取消。'); throw Error(Platform.OS === 'web' ? '浏览器未允许跨域读取此网站；Android 安装包提供独立网页读取能力。' : `无法读取网页：${String(error)}`); }
  if (!response.ok) throw Error(`网页请求失败（HTTP ${response.status}）。`);
  const contentType = response.headers.get('content-type') || '';
  if (!/text\/|xml|json/.test(contentType)) { await response.body?.cancel(); throw Error('该链接不是可读取的文本网页。'); }
  if (Number(response.headers.get('content-length')) > 2 * 1024 * 1024) { await response.body?.cancel(); throw Error('网页超过读取大小，请选择正文页面。'); }
  const reader = response.body?.getReader(); let text = '', bytes = 0;
  if (reader) {
    const decoder = new TextDecoder();
    try { for (;;) { const next = await reader.read(); if (next.done) break; bytes += next.value.byteLength; if (bytes > 2 * 1024 * 1024) { await reader.cancel(); throw Error('网页超过读取大小。'); } text += decoder.decode(next.value, { stream: true }); } text += decoder.decode(); }
    finally { reader.releaseLock(); }
  } else { text = await response.text(); if (text.length > 2 * 1024 * 1024) throw Error('网页超过读取大小。'); }
  return { url, contentType, text };
}
