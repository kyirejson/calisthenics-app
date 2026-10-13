import { emptyNutritionJournal } from '../nutrition/engine';
import { referencedPhotoIds } from '../nutrition/photoMetadata';
import { defaultSettings } from './profile';
import { createAccountDomain } from './accountDomain';
import { createTrainingDomain } from './trainingDomain';
import { createNutritionDomain } from './nutritionDomain';
import { createObservable } from './observable';
import { loadDomains } from './loadDomains';
import { createTrainingTransaction } from './trainingTransaction';
import {
  storageKeys as keys,
  type AppStorage,
  type DomainContext,
  type StoreState,
  type StoreActions,
} from './contracts';
export type RepositoryEffects = {
  clearRetired(): Promise<void>;
  clearRunning(): Promise<void>;
  clearMusic(): Promise<void>;
  resetConnection(): Promise<void>;
  clearMemory(): Promise<void>;
  deletePhotos(ids: string[]): Promise<void>;
};
const initialState = () => ({
  ready: false,
  profile: null,
  sessions: [],
  settings: defaultSettings,
  dailyEdits: {},
  nutritionJournal: emptyNutritionJournal(),
  nutritionStorageIssue: '',
  storageIssues: {},
});
/** Cross-domain lifecycle only. The domains own their serial write queues. */
export function createAppRepository(storage: AppStorage, effects: RepositoryEffects) {
  const state = createObservable<StoreState>(initialState());
  let loading = false,
    clearing = false,
    reloading = false,
    loadJob: Promise<void> | null = null;
  let recoveryRaw: Record<string, string> = {};
  const context: DomainContext = {
    storage,
    read: state.getSnapshot,
    commit: state.patch,
    guard() {
      if (clearing) throw Error('正在清除数据，请稍后重试。');
      if (reloading) throw Error('正在重新加载数据，请稍后重试。');
      if (loading) throw Error('正在加载本地数据，请稍后重试。');
      if (!state.getSnapshot().ready) throw Error('正在加载本地数据，请稍后重试。');
    },
    assertWritable(key) {
      if (loading) throw Error('正在加载本地数据，请稍后重试。');
      const issue = state.getSnapshot().storageIssues[key];
      if (issue) throw Error(issue);
    },
  };
  const transaction = createTrainingTransaction(storage);
  const account = createAccountDomain(context),
    training = createTrainingDomain(context, transaction.write);
  const nutrition = createNutritionDomain(
    context,
    () => Promise.all([account.drain(), training.drain()]),
    effects.deletePhotos,
  );
  const drain = () => Promise.all([account.drain(), training.drain(), nutrition.drain()]);
  async function load() {
    if (state.getSnapshot().ready) return;
    if (loadJob) return loadJob;
    loading = true;
    loadJob = (async () => {
      const recovery: { raw: Record<string, string>; issues: Record<string, string> } = {
        raw: {},
        issues: {},
      };
      try {
        await transaction.recover();
      } catch {
        const issue = '训练事务未能完整恢复，已暂停训练写入。请先导出备份，再重试加载。';
        recovery.issues[keys.sessions] = issue;
        recovery.issues[keys.dailyEdits] = issue;
        try {
          const raw = await storage.getItem(keys.trainingTransaction);
          if (raw !== null) recovery.raw[keys.trainingTransaction] = raw;
        } catch {
          /* Do not replace an unreadable intent. */
        }
      }
      recoveryRaw = await loadDomains(context, recovery);
      try {
        await effects.clearRetired();
      } catch {
        console.warn('旧助手数据尚未清理，训练和饮食记录仍可使用。');
      }
      // Do not hide initial I/O failures by writing an unsolicited default document.
      state.patch({ ready: true });
    })();
    try {
      await loadJob;
    } finally {
      loading = false;
      loadJob = null;
    }
  }
  async function retryStorageLoading() {
    if (clearing || loading || reloading) return;
    reloading = true;
    try {
      await drain();
      state.patch(initialState());
      await load();
    } finally {
      reloading = false;
    }
  }
  async function exportData() {
    if (!state.getSnapshot().ready) await load();
    if (loadJob) await loadJob;
    await drain();
    const snapshot = state.getSnapshot(),
      issues = snapshot.storageIssues;
    return JSON.stringify(
      {
        formatVersion: '2.3-mobile',
        exportDate: new Date().toISOString(),
        data: {
          user_profile: snapshot.profile,
          sessions: snapshot.sessions,
          settings: snapshot.settings,
          daily_workout_edits: snapshot.dailyEdits,
          nutrition_journal_v1: snapshot.nutritionJournal,
        },
        ...(Object.keys(recoveryRaw).length || Object.keys(issues).length
          ? {
              recovery: {
                raw: { ...recoveryRaw },
                issues: { ...issues },
                ...(recoveryRaw[keys.nutrition]
                  ? { nutritionRaw: recoveryRaw[keys.nutrition] }
                  : {}),
              },
            }
          : {}),
      },
      null,
      2,
    );
  }
  async function clearData() {
    if (!state.getSnapshot().ready || loading || reloading || clearing)
      throw Error('正在处理本地数据，请稍后重试。');
    clearing = true;
    try {
      await drain();
      await effects.clearRunning();
      await effects.resetConnection();
      await effects.clearMusic();
      const photos = referencedPhotoIds(state.getSnapshot().nutritionJournal);
      await storage.multiRemove(Object.values(keys));
      recoveryRaw = {};
      state.patch({ ...initialState(), ready: true });
      await effects.clearMemory();
      if (photos.length) {
        try {
          await effects.deletePhotos(photos);
        } catch {
          console.warn('记录已清除，但本机照片清理未完成。');
        }
      }
    } finally {
      clearing = false;
    }
  }
  const actions: StoreActions = {
    ...account.actions,
    ...training.actions,
    ...nutrition.actions,
    retryStorageLoading,
    exportData,
    clearData,
  };
  let previous = state.getSnapshot(),
    snapshot = { ...previous, ...actions };
  const getSnapshot = () => {
    const current = state.getSnapshot();
    if (current !== previous) {
      previous = current;
      snapshot = { ...current, ...actions };
    }
    return snapshot;
  };
  return {
    getSnapshot,
    subscribe: state.subscribe,
    subscribeSelection<T>(select: (value: typeof snapshot) => T, listener: () => void) {
      return state.subscribeSelection(() => select(getSnapshot()), listener);
    },
    load,
  };
}
export type AppRepository = ReturnType<typeof createAppRepository>;
