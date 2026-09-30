import type { Food, FoodArtworkCategory, IntakeEntry } from './types';

export const FOOD_ARTWORK_LABELS: Record<FoodArtworkCategory, string> = {
  staples: '主食', vegetables: '蔬菜', fruit: '水果', meat: '肉类', seafood: '水产',
  dairy: '乳品', legumes: '豆类', nuts: '坚果', eggs: '蛋类', oil: '用油', condiments: '调味', mixed: '食品',
};
export const FOOD_ARTWORK_CATEGORIES = Object.keys(FOOD_ARTWORK_LABELS) as FoodArtworkCategory[];
export function isFoodArtworkCategory(value: unknown): value is FoodArtworkCategory {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(FOOD_ARTWORK_LABELS, value);
}

// Deliberate ID mappings, not fuzzy name matching. Visuals never select a nutrition record.
const groups: Record<FoodArtworkCategory, readonly string[]> = {
  staples: ['oats-dry', 'rice-raw', 'brown-rice-raw', 'rice-cooked', 'pasta-cooked', 'sweet-potato-raw',
    'brown-rice-cooked', 'egg-noodles-cooked', 'potato-boiled', 'sweet-potato-boiled', 'corn-boiled', 'bread-whole-wheat',
    'millet-raw', 'millet-cooked', 'rice-noodles-dry', 'rice-noodles-cooked', 'buckwheat-raw', 'barley-cooked', 'glass-noodles-dry'],
  vegetables: ['broccoli-raw', 'bok-choy-raw', 'tomato-raw', 'cucumber-raw', 'mushroom-raw', 'spinach-boiled', 'carrot-boiled',
    'napa-cabbage-raw', 'napa-cabbage-boiled', 'cabbage-raw', 'cauliflower-raw', 'cauliflower-boiled', 'celery-raw',
    'onion-raw', 'garlic-raw', 'ginger-raw', 'eggplant-raw', 'zucchini-raw', 'shiitake-raw', 'shiitake-dry',
    'oyster-mushroom-raw', 'pumpkin-raw', 'pumpkin-boiled', 'peas-boiled', 'green-beans-boiled', 'pepper-red-raw', 'asparagus-raw', 'scallion-raw'],
  fruit: ['banana-raw', 'apple-fuji', 'orange-raw', 'grapes-raw', 'watermelon-raw', 'pear-raw', 'strawberry-raw', 'kiwi-raw',
    'mango-raw', 'papaya-raw', 'pineapple-raw', 'peach-raw', 'mandarin-raw', 'raisins-dark'],
  meat: ['chicken-raw', 'chicken-stewed', 'pork-tenderloin-roasted', 'beef-sirloin-grilled', 'duck-meat-roasted'],
  seafood: ['tilapia-raw', 'shrimp-cooked', 'salmon-cooked', 'cod-cooked', 'tuna-water-drained'],
  dairy: ['milk-2pct', 'yogurt-greek', 'milk-whole', 'yogurt-plain-whole'],
  legumes: ['tofu-firm', 'tofu-soft', 'chickpeas-canned', 'soy-milk', 'mung-beans-raw', 'mung-beans-cooked',
    'adzuki-beans-raw', 'adzuki-beans-cooked', 'lentils-cooked'],
  nuts: ['almonds-raw', 'peanuts-raw', 'peanuts-dry-roasted', 'cashews-raw', 'walnuts', 'sesame-whole-dry'],
  eggs: ['egg-raw', 'egg-boiled', 'egg-white-raw'],
  oil: ['canola-oil', 'olive-oil', 'sesame-oil'],
  condiments: ['sugar-white', 'salt-table', 'soy-sauce-shoyu', 'vinegar-distilled', 'honey'],
  mixed: [],
};
export const FOOD_ARTWORK_BY_ID: Readonly<Record<string, FoodArtworkCategory>> = Object.fromEntries(
  FOOD_ARTWORK_CATEGORIES.flatMap(category => groups[category].map(id => [id, category])),
);
export type FoodArtworkInput = Pick<Food, 'id'> & Partial<Pick<Food, 'name' | 'photo' | 'artworkCategory'>>;
export function resolveFoodArtwork(food?: FoodArtworkInput | null) {
  const category = food?.id && FOOD_ARTWORK_BY_ID[food.id]
    || (isFoodArtworkCategory(food?.artworkCategory) ? food.artworkCategory : 'mixed');
  const ingredient = food?.id === 'tomato-raw' ? 'tomato' : food?.id === 'egg-raw' ? 'egg' : undefined;
  return { category, asset: ingredient ?? (category === 'eggs' ? 'egg' : category),
    badge: ingredient ? '配图' : FOOD_ARTWORK_LABELS[category] + '图',
    accessibilityLabel: ingredient ? food?.name + '食材配图，非本次实拍' : FOOD_ARTWORK_LABELS[category] + '分类配图，非本次实拍' };
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
