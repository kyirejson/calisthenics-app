import { FOODS } from './catalog';
import { getFoodServings } from './servings';
import { addPhotoFood, normalizePhotoEstimate, type PhotoEstimate } from './vision';
import type { Food } from './types';

export type IngredientCandidate = {
  name: string; state: 'raw' | 'cooked' | 'unknown'; role: 'food' | 'oil';
  estimatedGrams: number | null; count: number | null;
};
export type IngredientRecognition = {
  id: string; model: string; dishName: string; ingredients: IngredientCandidate[];
  needsOilReview: boolean; warnings: string[];
};
export type CaptureIngredient = {
  key: string; name: string; role: 'food' | 'oil'; food: Food | null;
  grams: number | null; count: number | null; gramsPerUnit: number | null;
  unit: string; quantityLabel: string;
};
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max: number): v is string => typeof v === 'string' && !!v.trim() && v.length <= max;
const quantity = (v: unknown, max: number) => v === null || typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= max;

/** The model supplies candidates only. Nutrients, sources and catalog IDs are never accepted. */
export function normalizeIngredientRecognition(value: unknown): IngredientRecognition | null {
  if (!object(value) || Object.keys(value).some(k => !['kind', 'id', 'model', 'dishName', 'ingredients', 'needsOilReview', 'warnings'].includes(k))
    || value.kind !== 'ingredients' || !text(value.id, 120) || !/^[\w-]+$/.test(value.id)
    || !text(value.model, 100) || !text(value.dishName, 80) || typeof value.needsOilReview !== 'boolean'
    || !Array.isArray(value.ingredients) || !value.ingredients.length || value.ingredients.length > 12
    || !Array.isArray(value.warnings) || value.warnings.length > 10 || !value.warnings.every(v => text(v, 200))) return null;
  const ingredients: IngredientCandidate[] = [];
  for (const item of value.ingredients) {
    if (!object(item) || Object.keys(item).some(k => !['name', 'state', 'role', 'estimatedGrams', 'count'].includes(k))
      || !text(item.name, 80) || !['raw', 'cooked', 'unknown'].includes(String(item.state))
      || !['food', 'oil'].includes(String(item.role)) || !quantity(item.estimatedGrams, 2000)
      || !quantity(item.count, 30) || item.count !== null && !Number.isInteger(item.count)
      || item.role === 'oil' && (item.estimatedGrams !== null || item.count !== null)) return null;
    ingredients.push({ name: item.name.trim(), state: item.state as IngredientCandidate['state'], role: item.role as IngredientCandidate['role'],
      estimatedGrams: item.estimatedGrams as number | null, count: item.count as number | null });
  }
  if (new Set(ingredients.map(item => item.name.replace(/\s+/g, '').toLowerCase() + ':' + item.state + ':' + item.role)).size !== ingredients.length) return null;
  return { id: value.id, model: value.model, dishName: value.dishName.trim(), ingredients,
    needsOilReview: value.needsOilReview, warnings: [...value.warnings] as string[] };
}

const clean = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '');
function condition(food: Food): 'raw' | 'cooked' | 'neutral' {
  if (/(?:raw|dry)$/.test(food.id)) return 'raw';
  if (/(?:cooked|boiled|stewed|roasted|grilled)$/.test(food.id)) return 'cooked';
  return 'neutral';
}
/** Exact alias matches only; never fuzzy-match a composite dish to an unrelated recipe. */
export function matchIngredient(candidate: IngredientCandidate, foods: Food[] = FOODS): Food | null {
  // A generic description cannot establish the species or cut in a reference record.
  if (['鸡肉', '鱼肉', '鱼', '肉', '蔬菜'].includes(clean(candidate.name))) return null;
  const matches = foods.filter(food => [food.name, ...food.aliases].some(name => clean(name) === clean(candidate.name))
    && (condition(food) === 'neutral' || candidate.state !== 'unknown' && condition(food) === candidate.state)
    && (candidate.role === 'oil' ? food.id.endsWith('-oil') : !food.id.endsWith('-oil')));
  return matches.length === 1 ? matches[0] : null;
}

