import { sumNutrients } from './engine';
import { MEAL_SLOTS } from './state';
import type { IntakeEntry, MealSlot, Nutrients } from './types';
import { photoUsesOnlyLabels } from './vision';
import { hasUnknownNutrition, nutrientKnown } from './agentFood';

export type MealSlotSummary = {
  slot: MealSlot;
  names: string[];
  entries: IntakeEntry[];
  nutrients: Nutrients;
  containsPhoto: boolean;
  caloriesKnown: boolean;
  caloriesMissing: boolean;
  missingNutrition: number;
  missingAmounts: number;
  containsEstimates: boolean;
};

/** Read stored nutrient snapshots, never recalculate yesterday's intake from today's food table. */
export function summarizeMealSlots(entries: readonly IntakeEntry[]): MealSlotSummary[] {
  return MEAL_SLOTS.flatMap(slot => {
    const meals = entries.filter(entry => entry.slot === slot);
    if (!meals.length) return [];
    return [{
      slot,
      names: [...new Set(meals.map(entry => entry.name))],
      entries: meals,
      nutrients: sumNutrients(meals.map(entry => entry.nutrients)),
      containsPhoto: meals.some(entry => entry.source === 'photo_estimate' && !photoUsesOnlyLabels(entry.photoEstimate)),
      caloriesKnown: meals.some(entry => nutrientKnown(entry, 'calories')),
      caloriesMissing: meals.some(entry => !nutrientKnown(entry, 'calories')),
      missingNutrition: meals.filter(hasUnknownNutrition).length,
      missingAmounts: meals.filter(entry => entry.source === 'agent' && !entry.agentFood?.amount).length,
      containsEstimates: meals.some(entry => entry.agentFood?.estimated || entry.photoEstimate && !photoUsesOnlyLabels(entry.photoEstimate)),
    }];
  });
}
