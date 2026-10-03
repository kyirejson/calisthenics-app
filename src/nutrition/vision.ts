import { FOOD_DATA_VERSION, FOODS, getFood } from './catalog';
import { normalizeDishFood } from './dishEstimate';
import type { Food, FoodArtworkCategory, NutritionPhoto, Nutrients } from './types';
import { normalizeFoodImportOrigin } from './foodImport';
import { normalizeNutritionPhoto } from './photoMetadata';
import { isFoodArtworkCategory } from './foodArtwork';

export type PhotoItemProvenance = {
  kind: 'photo'; renamed?: true; portionAdjusted?: true;
} | {
  kind: 'catalog'; foodId: string; foodName: string; state: string; foodDataVersion: string;
  grams: number; servingLabel: string; per100g: Nutrients; source: Food['source'];
  rangeBasis: 'inherited-photo' | 'reference-portion'; renamed?: true;
  fiberKnown?: boolean; packageGrams?: number;
  photo?: NutritionPhoto; artworkCategory?: FoodArtworkCategory;
};
export type PhotoFoodItem = {
  name: string; portionLabel: string; nutrients: Nutrients; calorieRange: { min: number; max: number };
  provenance?: PhotoItemProvenance;
  estimatedGrams?: number | null;
};

export type PhotoEstimate = {
  id: string;
  model: string;
  dishName?: string;
  calculation?: 'ingredients';
  items: PhotoFoodItem[];
  assumptions: string[];
  warnings: string[];
};

