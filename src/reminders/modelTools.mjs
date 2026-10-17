const tool = (name, description, properties = {}, required = []) => ({ type: 'function', function: { name, description, parameters: { type: 'object', properties, required, additionalProperties: false } } });
export const reminderTools = [
  tool('read_reminders', '读取 MAX 本机事项提醒、通知和准时提醒权限、当前时间与时区。不需要手机控制或 Shizuku。'),
  tool('write_reminder', '按照用户意图创建或修改本地定时提醒，App 没有运行时也由 Android 发通知。由你理解时间、内容和重复方式，不用关键词解析。at 必须明确日期和偏移；含糊的时间结合上下文，必要时询问。省略 id 为新增，修改先读真实 id；重试复用 operationKey。只有 ok:true 才称已安排。系统强行停止后需重新打开恢复，不承诺绕过系统限制。', {
    operationKey: { type: 'string' }, id: { type: 'string' }, title: { type: 'string', description: '提醒用户做的事' },
    at: { type: 'string', description: '首次提醒 ISO8601 日期时间及偏移，如 2026-10-17T11:30:00+08:00' },
    timeZone: { type: 'string', description: 'IANA 时区，如 Asia/Shanghai；重复提醒保持此时区的当地时间' },
    repeatDays: { type: 'array', items: { type: 'integer', minimum: 1, maximum: 7 }, description: '周一为1、周日为7；不重复则留空，每天为1至7' },
  }, ['operationKey', 'title', 'at']),
  tool('cancel_reminder', '取消用户要求取消的已有 MAX 提醒；id 从真实列表获取。取消同一提醒可安全重试。', { id: { type: 'string' } }, ['id']),
];
export const reminderInstruction = '用户让你在某个时间提醒一件事时，自主使用 MAX 本地提醒工具，不必通过读屏反复打开闹钟 App。明确要求系统闹钟才使用闹钟或手机工具。已有通知与准时提醒权限一直复用，只在真实回执明确缺权时说明缺哪一项。定时任务不需要 Uncover 常驻，不在到点时调用模型；不把 JS 定时器当作关闭 App 后仍可触发的提醒。';
