import { FOODS } from './catalog';
import { calculatePortions } from './engine';
import { getFoodServings } from './servings';
import type { AssistantFact, AssistantIntent } from './assistantState';
import type { Food, FoodPortion, NutritionPreferences } from './types';
export type AssistantFoodRow = { request: Extract<AssistantIntent, { type: 'log_intake' }>['items'][number]; food: Food | null; grams: number | null; estimated: boolean };
const key = (v: string) => v.replace(/[\s（）()、，,]/g, '').toLowerCase();
export function assistantFoodChoices(name: string, state: 'raw' | 'cooked' | 'unknown', custom: Food[] = []): Food[] {
  const query = key(name); if (!query) return [];
  const scored = [...custom, ...FOODS].map(food => ({ food, score: key(food.name) === query ? 8 : Math.max(...[food.name, ...food.aliases].map(n => key(n) === query ? 5 : key(n).includes(query) ? 2 : query.includes(key(n)) ? 1 : 0)) }));
  const matches = scored.filter(({ food, score }) => score && (state === 'unknown' || (state === 'raw' ? /生|干|烹调前/u.test(food.state) : /熟|煮|蒸|烤|即食/u.test(food.state))));
  const exact = matches.some(row => row.score === 8) ? 8 : state !== 'unknown' && matches.some(row => row.score === 5) ? 5 : 0;
  return (exact ? matches.filter(row => row.score === exact) : matches).sort((a, b) => b.score - a.score).map(row => row.food);
}
const pieces: Record<string, number> = { 'egg-boiled': 50, 'egg-raw': 50.3, 'banana-raw': 115, 'orange-raw': 131, 'kiwi-raw': 69, 'bread-whole-wheat': 32 };
export function assistantPortion(food: Food, request: AssistantFoodRow['request']): { grams: number | null; estimated: boolean } {
  const n = request.quantity; if (n === null || request.unit === null) return { grams: null, estimated: true };
  let grams: number | null = null, estimated = true;
  if (request.unit === 'g') { grams = n; estimated = false; }
  else if (request.unit === 'piece' && pieces[food.id]) grams = n * pieces[food.id];
  else if (request.unit === 'bowl' && ['rice-cooked', 'brown-rice-cooked'].includes(food.id)) grams = n * 200;
  else if (request.unit === 'package' && food.packageGrams) grams = n * food.packageGrams;
  else if (request.unit === 'serving' && food.serving) grams = n * food.serving.grams;
  // Unknown units/recipe, mL without density and unknown package sizes are never silently 100g.
  return { grams: grams !== null && grams > 0 && grams <= 2000 ? Math.round(grams * 10) / 10 : null, estimated };
}
export function createAssistantFoodRows(intent: Extract<AssistantIntent, { type: 'log_intake' }>, custom: Food[]): AssistantFoodRow[] {
  return intent.items.map(request => { const choices = assistantFoodChoices(request.name, request.state, custom); const food = choices.length === 1 ? choices[0] : null; return { request, food, ...(food ? assistantPortion(food, request) : { grams: null, estimated: true }) }; });
}
export function assistantFoodWarnings(rows: AssistantFoodRow[], preferences: NutritionPreferences | null, facts: AssistantFact[]): string[] {
  const warnings: string[] = [];
  for (const row of rows) if (row.food) {
    if (row.food.allergens.some(a => preferences?.allergens.includes(a))) warnings.push(row.food.name + '含已设置的过敏原，请核对实际食物与标签。');
    if (facts.some(f => ['avoid', 'allergy'].includes(f.kind) && [row.food!.name, ...row.food!.aliases].some(n => key(n).includes(key(f.text)) || key(f.text).includes(key(n))))) warnings.push(row.food.name + '涉及已记住的忌口／过敏需求。');
  }
  return [...new Set(warnings)];
}
export function assistantFoodTotals(rows: AssistantFoodRow[]) {
  if (!rows.length || rows.some(r => !r.food || r.grams === null || !Number.isFinite(r.grams) || r.grams <= 0 || r.grams > 2000)) return null;
  const portions: FoodPortion[] = rows.map(r => ({ foodId: r.food!.id, grams: r.grams! }));
  const custom = [...new Map(rows.filter(r => r.food?.source.kind).map(r => [r.food!.id, r.food!])).values()];
  return { portions, nutrients: calculatePortions(portions, custom) };
}
export { getFoodServings };
