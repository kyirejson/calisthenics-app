import { normalizeConnection } from './connectionRuntime.mjs';
import { readBoundedJSON } from './httpJSON.mjs';
import { usageSample } from '../agent/usage.mjs';
import { createRequestShapeTracker } from '../agent/requestShape.mjs';
import { deepseekContextCapacity } from '../agent/modelCapacity.mjs';
const trackRequestShape = createRequestShapeTracker();

// Provider transport only: no prompts, memory, routing, write policy or fallback answers.
export function createDeepseekClient({ config, fetchImpl = (...args) => fetch(...args), onUsage = (_sample) => {}, usageContext = {} }) {
  const connection = normalizeConnection(config);
  /** @param {Array<{role: string, content: any}>} messages
   * @param {{signal?: AbortSignal, maxTokens?: number, json?: boolean, tools?: any[], stream?: boolean, onDelta?: (delta: string, accumulated: string) => void, usageCategory?: string, requestMetadata?: any, onPartial?: (message: any) => Promise<unknown>, onRequestUsage?: (usage: any) => Promise<unknown>}} options */
  async function generate(messages, { signal, maxTokens, json = false, tools, stream = false, onDelta, usageCategory = 'conversation', requestMetadata = {}, onPartial, onRequestUsage } = {}) {
    if (!connection.deepseekKey) throw Error('尚未配置 DeepSeek API Key，请打开聊天右上角的服务设置。');
    if (signal?.aborted) throw Error('请求已取消。');
    const controller = new AbortController(), cancel = () => controller.abort();
    signal?.addEventListener('abort', cancel, { once: true });
    const started = Date.now(); let usage, responseTools = [], completed = false, firstDeltaMs = null;
    let firstTokenMs = null, firstVisibleMs = null, firstToolMs = null;
    const callId = 'model-' + started.toString(36) + '-' + Math.random().toString(36).slice(2);
    const success = value => { completed = true; return value; };
    const inputChars = JSON.stringify({ messages, tools }).length;
    const metadata = { ...usageContext, ...requestMetadata, modelId: connection.model, provider: 'deepseek', protocolVersion: 'deepseek-chat-v1' };
    const shape = trackRequestShape(messages, tools, metadata);
    let accumulatedContent = '', accumulatedReasoning = '', partialRecorded = false;
    const toolCalls = [];
    try {
      const useStream = Boolean(stream || onDelta) && !json;
      const response = await fetchImpl('https://api.deepseek.com/chat/completions', {
        method: 'POST', redirect: 'error', signal: controller.signal,
        headers: { Authorization: 'Bearer ' + connection.deepseekKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: connection.model,
          messages,
          ...(typeof requestMetadata.userId === 'string' ? { user_id: requestMetadata.userId } : {}),
          ...(tools ? { tools } : {}),
          ...(maxTokens === undefined ? {} : { max_tokens: maxTokens }),
          stream: useStream,
          ...(useStream ? { stream_options: { include_usage: true } } : {}),
          ...(json ? { response_format: { type: 'json_object' } } : {})
        }),
      });
      if (!response.ok) {
        let detail;
        if (response.status === 400 || response.status === 413) { try { detail = await readBoundedJSON(response, 2 * 1024 * 1024); } catch {} }
        else await response.body?.cancel?.();
        const providerCode = String(detail?.error?.code || detail?.error?.type || '');
        const providerMessage = String(detail?.error?.message || '');
        if (/context[_ -]?(length|window)|maximum context|上下文.{0,8}(长度|上限)/i.test(providerCode + ' ' + providerMessage)) {
          const error = Error('本轮内容超过模型上下文容量，尚未执行新的操作。'); error.code = 'context_window_exceeded'; throw error;
        }
        if (response.status === 413) { const error = Error('模型服务拒绝了过大的请求体，尚未执行新的操作。'); error.code = 'request_body_too_large'; throw error; }
        if ([401, 403].includes(response.status)) throw Error('DeepSeek 密钥无效或已撤销，请更换。');
        if (response.status === 402) throw Error('DeepSeek 账户余额不足。');
        if (response.status === 429) throw Error('DeepSeek 请求频率或额度受限，请稍后重试。');
        if (response.status === 400) throw Error('DeepSeek 拒绝了请求，请核对模型及输入能力。');
        throw Error('DeepSeek 服务暂不可用，请稍后重试。');
      }

      if (!useStream) {
        const payload = json ? await readBoundedJSON(response, 2 * 1024 * 1024) : await response.json();
        usage = payload.usage; firstDeltaMs = Date.now() - started;
        const result = payload.choices?.[0], content = result?.message?.content;
        responseTools = result?.message?.tool_calls?.map(call => call.function?.name).filter(Boolean) || [];
        if (tools && result?.finish_reason === 'tool_calls' && Array.isArray(result.message?.tool_calls) && result.message.tool_calls.length) return success(result.message);
        if (typeof content !== 'string' || !content.trim() || !['stop', 'length'].includes(result.finish_reason)) throw Error('模型未返回有效内容。');
        if (!json) return success(tools ? result.message : content);
        if (result.finish_reason !== 'stop') throw Error('识别结果被截断，未保存记录。');
        try { return success(JSON.parse(content)); } catch { throw Error('模型未返回完整 JSON，未保存记录。'); }
      }

      let finishReason = null;

      const processLine = (line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) return;
        if (trimmed.startsWith('data:')) {
          const payload = trimmed.slice(5).trimStart();
          if (payload === '[DONE]') return;
          let chunk;
          try { chunk = JSON.parse(payload); } catch { const error = Error('模型返回了损坏的流式数据，已保留收到的部分。'); error.code = 'malformed_model_stream'; throw error; }
          if (chunk.error) { const error = Error('模型服务中途返回错误，已保留收到的部分。'); error.code = 'provider_stream_error'; throw error; }
          if (chunk.usage) usage = chunk.usage;
          const choice = chunk.choices?.[0];
          if (!choice) return;
          if (choice.finish_reason) finishReason = choice.finish_reason;
          const delta = choice.delta;
          if (!delta) return;
          const receivedMs = Date.now() - started;
          if (firstTokenMs === null && (delta.reasoning_content || delta.content || delta.tool_calls?.length)) firstTokenMs = receivedMs;
          if (firstVisibleMs === null && delta.content) firstVisibleMs = receivedMs;
          if (firstToolMs === null && delta.tool_calls?.length) firstToolMs = receivedMs;
          if (firstDeltaMs === null && (delta.content || delta.tool_calls?.length)) firstDeltaMs = Date.now() - started;

          if (typeof delta.content === 'string') {
            accumulatedContent += delta.content;
            onDelta?.(delta.content, accumulatedContent);
          }
          if (typeof delta.reasoning_content === 'string') accumulatedReasoning += delta.reasoning_content;

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

      if (!['stop', 'length', 'tool_calls'].includes(finishReason)) { const error = Error('模型连接提前结束，已保留收到的部分，未当作完整回答。'); error.code = 'incomplete_model_stream'; throw error; }
      if (tools && finishReason === 'tool_calls' && toolCalls.length) {
        responseTools = toolCalls.map(call => call.function?.name).filter(Boolean);
        return success({
          role: 'assistant',
          content: accumulatedContent || null,
          ...(accumulatedReasoning ? { reasoning_content: accumulatedReasoning } : {}),
          tool_calls: toolCalls
        });
      }

      if (typeof accumulatedContent !== 'string' || !accumulatedContent.trim()) {
        throw Error('模型未返回有效内容。');
      }

      return success(tools ? { role: 'assistant', content: accumulatedContent, ...(accumulatedReasoning ? { reasoning_content: accumulatedReasoning } : {}) } : accumulatedContent);
    } catch (error) {
      if (!partialRecorded && onPartial && (accumulatedContent || accumulatedReasoning || toolCalls.length)) {
        partialRecorded = true;
        await onPartial({ role: 'assistant', content: accumulatedContent || null,
          ...(accumulatedReasoning ? { reasoning_content: accumulatedReasoning } : {}), ...(toolCalls.length ? { tool_calls: toolCalls.filter(Boolean) } : {}) });
      }
      if (signal?.aborted) throw Error('请求已取消。');
      if (error instanceof TypeError) throw Error('无法连接 DeepSeek，请检查网络；浏览器直连可能受跨域限制。');
      throw error;
    } finally {
      signal?.removeEventListener('abort', cancel);
      try { await onRequestUsage?.(usage); } catch { /* Usage is diagnostic, not a reason to repeat completed work. */ }
      try { onUsage?.(usageSample(usage, { ...metadata, ...shape, callId, category: responseTools.join('+') || usageCategory,
        startedAt: started, elapsedMs: Date.now() - started, firstDeltaMs, firstTokenMs, firstVisibleMs, firstToolMs, inputChars, completed,
        status: signal?.aborted ? 'cancelled' : completed ? 'completed' : 'failed' })); } catch { /* Metrics never alter a model response. */ }
    }
  }
  async function testConnection(signal) {
    const value = await generate([{ role: 'user', content: '连接测试：只返回 JSON 对象 {"ok":true}。' }], { signal, maxTokens: 32, json: true });
    if (value?.ok !== true) throw Error('模型已响应，但连接测试未通过。');
  }
  return { generate, testConnection, modelId: connection.model, contextWindowTokens: deepseekContextCapacity(connection.model) };
}
