import { sumNutrients } from './engine';
import { MEAL_SLOTS } from './state';
import type { FoodPortion, IntakeEntry, MealSlot, Nutrients } from './types';
import { photoUsesOnlyLabels } from './vision';

export type MealSlotSummary = {
  slot: MealSlot;
  names: string[];
  entries: IntakeEntry[];
  nutrients: Nutrients;
  containsPhoto: boolean;
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
    }];
  });
}

const recipeArtworkIngredients = {
  'soy-banana-oats': ['oats-dry', 'soy-milk', 'banana-raw', 'almonds-raw'],
  'chicken-mushroom-pasta': ['chicken-raw', 'mushroom-raw', 'pasta-cooked', 'tomato-raw'],
  'chickpea-cucumber-snack': ['chickpeas-canned', 'cucumber-raw'],
  'tilapia-bok-choy-rice': ['tilapia-raw', 'bok-choy-raw', 'rice-cooked'],
} as const;

export type RecipeArtworkKey = keyof typeof recipeArtworkIngredients;

/** Match the complete ingredient set, not a dish name or calorie number. Unknown recipes get an illustration. */
export function resolveRecipeArtwork(portions: readonly FoodPortion[]): RecipeArtworkKey | undefined {
  if (!portions.length || portions.some(portion => !Number.isFinite(portion.grams) || portion.grams <= 0)) return undefined;
  const foods = new Set(portions.map(portion => portion.foodId));
  return (Object.keys(recipeArtworkIngredients) as RecipeArtworkKey[]).find(key => {
    const required: readonly string[] = recipeArtworkIngredients[key];
    // The two hot dishes may include cooking oil. Never hide oil in another recipe's illustration.
    const allowsOil = key === 'chicken-mushroom-pasta' || key === 'tilapia-bok-choy-rice';
    return required.every(id => foods.has(id))
      && [...foods].every(id => required.includes(id) || (allowsOil && id === 'canola-oil'));
  });
}