export function ingredientForFood(food: Food | null, candidate: IngredientCandidate, key: string): CaptureIngredient {
  const countWeights: Record<string, number> = { 'egg-raw': 50.3, 'egg-boiled': 50, 'tomato-raw': 125 };
  const perUnit = food ? countWeights[food.id] : undefined;
  const count = perUnit && candidate.count ? candidate.count : null;
  // Tomato count weights are a convenience estimate, not USDA count measurements.
  const grams = candidate.role === 'oil' ? null : count ? Math.round(count * perUnit! * 10) / 10 : candidate.estimatedGrams;
  return { key, name: candidate.name, role: candidate.role, food, grams, count,
    gramsPerUnit: perUnit ?? (grams ? grams : null), unit: perUnit ? '个' : '份',
    quantityLabel: candidate.role === 'oil' ? '油量需要你确认' : '份量估计' };
}
export function createIngredientReview(recognition: IngredientRecognition, customFoods: Food[] = []): CaptureIngredient[] {
  const foods = [...FOODS, ...customFoods];
  const rows = recognition.ingredients.map((candidate, i) => ingredientForFood(matchIngredient(candidate, foods), candidate, 'ingredient-' + i));
  if (recognition.needsOilReview && !rows.some(row => row.role === 'oil')) {
    const candidate: IngredientCandidate = { name: '食用油', state: 'unknown', role: 'oil', estimatedGrams: null, count: null };
    rows.push(ingredientForFood(matchIngredient(candidate, foods), candidate, 'ingredient-oil'));
  }
  return rows;
}
export function ingredientIssue(rows: CaptureIngredient[]): string | null {
  if (!rows.length || rows.length > 12) return '请保留 1–12 项食材。';
  for (const row of rows) {
    if (row.role === 'oil' && row.grams === 0) continue;
    if (!row.food) return '请为“' + row.name + '”选择食品库条目。';
    if (row.grams === null) return row.role === 'oil' ? '请确认用油量。' : '请确认“' + row.name + '”的份量。';
    if (!Number.isFinite(row.grams) || row.grams <= 0 || row.grams > 2000) return '请核对“' + row.name + '”的份量（不超过 2000g）。';
  }
  if (rows.every(row => row.grams === 0)) return '这一餐还没有食物。';
  return null;
}
export function calculateIngredients(recognition: IngredientRecognition, rows: CaptureIngredient[], fraction: number): PhotoEstimate {
  const issue = ingredientIssue(rows);
  if (issue) throw new Error(issue);
  if (![1, .5, .25].includes(fraction)) throw new Error('请选择有效的食用比例。');
  let estimate: PhotoEstimate = { id: recognition.id, model: recognition.model, dishName: recognition.dishName,
    calculation: 'ingredients', items: [], assumptions: ['按用户确认的食材与食用比例查食品库计算；生重与熟重不混用。'],
    warnings: [...new Set(['份量、配方和油量仍有误差，不能用于判断过敏安全。', ...recognition.warnings])].slice(0, 10) };
  for (const row of rows) {
    if (row.grams === 0) continue;
    const grams = Math.round(row.grams! * fraction * 10) / 10;
    if (grams <= 0) throw new Error('食用量过小，请调整份量。');
    const portion = fraction === 1 ? '全部' : fraction === .5 ? '一半' : '四分之一';
    estimate = addPhotoFood(estimate, row.food!, { grams, label: `${row.name} · ${portion} · 参考份量` });
  }
  const valid = normalizePhotoEstimate(estimate);
  if (!valid) throw new Error('食材计算未通过校验，请检查份量。');
  return valid;
}
export function referenceServings(food: Food) { return getFoodServings(food); }
