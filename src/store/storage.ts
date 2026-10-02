type Storage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};
export type LoadedDomain<T> = { value?: T; issue?: string; raw?: string };

/** A failed domain never becomes an empty writable replacement for existing data. */
export async function loadStoredDomain<T>(storage: Storage, key: string, normalize: (value: unknown) => T,
  options: { migrate?: boolean; backupKey?: string } = {}): Promise<LoadedDomain<T>> {
  let raw: string | null = null;
  let value: T | undefined;
  try {
    raw = await storage.getItem(key);
    if (raw === null) return {};
    value = normalize(JSON.parse(raw));
    const serialized = JSON.stringify(value);
    if (options.migrate !== false && serialized !== raw) {
      if (options.backupKey && !(await storage.getItem(options.backupKey))) await storage.setItem(options.backupKey, raw);
      await storage.setItem(key, serialized);
    }
    return { value };
  } catch {
    return { value, ...(raw !== null ? { raw } : {}),
      issue: '本地数据未能完整读取或迁移，已暂停此类数据写入。原始数据未被空记录覆盖，请先导出备份并重新打开应用重试。' };
  }
}
