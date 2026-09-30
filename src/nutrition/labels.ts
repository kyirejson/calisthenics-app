import type { EatingPattern, MealSlot, NutritionObjective } from './types';

export const slotLabels: Record<MealSlot, string> = { breakfast: '早餐', lunch: '午餐', snack: '加餐', dinner: '晚餐' };

export const objectiveLabels: Record<NutritionObjective, string> = {
  fat_loss: '减脂控重', muscle_gain: '增肌', maintain: '维持体重', performance: '训练供能',
};
export const patternLabels: Record<EatingPattern, string> = {
  balanced: '均衡饮食', vegetarian: '蛋奶素', low_carb: '低碳', keto: '生酮',
};
