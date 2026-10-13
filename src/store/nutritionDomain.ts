import type { Food, MealSlot, NutritionJournal, NutritionPreferences } from '../nutrition/types';
import {
  withCustomFood,
  withIntakeEntry,
  withNutritionPreferences,
  withoutCustomFood,
  withoutIntakeEntry,
  type IntakeInput,
} from '../nutrition/journal';
import {
  createNutritionTargetSnapshot,
  withDailyTargetSnapshot,
  withMealLoggingConfirmation,
  withMealStatus,
} from '../nutrition/timeline';
import { getNutritionTrainingContext } from '../nutrition/training';
import { referencedPhotoIds } from '../nutrition/photoMetadata';
import { localWeightDate } from '../domain/weight/weightTrend';
import { storageKeys as keys, type DomainContext } from './contracts';
import { createWriteQueue } from './writeQueue';
import { applyMealOperations, type MealWriteResult } from '../nutrition/mealOperations';
export function createNutritionDomain(
  context: DomainContext,
  drainInputs: () => Promise<unknown>,
  deletePhotos: (ids: string[]) => Promise<void>,
) {
  const queue = createWriteQueue(context.guard);
  const update = (
    change: (current: NutritionJournal) => NutritionJournal | Promise<NutritionJournal>,
  ) => {
    if (context.read().nutritionStorageIssue)
      return Promise.reject(
        Error('饮食文件无法完整读取，已暂停保存以保留原始数据；请先导出备份并核对。'),
      );
    return queue.enqueue(async () => {
      context.assertWritable(keys.nutrition);
      const current = context.read().nutritionJournal,
        next = await change(current);
      if (next === current) return;
      await context.storage.setItem(keys.nutrition, JSON.stringify(next));
      const retained = new Set(referencedPhotoIds(next)),
        removed = referencedPhotoIds(current).filter((id) => !retained.has(id));
      context.commit({ nutritionJournal: next });
      if (removed.length) {
        try {
          await deletePhotos(removed);
        } catch {
          console.warn('饮食记录已保存，但本机照片清理未完成。');
        }
      }
    });
  };
  return {
    drain: queue.drain,
    actions: {
      setPhotoConsent: (consent: boolean) =>
        update((current) => ({
          ...current,
          photoConsentAt: consent ? new Date().toISOString() : null,
        })),
      saveNutritionPreferences: (preferences: NutritionPreferences) =>
        update((current) => withNutritionPreferences(current, preferences)),
      saveIntakeEntry: (input: IntakeInput) => update((current) => withIntakeEntry(current, input)),
      applyMealOperations: async (input: unknown, requestId: string, signal?: AbortSignal) => {
        let result: MealWriteResult | undefined;
        await update(current => {
          if (signal?.aborted) throw Error('请求已取消。');
          const applied = applyMealOperations(current, input, requestId);
          result = applied.result;
          return applied.journal;
        });
        return result!;
      },
      deleteIntakeEntry: (id: string) => update((current) => withoutIntakeEntry(current, id)),
      saveCustomFood: (food: Food) => update((current) => withCustomFood(current, food)),
      deleteCustomFood: (id: string) => update((current) => withoutCustomFood(current, id)),
      captureNutritionTarget: () =>
        update(async (current) => {
          await drainInputs();
          const { profile, sessions, dailyEdits } = context.read();
          if (!profile) return current;
          const now = new Date(),
            date = localWeightDate(now),
            training = getNutritionTrainingContext(profile, sessions, dailyEdits, date);
          return withDailyTargetSnapshot(
            current,
            date,
            createNutritionTargetSnapshot(profile, current, training, now.toISOString()),
          );
        }),
      confirmNutritionLogging: (date: string, slot: MealSlot | 'day', confirmed: boolean) =>
        update((current) => withMealLoggingConfirmation(current, date, slot, confirmed)),
      setNutritionMealStatus: (date: string, slot: MealSlot, status: 'not_eaten' | 'unrecorded') =>
        update((current) => withMealStatus(current, date, slot, status)),
    },
  };
}
