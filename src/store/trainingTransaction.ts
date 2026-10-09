import { storageKeys as keys, type AppStorage } from './contracts';
type Pair = [string, string];
type Intent = { version: 1; before: Array<[string, string | null]>; after: Pair[] };
const allowed = new Set<string>([keys.sessions, keys.dailyEdits]);
function decode(raw: string): Intent {
  const intent = JSON.parse(raw) as Intent;
  if (
    intent?.version !== 1 ||
    !Array.isArray(intent.before) ||
    !Array.isArray(intent.after) ||
    intent.after.length !== 2 ||
    intent.before.length !== 2
  )
    throw Error('训练恢复日志结构无效，原文件未覆盖。');
  const afterKeys = new Set<string>();
  for (const [index, pair] of intent.after.entries()) {
    const before = intent.before[index];
    if (
      !Array.isArray(pair) ||
      pair.length !== 2 ||
      !allowed.has(pair[0]) ||
      afterKeys.has(pair[0]) ||
      typeof pair[1] !== 'string' ||
      !Array.isArray(before) ||
      before.length !== 2 ||
      before[0] !== pair[0] ||
      (before[1] !== null && typeof before[1] !== 'string')
    )
      throw Error('训练恢复日志包含无效目标，原文件未覆盖。');
    afterKeys.add(pair[0]);
  }
  return intent;
}
/** Removing the durable intent is the commit point; any unfinished batch restores its original keys. */
export function createTrainingTransaction(storage: AppStorage) {
  const restore = async (intent: Intent) => {
    for (const [key, value] of intent.before) {
      if (value === null) await storage.multiRemove([key]);
      else await storage.setItem(key, value);
    }
    await storage.multiRemove([keys.trainingTransaction]);
  };
  const recover = async () => {
    const raw = await storage.getItem(keys.trainingTransaction);
    if (raw !== null) await restore(decode(raw));
  };
  return {
    recover,
    async write(pairs: Pair[]) {
      await recover();
      if (pairs.length < 2) {
        if (pairs.length) await storage.multiSet(pairs);
        return;
      }
      const intent: Intent = {
        version: 1,
        before: await Promise.all(
          pairs.map(
            async ([key]): Promise<[string, string | null]> => [key, await storage.getItem(key)],
          ),
        ),
        after: pairs,
      };
      const raw = JSON.stringify(intent);
      decode(raw);
      await storage.setItem(keys.trainingTransaction, raw);
      try {
        await storage.multiSet(pairs);
        await storage.multiRemove([keys.trainingTransaction]);
      } catch (error) {
        try {
          await restore(intent);
        } catch {
          throw Error('训练写入中断且尚未恢复，请保留本机数据，重新打开或导出备份后重试。');
        }
        throw error;
      }
    },
  };
}
