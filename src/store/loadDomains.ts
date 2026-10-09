import { normalizeProfile, normalizeSettings, normalizeDailyEdits } from './profile';
import { normalizeTrainingSessions } from '../domain/training/sessionRecords';
import { normalizeNutritionJournal } from '../nutrition/engine';
import { loadStoredDomain } from './storage';
import { storageKeys as keys, type DomainContext } from './contracts';
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error('数据文件结构无法识别。');
  return value as Record<string, unknown>;
}
export async function loadDomains(
  context: DomainContext,
  recovery: { raw: Record<string, string>; issues: Record<string, string> } = {
    raw: {},
    issues: {},
  },
) {
  const raw: Record<string, string> = { ...recovery.raw },
    issues: Record<string, string> = { ...recovery.issues };
  const loaders = [
    {
      key: keys.profile,
      read: () =>
        loadStoredDomain(context.storage, keys.profile, (value) => normalizeProfile(object(value))),
      commit: (value: unknown) =>
        context.commit({ profile: value as ReturnType<typeof normalizeProfile> }),
    },
    {
      key: keys.settings,
      read: () =>
        loadStoredDomain(context.storage, keys.settings, (value) =>
          normalizeSettings(object(value)),
        ),
      commit: (value: unknown) =>
        context.commit({ settings: value as ReturnType<typeof normalizeSettings> }),
    },
    {
      key: keys.dailyEdits,
      read: () =>
        loadStoredDomain(context.storage, keys.dailyEdits, normalizeDailyEdits, {
          migrate: !recovery.issues[keys.dailyEdits],
        }),
      commit: (value: unknown) =>
        context.commit({ dailyEdits: value as ReturnType<typeof normalizeDailyEdits> }),
    },
    {
      key: keys.sessions,
      read: () =>
        loadStoredDomain(
          context.storage,
          keys.sessions,
          (value) => {
            if (!Array.isArray(value)) throw Error('训练文件结构无法识别。');
            return normalizeTrainingSessions(value);
          },
          { backupKey: keys.sessionsBackup, migrate: !recovery.issues[keys.sessions] },
        ),
      commit: (value: unknown) =>
        context.commit({ sessions: value as ReturnType<typeof normalizeTrainingSessions> }),
    },
    {
      key: keys.nutrition,
      read: () =>
        loadStoredDomain(
          context.storage,
          keys.nutrition,
          (value) => {
            const input = object(value);
            if (input.version !== 1 || !Array.isArray(input.entries))
              throw Error('饮食文件结构无法识别。');
            const normalized = normalizeNutritionJournal(input);
            if (normalized.entries.length !== input.entries.length)
              throw Error('饮食记录存在无法安全加载的条目。');
            return normalized;
          },
          { migrate: false },
        ),
      commit: (value: unknown) =>
        context.commit({ nutritionJournal: value as ReturnType<typeof normalizeNutritionJournal> }),
    },
  ];
  await Promise.all(
    loaders.map(async (loader) => {
      const result = await loader.read();
      if (result.value !== undefined) loader.commit(result.value);
      if (result.issue) {
        issues[loader.key] = result.issue;
        if (result.raw !== undefined) raw[loader.key] = result.raw;
        console.warn('本地数据已进入恢复保护：' + loader.key);
      }
    }),
  );
  try {
    const backup = await context.storage.getItem(keys.sessionsBackup);
    if (backup) raw[keys.sessionsBackup] = backup;
  } catch {
    console.warn('历史训练迁移备份暂不可读取。');
  }
  context.commit({ storageIssues: issues, nutritionStorageIssue: issues[keys.nutrition] || '' });
  return raw;
}
