import type { Food, Nutrients } from './types';
import { publicSourceURL } from './sourceURL.mjs';

export type DishRecipe = {
  description: string; cookedGrams: number;
  ingredients: { foodId: string; grams: number }[];
  sources: { title: string; url: string }[]; fetchedAt: string;
};
export type DishSearchResult = { candidates: Food[]; message: string };
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, max: number): v is string => typeof v === 'string' && !!v.trim() && v.length <= max && !/[\u0000-\u001f]/u.test(v);
const positive = (v: unknown, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= max;
const nutrientKeys = ['calories', 'protein', 'carbs', 'fat', 'fiber'] as const;

/** Recompute from the SAME curated catalogue on server and client; never accept LLM nutrient numbers. */
export function normalizeDishFood(input: unknown, catalog: Food[]): Food | null {
  if (!obj(input) || !str(input.id, 100) || !/^custom-dish-[a-zA-Z0-9_-]+$/u.test(input.id)
    || !str(input.name, 80) || !obj(input.source) || input.source.kind !== 'recipe_estimate'
    || !obj(input.source.recipe)) return null;
  const r = input.source.recipe;
  if (!str(r.description, 300) || !positive(r.cookedGrams, 20000)
    || !str(r.fetchedAt, 30) || !Number.isFinite(Date.parse(r.fetchedAt))
    || !Array.isArray(r.ingredients) || !r.ingredients.length || r.ingredients.length > 20
    || !Array.isArray(r.sources) || !r.sources.length || r.sources.length > 4) return null;
  const sources: DishRecipe['sources'] = [];
  for (const s of r.sources) {
    if (!obj(s) || !str(s.title, 200) || !publicSourceURL(s.url)) return null;
    if (!sources.some(x => x.url === s.url)) sources.push({ title: s.title, url: s.url });
  }
  const ingredients: DishRecipe['ingredients'] = [], foods: Food[] = [];
  let rawGrams = 0;
  const per100g: Nutrients = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  for (const p of r.ingredients) {
    if (!obj(p) || !str(p.foodId, 100) || !positive(p.grams, 10000) || ingredients.some(x => x.foodId === p.foodId)) return null;
    const f = catalog.find(x => x.id === p.foodId && !x.source.kind); if (!f) return null;
    ingredients.push({ foodId: p.foodId, grams: p.grams }); foods.push(f); rawGrams += p.grams;
    for (const k of nutrientKeys) per100g[k] += f.per100g[k] * p.grams / r.cookedGrams;
  }
  if (r.cookedGrams < rawGrams * .2 || r.cookedGrams > rawGrams * 10
    || nutrientKeys.some(k => !Number.isFinite(per100g[k]) || per100g[k] > (k === 'calories' ? 1000 : 100))) return null;
  for (const k of nutrientKeys) per100g[k] = Math.round(per100g[k] * 10) / 10;
  const recipe: DishRecipe = { description: r.description, cookedGrams: r.cookedGrams, ingredients, sources, fetchedAt: r.fetchedAt };
  return { id: input.id, name: input.name.trim(), aliases: [], state: '熟制成品 · 联网参考配方估算，非实测',
    per100g, fiberKnown: foods.every(f => f.fiberKnown !== false), vegetarian: foods.every(f => f.vegetarian),
    allergens: [...new Set(foods.flatMap(f => f.allergens))], artworkCategory: 'mixed',
    source: { kind: 'recipe_estimate', title: '联网参考配方估算（用户确认，非包装标签或检测值）',
      url: sources[0].url, foodCode: input.id, version: r.fetchedAt, license: 'recipe-estimate-v1', recipe } };
}
