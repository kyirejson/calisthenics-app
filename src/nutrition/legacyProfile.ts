import type { DietPattern, NutritionGoal } from '../types';

// Retain old profile fields for local backup compatibility and first-run preference defaults.
// They no longer produce menus or override a user's independent nutrition preferences.
export function normalizeNutritionGoal(value: unknown): NutritionGoal {
  if (value === 'weight_loss') return 'rapid_loss';
  if (value === 'cut') return 'fat_loss';
  if (value === 'gain') return 'muscle_gain';
  if (value === 'strength' || value === 'street_mastery') return 'performance';
  return ['rapid_loss', 'fat_loss', 'muscle_gain', 'performance', 'maintain'].includes(String(value)) ? value as NutritionGoal : 'maintain';
}

export function normalizeDietPattern(value: unknown): DietPattern {
  return ['balanced_cn', 'high_protein', 'low_carb', 'keto'].includes(String(value)) ? value as DietPattern : 'balanced_cn';
}
