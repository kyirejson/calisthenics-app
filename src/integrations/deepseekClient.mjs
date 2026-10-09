import { normalizeConnection } from './connectionRuntime.mjs';
import { readBoundedJSON } from './httpJSON.mjs';

// Provider transport only: no prompts, memory, routing, write policy or fallback answers.
export function createDeepseekClient({ config, fetchImpl = (...args) => fetch(...args) }) {
  const connection = normalizeConnection(config);
  /** @param {Array<{role: string, content: any}>} messages
   * @param {{signal?: AbortSignal, maxTokens?: number, json?: boolean, tools?: any[], stream?: boolean, onDelta?: (delta: string, accumulated: string) => void}} options */
  async function generate(messages, { signal, maxTokens, json = false, tools, stream = false, onDelta } = {}) {
    if (!connection.deepseekKey) throw Error('尚未配置 DeepSeek API Key，请打开聊天右上角的服务设置。');
    if (signal?.aborted) throw Error('请求已取消。');
    const controller = new AbortController(), cancel = () => controller.abort();
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      const useStream = Boolean(stream || onDelta) && !json;
      const response = await fetchImpl('https://api.deepseek.com/chat/completions', {
        method: 'POST', redirect: 'error', signal: controller.signal,
        headers: { Authorization: 'Bearer ' + connection.deepseekKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: connection.model,
          messages,
          ...(tools ? { tools } : {}),
          ...(maxTokens === undefined ? {} : { max_tokens: maxTokens }),
          stream: useStream,
          ...(json ? { response_format: { type: 'json_object' } } : {})
        }),
      });
      if (!response.ok) {
        await response.body?.cancel?.();
        if ([401, 403].includes(response.status)) throw Error('DeepSeek 密钥无效或已撤销，请更换。');
        if (response.status === 402) throw Error('DeepSeek 账户余额不足。');
        if (response.status === 429) throw Error('DeepSeek 请求频率或额度受限，请稍后重试。');
        if (response.status === 400) throw Error('DeepSeek 拒绝了请求，请核对模型及输入能力。');
        throw Error('DeepSeek 服务暂不可用，请稍后重试。');
      }

      if (!useStream) {
        const payload = json ? await readBoundedJSON(response, 2 * 1024 * 1024) : await response.json();
        const result = payload.choices?.[0], content = result?.message?.content;
        if (tools && result?.finish_reason === 'tool_calls' && Array.isArray(result.message?.tool_calls) && result.message.tool_calls.length) return result.message;
        if (typeof content !== 'string' || !content.trim() || !['stop', 'length'].includes(result.finish_reason)) throw Error('模型未返回有效内容。');
        if (!json) return tools ? result.message : content;
        if (result.finish_reason !== 'stop') throw Error('识别结果被截断，未保存记录。');
        try { return JSON.parse(content); } catch { throw Error('模型未返回完整 JSON，未保存记录。'); }
      }

      let accumulatedContent = '';
      const toolCalls = [];
      let finishReason = null;

      const processLine = (line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) return;
        if (trimmed === 'data: [DONE]') return;
        if (trimmed.startsWith('data: ')) {
          let chunk;
          try { chunk = JSON.parse(trimmed.slice(6)); } catch { return; }
          const choice = chunk.choices?.[0];
          if (!choice) return;
          if (choice.finish_reason) finishReason = choice.finish_reason;
          const delta = choice.delta;
          if (!delta) return;

          if (typeof delta.content === 'string') {
            accumulatedContent += delta.content;
            onDelta?.(delta.content, accumulatedContent);
          }

          if (Array.isArray(delta.tool_calls)) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!toolCalls[idx]) {
                toolCalls[idx] = {
                  id: tc.id || '',
                  type: tc.type || 'function',
                  function: {
                    name: tc.function?.name || '',
                    arguments: tc.function?.arguments || ''
                  }
                };
              } else {
                if (tc.id) toolCalls[idx].id = tc.id;
                if (tc.function?.name) toolCalls[idx].function.name += tc.function.name;
                if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
              }
            }
          }
        }
      };

      if (response.body?.getReader && typeof TextDecoder !== 'undefined') {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';
            for (const line of lines) processLine(line);
          }
          buffer += decoder.decode();
          if (buffer) {
            for (const line of buffer.split('\n')) processLine(line);
          }
        } finally {
          reader.releaseLock();
        }
      } else if (response.body && typeof response.body[Symbol.asyncIterator] === 'function') {
        const decoder = new TextDecoder();
        let buffer = '';
        for await (const chunk of response.body) {
          buffer += decoder.decode(chunk, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) processLine(line);
        }
        buffer += decoder.decode();
        if (buffer) {
          for (const line of buffer.split('\n')) processLine(line);
        }
      } else {
        const text = await response.text();
        for (const line of text.split('\n')) processLine(line);
      }

      if (tools && finishReason === 'tool_calls' && toolCalls.length) {
        return {
          role: 'assistant',
          content: accumulatedContent || null,
          tool_calls: toolCalls
        };
      }

      if (typeof accumulatedContent !== 'string' || !accumulatedContent.trim()) {
        throw Error('模型未返回有效内容。');
      }

      return tools ? { role: 'assistant', content: accumulatedContent } : accumulatedContent;
    } catch (error) {
      if (signal?.aborted) throw Error('请求已取消。');
      if (error instanceof TypeError) throw Error('无法连接 DeepSeek，请检查网络；浏览器直连可能受跨域限制。');
      throw error;
    } finally { signal?.removeEventListener('abort', cancel); }
  }
  async function testConnection(signal) {
    const value = await generate([{ role: 'user', content: '连接测试：只返回 JSON 对象 {"ok":true}。' }], { signal, maxTokens: 32, json: true });
    if (value?.ok !== true) throw Error('模型已响应，但连接测试未通过。');
  }
  return { generate, testConnection };
}