const keys = ['calories', 'protein', 'carbs', 'fat', 'fiber'] as const;
const record = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const number = (v: unknown, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max;
const lines = (v: unknown): v is string[] => Array.isArray(v) && v.length <= 12 && v.every(s => text(s, 500));
const round = (v: number) => Math.round(v * 10) / 10;
const nutrientsAt = (per100g: Nutrients, grams: number) => Object.fromEntries(keys.map(k => [k, round(per100g[k] * grams / 100)])) as Nutrients;

function normalizeProvenance(input: unknown, nutrients: Nutrients): PhotoItemProvenance | null {
  if (!record(input) || (input.renamed !== undefined && input.renamed !== true)) return null;
  const renamed = input.renamed === true ? { renamed: true as const } : {};
  if (input.kind === 'photo') {
    if (input.portionAdjusted !== undefined && input.portionAdjusted !== true) return null;
    return { kind: 'photo', ...renamed, ...(input.portionAdjusted === true ? { portionAdjusted: true as const } : {}) };
  }
  if (input.kind !== 'catalog' || !text(input.foodId, 120) || !text(input.foodName, 120) || !text(input.state, 500)
    || !text(input.foodDataVersion, 200) || !number(input.grams, 2000) || input.grams <= 0
    || !text(input.servingLabel, 160) || !record(input.per100g) || !record(input.source)
    || !['inherited-photo', 'reference-portion'].includes(String(input.rangeBasis))
    || !keys.every(k => number((input.per100g as Record<string, unknown>)[k], k === 'calories' ? 1000 : 100))
    || !['title', 'foodCode', 'version', 'license'].every(k => text((input.source as Record<string, unknown>)[k], 500))) return null;
  const source = input.source;
  const dish = source.kind === 'recipe_estimate' ? normalizeDishFood({ id: input.foodId, name: input.foodName, source }, FOODS) : null;
  if (source.kind === 'recipe_estimate' && (!dish || !keys.every(k => dish.per100g[k] === (input.per100g as Nutrients)[k]))) return null;
  if (source.kind !== undefined && !['user_label', 'recipe_estimate'].includes(String(source.kind))) return null;
  const custom = source.kind === 'user_label';
  const photo = input.photo === undefined ? undefined : normalizeNutritionPhoto(input.photo);
  if (photo === null || (input.artworkCategory !== undefined && !isFoodArtworkCategory(input.artworkCategory))) return null;
  if (!custom && (photo || input.artworkCategory !== undefined)) return null;
  const origin = source.origin === undefined ? undefined : normalizeFoodImportOrigin(source.origin);
  if (origin === null || (input.fiberKnown !== undefined && typeof input.fiberKnown !== 'boolean')
    || (input.fiberKnown === false && input.per100g.fiber !== 0)
    || (input.packageGrams !== undefined && (!number(input.packageGrams, 2000) || input.packageGrams <= 0))) return null;
  if (custom) {
    if (!(input.foodId as string).startsWith('custom-') || source.url !== (origin?.url ?? '') || source.license !== (origin?.license ?? 'user-entered')) return null;
  } else {
    if (origin || !text(source.url, 1000)) return null;
    try { const url = new URL(source.url); if (url.protocol !== 'https:' || url.username || url.password) return null; }
    catch { return null; }
  }
  const per100g = Object.fromEntries(keys.map(k => [k, (input.per100g as Nutrients)[k]])) as Nutrients;
  const calculated = nutrientsAt(per100g, input.grams);
  if (!keys.every(k => Math.abs(calculated[k] - nutrients[k]) < 0.001)) return null;
  return { kind: 'catalog', foodId: input.foodId, foodName: input.foodName, state: input.state, foodDataVersion: input.foodDataVersion,
    grams: input.grams, servingLabel: input.servingLabel, per100g,
    source: dish ? dish.source : { title: input.source.title as string, url: input.source.url as string, foodCode: input.source.foodCode as string,
      version: input.source.version as string, license: input.source.license as string,
      ...(custom ? { kind: 'user_label' as const } : {}), ...(origin ? { origin } : {}) },
    ...(input.fiberKnown !== undefined ? { fiberKnown: input.fiberKnown as boolean } : {}),
    ...(input.packageGrams !== undefined ? { packageGrams: input.packageGrams as number } : {}),
    ...(photo ? { photo } : {}), ...(isFoodArtworkCategory(input.artworkCategory) ? { artworkCategory: input.artworkCategory } : {}),
    rangeBasis: input.rangeBasis as 'inherited-photo' | 'reference-portion', ...renamed };
}

/** Vision estimates are never disguised as weighed USDA food portions. Strip unknown fields/images. */
export function normalizePhotoEstimate(input: unknown): PhotoEstimate | null {
  if (!record(input) || !text(input.id, 120) || !/^[a-zA-Z0-9_-]+$/.test(input.id)
    || !text(input.model, 100) || !Array.isArray(input.items) || input.items.length < 1 || input.items.length > 12
    || !lines(input.assumptions) || !lines(input.warnings)) return null;
  const items: PhotoEstimate['items'] = [];
  for (const item of input.items) {
    if (!record(item) || !text(item.name, 120) || !text(item.portionLabel, 160) || !record(item.nutrients)
      || !record(item.calorieRange) || !number(item.calorieRange.min, 15000) || !number(item.calorieRange.max, 15000)
      || !keys.every(k => number(item.nutrients && (item.nutrients as Record<string, unknown>)[k], k === 'calories' ? 10000 : 2000))) return null;
    const nutrients = Object.fromEntries(keys.map(k => [k, (item.nutrients as Nutrients)[k]])) as Nutrients;
    if (item.calorieRange.min > nutrients.calories || item.calorieRange.max < nutrients.calories) return null;
    // A loose lower bound catches impossible zero-energy/high-macro outputs without imposing exact 4/4/9.
    const minimumEnergy = 3 * nutrients.protein + 7 * nutrients.fat + 2 * Math.max(0, nutrients.carbs - nutrients.fiber);
    if (nutrients.calories + 50 < minimumEnergy) return null;
    const provenance = item.provenance === undefined ? undefined : normalizeProvenance(item.provenance, nutrients);
    if (provenance === null) return null;
    if (item.estimatedGrams !== undefined && item.estimatedGrams !== null && (!number(item.estimatedGrams, 2000) || item.estimatedGrams <= 0)) return null;
    if (provenance?.kind === 'catalog' && item.estimatedGrams !== undefined && item.estimatedGrams !== provenance.grams) return null;
    items.push({ name: item.name.trim(), portionLabel: item.portionLabel.trim(), nutrients,
      calorieRange: { min: item.calorieRange.min, max: item.calorieRange.max }, ...(provenance ? { provenance } : {}),
      ...(item.estimatedGrams !== undefined ? { estimatedGrams: item.estimatedGrams as number | null } : {}) });
  }
  if (items.reduce((n, item) => n + item.nutrients.calories, 0) > 20000) return null;
  if (input.dishName !== undefined && !text(input.dishName, 80)) return null;
  if (input.calculation !== undefined && input.calculation !== 'ingredients') return null;
  const ingredientBased = input.calculation === 'ingredients' && items.every(item => item.provenance?.kind === 'catalog' && item.provenance.rangeBasis === 'reference-portion');
  return { id: input.id, model: input.model, items, assumptions: [...input.assumptions], warnings: [...input.warnings],
    ...(input.dishName ? { dishName: input.dishName as string } : {}), ...(ingredientBased ? { calculation: 'ingredients' as const } : {}) };
}

export function summarizePhotoEstimate(estimate: PhotoEstimate) {
  const valid = normalizePhotoEstimate(estimate);
  if (!valid) throw new Error('识别结果无效，请重新拍照。');
  return {
    nutrients: Object.fromEntries(keys.map(k => [k, round(valid.items.reduce((n, item) => n + item.nutrients[k], 0))])) as Nutrients,
    calorieRange: { min: Math.floor(valid.items.reduce((n, item) => n + item.calorieRange.min, 0)),
      max: Math.ceil(valid.items.reduce((n, item) => n + item.calorieRange.max, 0)) },
  };
}

function checked(estimate: PhotoEstimate): PhotoEstimate {
  const valid = normalizePhotoEstimate(estimate);
  if (!valid) throw new Error('调整后的食物或份量无效，请核对后再保存。');
  return valid;
}
function scaleItem(item: PhotoFoodItem, factor: number): PhotoFoodItem {
  if (!Number.isFinite(factor) || factor < 0.1 || factor > 3) throw new Error('请选择有效的食用份量。');
  if (factor === 1) return item;
  const catalog = item.provenance?.kind === 'catalog' ? item.provenance : null;
  const grams = catalog ? round(catalog.grams * factor) : 0;
  if (catalog && (grams <= 0 || grams > 2000)) throw new Error('该食物份量超出支持范围，请分餐记录。');
  const ratio = catalog ? grams / catalog.grams : factor;
  const nutrients = catalog ? nutrientsAt(catalog.per100g, grams)
    : Object.fromEntries(keys.map(k => [k, round(item.nutrients[k] * factor)])) as Nutrients;
  // The label describes this edit, without an unbounded chain of previous multipliers.
  const portionLabel = catalog ? `${catalog.servingLabel} · 调整后参考 ${grams} g`
    : `当前食用量：调整前这项的 ${factor} 倍`;
  return { ...item, nutrients, portionLabel,
    ...(catalog ? { estimatedGrams: grams } : item.estimatedGrams ? { estimatedGrams: round(item.estimatedGrams * factor) } : {}),
    calorieRange: { min: Math.min(nutrients.calories, Math.floor(item.calorieRange.min * ratio)), max: Math.max(nutrients.calories, Math.ceil(item.calorieRange.max * ratio)) },
    provenance: catalog ? { ...catalog, grams } : { ...item.provenance, kind: 'photo', portionAdjusted: true },
  };
}

function editItem(estimate: PhotoEstimate, index: number, edit: (item: PhotoFoodItem) => PhotoFoodItem): PhotoEstimate {
  const valid = checked(estimate);
  if (!Number.isInteger(index) || !valid.items[index]) throw new Error('这项食物已移除，请重新选择。');
  return checked({ ...valid, items: valid.items.map((item, i) => i === index ? edit(item) : item) });
}
export function renamePhotoItem(estimate: PhotoEstimate, index: number, name: string): PhotoEstimate {
  if (!text(name, 120)) throw new Error('食物名称须为 1–120 个字符。');
  return editItem(estimate, index, item => ({ ...item, name: name.trim(), provenance: { ...(item.provenance ?? { kind: 'photo' }), renamed: true } }));
}
export function scalePhotoItem(estimate: PhotoEstimate, index: number, factor: number): PhotoEstimate {
  return editItem(estimate, index, item => scaleItem(item, factor));
}
/** Empty drafts are allowed so every unwanted item can be removed; they cannot be persisted. */
export function removePhotoItem(estimate: PhotoEstimate, index: number): PhotoEstimate {
  const valid = checked(estimate);
  if (!Number.isInteger(index) || !valid.items[index]) throw new Error('这项食物已移除，请重新选择。');
  return { ...valid, items: valid.items.filter((_, i) => i !== index) };
}
export function replacePhotoItemWithFood(estimate: PhotoEstimate, index: number, foodInput: string | Food, serving: { label: string; grams: number }): PhotoEstimate {
  const food = typeof foodInput === 'string' ? getFood(foodInput) : foodInput;
  if (!food || !text(serving.label, 100) || !number(serving.grams, 2000) || serving.grams <= 0) throw new Error('请选择有效的本地食物与参考份量。');
  return editItem(estimate, index, item => {
    const nutrients = nutrientsAt(food.per100g, serving.grams);
    const ratio = item.nutrients.calories > 0 ? nutrients.calories / item.nutrients.calories : null;
    const inherited = !food.source.kind && ratio !== null && (item.provenance?.kind !== 'catalog' || item.provenance.rangeBasis === 'inherited-photo');
    return { name: food.name, portionLabel: `${serving.label} · ${serving.grams} g`, nutrients, estimatedGrams: serving.grams,
      calorieRange: inherited ? { min: Math.min(nutrients.calories, Math.floor(item.calorieRange.min * ratio!)), max: Math.max(nutrients.calories, Math.ceil(item.calorieRange.max * ratio!)) }
        : { min: nutrients.calories, max: nutrients.calories },
      provenance: { kind: 'catalog', foodId: food.id, foodName: food.name, state: food.state, foodDataVersion: FOOD_DATA_VERSION,
        grams: serving.grams, servingLabel: serving.label, per100g: { ...food.per100g }, source: { ...food.source }, rangeBasis: inherited ? 'inherited-photo' : 'reference-portion',
        ...(food.fiberKnown !== undefined ? { fiberKnown: food.fiberKnown } : {}), ...(food.packageGrams ? { packageGrams: food.packageGrams } : {}),
        ...(food.source.kind === 'user_label' && food.photo ? { photo: food.photo } : {}), ...(food.source.kind === 'user_label' && food.artworkCategory ? { artworkCategory: food.artworkCategory } : {}) },
    };
  });
}

/** A missed ingredient uses an explicit reference portion, never an invented photo estimate. */
export function addPhotoFood(estimate: PhotoEstimate, foodInput: string | Food, serving: { label: string; grams: number }): PhotoEstimate {
  const food = typeof foodInput === 'string' ? getFood(foodInput) : foodInput;
  if (!food || !text(serving.label, 100) || !number(serving.grams, 2000) || serving.grams <= 0) throw new Error('请选择有效的食物与参考份量。');
  if (estimate.items.length >= 12) throw new Error('一张照片最多记录 12 项食物，可另行添加饮食记录。');
  const nutrients = nutrientsAt(food.per100g, serving.grams);
  const item: PhotoFoodItem = { name: food.name, portionLabel: `${serving.label} · ${serving.grams} g`, nutrients, estimatedGrams: serving.grams,
    calorieRange: { min: nutrients.calories, max: nutrients.calories },
    provenance: { kind: 'catalog', foodId: food.id, foodName: food.name, state: food.state, foodDataVersion: FOOD_DATA_VERSION,
      grams: serving.grams, servingLabel: serving.label, per100g: { ...food.per100g }, source: { ...food.source }, rangeBasis: 'reference-portion',
      ...(food.fiberKnown !== undefined ? { fiberKnown: food.fiberKnown } : {}), ...(food.packageGrams ? { packageGrams: food.packageGrams } : {}),
      ...(food.source.kind === 'user_label' && food.photo ? { photo: food.photo } : {}), ...(food.source.kind === 'user_label' && food.artworkCategory ? { artworkCategory: food.artworkCategory } : {}) } };
  return checked({ ...estimate, items: [...estimate.items, item] });
}

export function setPhotoItemGrams(estimate: PhotoEstimate, index: number, grams: number): PhotoEstimate {
  if (!number(grams, 2000) || grams <= 0) throw new Error('请填写 0–2000g 内的有效份量。');
  const item = checked(estimate).items[index];
  const baseline = item?.provenance?.kind === 'catalog' ? item.provenance.grams : item?.estimatedGrams;
  if (!baseline) throw new Error('原照片没有可靠重量基准，请先替换为食品库或包装标签食品。');
  return editItem(estimate, index, current => {
    const catalog = current.provenance?.kind === 'catalog' ? current.provenance : null;
    const factor = grams / baseline;
    const nutrients = catalog ? nutrientsAt(catalog.per100g, grams) : Object.fromEntries(keys.map(k => [k, round(current.nutrients[k] * factor)])) as Nutrients;
    return { ...current, nutrients, estimatedGrams: grams, portionLabel: `${grams} g · 用户确认份量`,
      calorieRange: catalog && catalog.rangeBasis === 'reference-portion' ? { min: nutrients.calories, max: nutrients.calories }
        : { min: Math.min(nutrients.calories, Math.floor(current.calorieRange.min * factor)), max: Math.max(nutrients.calories, Math.ceil(current.calorieRange.max * factor)) },
      provenance: catalog ? { ...catalog, grams } : { kind: 'photo', portionAdjusted: true, ...(current.provenance?.renamed ? { renamed: true } : {}) } };
  });
}
export function photoPortionSummary(estimate?: PhotoEstimate): string {
  if (!estimate) return '';
  return estimate.items.map(item => `${item.name} · ${item.provenance?.kind === 'catalog' ? item.provenance.grams + 'g' : item.estimatedGrams ? '估计' + item.estimatedGrams + 'g' : '份量未知'}`).join('；');
}
export function photoUsesOnlyLabels(estimate?: PhotoEstimate): boolean {
  return !!estimate?.items.length && estimate.items.every(item => item.provenance?.kind === 'catalog' && item.provenance.source.kind === 'user_label');
}

/** Correct just the selected item. A reshoot must not overwrite the other foods in a meal. */
export function applyPhotoCorrection(estimate: PhotoEstimate, index: number, correction: PhotoEstimate): PhotoEstimate {
  const valid = checked(correction);
  if (valid.items.length !== 1) throw new Error('此次只修正一项食物，请移除其他项后再应用。');
  return editItem(estimate, index, () => valid.items[0]);
}
