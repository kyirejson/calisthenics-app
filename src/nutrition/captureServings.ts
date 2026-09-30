import type { Food } from './types';
import { getFoodServings } from './servings';

export function captureServings(food: Food): { label: string; grams: number }[] {
  const options = food.packageGrams ? [{ label: '整包', grams: food.packageGrams }, { label: '半包', grams: food.packageGrams / 2 }, { label: '四分之一包', grams: food.packageGrams / 4 }] : [];
  if (food.serving) options.push({ ...food.serving });
  options.push(...(food.source.kind === 'user_label' ? [{ label: '参考 20g', grams: 20 }, { label: '参考 30g', grams: 30 }] : getFoodServings(food.id)));
  return options.filter((option, index) => options.findIndex(other => other.label === option.label && other.grams === option.grams) === index);
}
