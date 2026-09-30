import type { NutritionJournal, NutritionPhoto } from './types';
import { validTimestamp } from './validation';

export function validPhotoId(id: unknown): id is string {
  return typeof id === 'string' && /^nutrition-photo-[a-z0-9-]{10,80}$/.test(id);
}
export function normalizeNutritionPhotos(value: unknown): NutritionPhoto[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 3) return null;
  const result: NutritionPhoto[] = [];
  for (const item of value) {
    if (!item || !validPhotoId(item.id) || !['food', 'label'].includes(item.kind) || !validTimestamp(item.capturedAt)
      || result.some(photo => photo.id === item.id)) return null;
    result.push({ id: item.id, kind: item.kind, capturedAt: item.capturedAt });
  }
  return result;
}
export function normalizeNutritionPhoto(value: unknown): NutritionPhoto | null {
  return normalizeNutritionPhotos([value])?.[0] ?? null;
}
export function referencedPhotoIds(journal: Pick<NutritionJournal, 'entries' | 'savedMeals'> & Partial<Pick<NutritionJournal, 'customFoods'>>): string[] {
  const entries = [...journal.entries, ...journal.savedMeals];
  return [...new Set([
    ...entries.flatMap(entry => entry.photos?.map(photo => photo.id) ?? []),
    ...[...(journal.customFoods ?? []), ...entries.flatMap(entry => entry.customFoods ?? [])].flatMap(food => food.photo ? [food.photo.id] : []),
    ...entries.flatMap(entry => entry.photoEstimate?.items.flatMap(item => item.provenance?.kind === 'catalog' && item.provenance.photo ? [item.provenance.photo.id] : []) ?? []),
  ])];
}
