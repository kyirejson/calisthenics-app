import { createIntakeEntry, normalizeCustomFood, normalizeIntakeEntry, normalizeNutritionPreferences, nutritionRevisionKey } from './engine';
import type { Food, IntakeEntry, MealSlot, NutritionJournal, NutritionPreferences } from './types';
import { invalidateMealLogging } from './timeline';

export type IntakeInput = Omit<IntakeEntry, 'createdAt' | 'updatedAt' | 'foodDataVersion' | 'nutrients'>;

export function withNutritionPreferences(current: NutritionJournal, input: NutritionPreferences): NutritionJournal {
  const preferences = normalizeNutritionPreferences(input);
  if (!preferences) throw new Error('营养档案不完整，请重新确认设置。');
  return { ...current, preferences };
}

/** A planned meal may be confirmed once per local date/slot; extra food is a manual entry. */
export function withIntakeEntry(current: NutritionJournal, input: IntakeInput, now = new Date().toISOString()): NutritionJournal {
  const sourceKey = input.source === 'planned_meal' ? nutritionRevisionKey(input.date, input.slot) : undefined;
  const existing = current.entries.find((entry) => entry.id === input.id);
  // An explicit draft snapshot wins over an old entry, which wins over the live
  // custom-food library. Editing or deleting a label never changes past meals.
  const foods = new Map<string, Food>();
  for (const food of [...current.customFoods, ...(existing?.customFoods ?? []), ...(input.customFoods ?? [])]) foods.set(food.id, food);
  const customFoods = [...foods.values()].filter(food => input.portions.some(portion => portion.foodId === food.id));
  const candidate = createIntakeEntry({ ...input, sourceKey, customFoods, photos: input.photos ?? existing?.photos, now });
  const duplicate = sourceKey && current.entries.find((entry) => entry.source === 'planned_meal'
    && entry.date === input.date && entry.slot === input.slot && entry.id !== input.id);
  if (duplicate) {
    if (existing) throw new Error('该餐已经有记录，请编辑已有记录或另记加餐。');
    return current;
  }
  // Device clock corrections must not make a legitimate edit invalid on next launch.
  const updatedAt = existing && Date.parse(existing.updatedAt) > Date.parse(candidate.updatedAt) ? existing.updatedAt : candidate.updatedAt;
  const entry = { ...candidate, createdAt: existing?.createdAt || candidate.createdAt, updatedAt };
  let next = invalidateMealLogging(current, entry.date, entry.slot);
  if (existing && (existing.date !== entry.date || existing.slot !== entry.slot)) next = invalidateMealLogging(next, existing.date, existing.slot);
  return { ...next, entries: [entry, ...next.entries.filter((item) => item.id !== entry.id)] };
}

export function withoutIntakeEntry(current: NutritionJournal, id: string): NutritionJournal {
  const entry = current.entries.find(item => item.id === id);
  if (!entry) return current;
  const next = invalidateMealLogging(current, entry.date, entry.slot);
  return { ...next, entries: next.entries.filter((item) => item.id !== id) };
}

export function withMealRevision(current: NutritionJournal, date: string, slot: MealSlot, revision: number): NutritionJournal {
  const key = nutritionRevisionKey(date, slot);
  if (!Number.isSafeInteger(revision) || revision < 0 || revision >= Number.MAX_SAFE_INTEGER) throw new Error('餐次候选编号无效，请重新选择。');
  const mealOverrides = { ...current.mealOverrides };
  delete mealOverrides[key];
  return { ...current, mealRevisions: { ...current.mealRevisions, [key]: revision }, mealOverrides };
}

export function withoutMealOverride(current: NutritionJournal, date: string, slot: MealSlot): NutritionJournal {
  const key = nutritionRevisionKey(date, slot);
  if (!current.mealOverrides[key]) return current;
  const mealOverrides = { ...current.mealOverrides };
  delete mealOverrides[key];
  return { ...current, mealOverrides };
}

export function withCustomFood(current: NutritionJournal, input: Food): NutritionJournal {
  const food = normalizeCustomFood(input);
  if (!food) throw new Error('自定义食品无效，请核对包装标签。');
  if (current.customFoods.length >= 200 && !current.customFoods.some(item => item.id === food.id)) throw new Error('自定义食品最多保存 200 项，请先删除不再使用的食品。');
  return { ...current, customFoods: [food, ...current.customFoods.filter(item => item.id !== food.id)] };
}

export function withoutCustomFood(current: NutritionJournal, id: string): NutritionJournal {
  return { ...current, customFoods: current.customFoods.filter(food => food.id !== id) };
}

export function withFavoriteMeal(current: NutritionJournal, input: IntakeEntry): NutritionJournal {
  const meal = normalizeIntakeEntry(input);
  if (!meal) throw new Error('这条记录无法保存为常用餐，请先核对记录。');
  if (current.savedMeals.length >= 100 && !current.savedMeals.some(item => item.id === meal.id)) throw new Error('常用餐最多保存 100 项，请先移除不再使用的餐食。');
  return { ...current, savedMeals: [meal, ...current.savedMeals.filter(item => item.id !== meal.id)] };
}

export function withoutFavoriteMeal(current: NutritionJournal, id: string): NutritionJournal {
  return { ...current, savedMeals: current.savedMeals.filter(meal => meal.id !== id) };
}
