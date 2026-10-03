import type { MealSlot } from '../nutrition/types';
/** A display classification, never evidence that any meal was eaten. */
export function suggestedMealSlot(now: Date): MealSlot {
  const hour = now.getHours();
  return hour >= 5 && hour < 11 ? 'breakfast' : hour >= 11 && hour < 15 ? 'lunch' : hour >= 17 && hour < 22 ? 'dinner' : 'snack';
}
