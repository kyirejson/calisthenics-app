import type { PhoneCommand, PhoneTransport } from './types';
import { phoneCommandTypes } from './modelTools.mjs';
import { compactObservation } from './observations.mjs';
type Context = { requestId: string; executionId: string; onInterruptedResult?: (call: { name: string; args: Record<string, unknown>; result: unknown }) => void };
const object = (value: unknown): Record<string, unknown> => {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('手机工具参数应为对象。');
  return value as Record<string, unknown>;
};
const offset = (value: unknown): number => {
  if (value === undefined) return 0;
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw Error('分页起点应为非负整数。');
  return Number(value);
};
/** Shape validation only. Never identifies intent, matches contacts or chooses an app/route. */
export function createPhoneRuntime(transport: PhoneTransport, context: Context) {
  return async (name: string, input: unknown, signal?: AbortSignal) => {
    if (signal?.aborted) throw Error('请求已取消。');
    const args = object(input);
    if (name === 'read_phone_status') return transport.status();
    if (name === 'find_apps') {
      if (args.query !== undefined && typeof args.query !== 'string') throw Error('应用查询词应为文字。');
      return transport.findApps(String(args.query ?? ''), offset(args.offset));
    }
    if (!context.requestId || !context.executionId) throw Error('手机工具没有绑定当前用户请求。');
    for (const key of ['packageName', 'activityName', 'uri', 'snapshotId', 'nodeId', 'action', 'text'])
      if (args[key] !== undefined && typeof args[key] !== 'string') throw Error(`${key} 应为文字。`);
    if (name === 'read_phone_screen') {
      if (args.visualText !== undefined && typeof args.visualText !== 'boolean') throw Error('visualText 应为布尔值。');
      const cancel = () => { void transport.cancel(context.executionId).catch(() => {}); };
      signal?.addEventListener('abort', cancel, { once: true });
      try {
        if (signal?.aborted) { cancel(); throw Error('请求已取消。'); }
        const result = await transport.screen(context.requestId, context.executionId, offset(args.offset), args.packageName as string | undefined, args.visualText === true);
        if (signal?.aborted) throw Error('请求已取消。');
        return compactObservation(result);
      } finally { signal?.removeEventListener('abort', cancel); }
    }
    const type = (phoneCommandTypes as Record<string, PhoneCommand['type']>)[name]; if (!type) throw Error('未知手机工具。');
    if (typeof args.operationKey !== 'string' || !args.operationKey.trim()) throw Error('手机操作需要 operationKey，避免重试时重复发送。');
    const cancel = () => { void transport.cancel(context.executionId).catch(() => {}); };
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      if (signal?.aborted) { cancel(); throw Error('请求已取消。'); }
      const result = await transport.executeAndObserve(context.requestId, context.executionId, { ...args, type, operationKey: args.operationKey });
      if (signal?.aborted) {
        context.onInterruptedResult?.({ name, args, result });
        throw Error('请求已取消；已尝试的手机操作应先核对真实界面，不要重复发送。');
      }
      return compactObservation(result);
    } finally { signal?.removeEventListener('abort', cancel); }
  };
}
