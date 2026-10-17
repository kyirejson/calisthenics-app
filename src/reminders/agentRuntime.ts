type Transport = { list(): Promise<unknown>; write(request: string, input: Record<string, unknown>): Promise<unknown>; cancel(id: string): Promise<unknown> };
export async function executeReminderTool(name: string, input: unknown, transport: Transport, requestId: string, signal?: AbortSignal) {
  if (signal?.aborted) throw Error('请求已取消。');
  if (name === 'read_reminders') return transport.list();
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('提醒参数应为对象。');
  const args = input as Record<string, unknown>;
  if (name === 'cancel_reminder') { if (typeof args.id !== 'string' || !args.id) throw Error('缺少已有提醒编号。'); return transport.cancel(args.id); }
  if (name !== 'write_reminder') throw Error('未知提醒工具。');
  if (!requestId || typeof args.operationKey !== 'string' || !args.operationKey.trim() || typeof args.title !== 'string' || typeof args.at !== 'string') throw Error('提醒需要操作编号、内容和带时区的时间。');
  return transport.write(requestId, args);
}
