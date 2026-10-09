import type { Food, FoodArtworkCategory, IntakeEntry } from './types';

export const FOOD_ARTWORK_LABELS: Record<FoodArtworkCategory, string> = {
  staples: '主食', vegetables: '蔬菜', fruit: '水果', meat: '肉类', seafood: '水产',
  dairy: '乳品', legumes: '豆类', nuts: '坚果', eggs: '蛋类', oil: '用油', condiments: '调味', mixed: '食品',
};
export const FOOD_ARTWORK_CATEGORIES = Object.keys(FOOD_ARTWORK_LABELS) as FoodArtworkCategory[];
export function isFoodArtworkCategory(value: unknown): value is FoodArtworkCategory {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(FOOD_ARTWORK_LABELS, value);
}

export type FoodArtworkInput = Pick<Food, 'id'> & Partial<Pick<Food, 'name' | 'photo' | 'artworkCategory'>>;
export function resolveFoodArtwork(food?: FoodArtworkInput | null) {
  const category = isFoodArtworkCategory(food?.artworkCategory) ? food.artworkCategory : 'mixed';
  return { category, asset: category === 'eggs' ? 'egg' : category,
    badge: FOOD_ARTWORK_LABELS[category] + '图',
    accessibilityLabel: FOOD_ARTWORK_LABELS[category] + '分类配图，非本次实拍' };
}

/** A meal gets a single-food photo only when it really contains one food. */
export function mealFoodArtwork(entries: readonly IntakeEntry[]): FoodArtworkInput | null {
  const items = entries.flatMap(entry => entry.photoEstimate
    ? entry.photoEstimate.items.map(item => item.provenance?.kind === 'catalog'
      ? { id: item.provenance.foodId, name: item.name, photo: item.provenance.photo, artworkCategory: item.provenance.artworkCategory }
      : { id: 'unmatched-food', name: item.name })
    : entry.portions.map(portion => entry.customFoods?.find(food => food.id === portion.foodId) ?? { id: portion.foodId, name: entry.name }));
  if (items.length === 1) return items[0];
  const categories = new Set(items.map(item => resolveFoodArtwork(item).category));
  return { id: 'meal-category', name: '餐食', artworkCategory: categories.size === 1 ? [...categories][0] : 'mixed' };
}
