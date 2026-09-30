import type { Allergen, FoodImportOrigin, FoodLabelDraft } from './types';
import { validTimestamp } from './validation';

const allergens: Allergen[] = ['milk', 'egg', 'soy', 'wheat', 'peanut', 'tree_nut', 'fish', 'shellfish'];
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max && !/[\u0000-\u001f]/.test(v);
const num = (v: unknown, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max;
export function validFoodBarcode(value: unknown): value is string {
  if (typeof value !== 'string' || !/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(value)) return false;
  let sum = 0;
  for (let i = value.length - 2, weight = 3; i >= 0; i--, weight = weight === 3 ? 1 : 3) sum += Number(value[i]) * weight;
  return (10 - sum % 10) % 10 === Number(value.at(-1));
}
export function normalizeFoodImportOrigin(input: unknown): FoodImportOrigin | null {
  if (!record(input) || !validTimestamp(input.fetchedAt)) return null;
  if (input.provider === 'open_food_facts' && validFoodBarcode(input.identifier)
    && input.url === 'https://world.openfoodfacts.org/product/' + input.identifier && input.license === 'ODbL-1.0')
    return { provider: input.provider, identifier: input.identifier, fetchedAt: input.fetchedAt, url: input.url, license: input.license };
  if (input.provider === 'label_photo' && text(input.identifier, 100) && /^[a-zA-Z0-9_.-]+$/.test(input.identifier)
    && input.url === '' && input.license === 'user-entered')
    return { provider: input.provider, identifier: input.identifier, fetchedAt: input.fetchedAt, url: '', license: input.license };
  return null;
}
export function normalizeFoodLabelDraft(input: unknown): FoodLabelDraft | null {
  if (!record(input) || !text(input.name, 80) || !text(input.state, 120) || !['g', 'ml', 'unknown'].includes(input.basisUnit as string)
    || !['kcal', 'kJ', null].includes(input.energyUnit as string | null)) return null;
  const origin = normalizeFoodImportOrigin(input.origin);
  if (!origin || !(input.basisAmount === null || (num(input.basisAmount, 2000) && input.basisAmount > 0))
    || (input.basisUnit === 'unknown' && input.basisAmount !== null)) return null;
  for (const key of ['calories', 'protein', 'carbs', 'fat', 'fiber'])
    if (input[key] !== null && !num(input[key], key === 'calories' ? 50000 : 2000)) return null;
  if (!Array.isArray(input.allergens) || input.allergens.length > 8 || !input.allergens.every(v => allergens.includes(v))
    || !Array.isArray(input.warnings) || input.warnings.length > 6 || !input.warnings.every(v => text(v, 120))) return null;
  if (input.serving !== null && (!record(input.serving) || !text(input.serving.label, 40) || !input.serving.label.trim()
    || !num(input.serving.grams, 2000) || input.serving.grams <= 0)) return null;
  if (input.packageGrams !== undefined && input.packageGrams !== null && (!num(input.packageGrams, 2000) || input.packageGrams <= 0)) return null;
  return { name: input.name, state: input.state, basisUnit: input.basisUnit as FoodLabelDraft['basisUnit'],
    basisAmount: input.basisAmount as number | null, energyUnit: input.energyUnit as FoodLabelDraft['energyUnit'],
    calories: input.calories as number | null, protein: input.protein as number | null, carbs: input.carbs as number | null,
    fat: input.fat as number | null, fiber: input.fiber as number | null,
    serving: input.serving === null ? null : { ...(input.serving as { label: string; grams: number }) },
    allergens: [...new Set(input.allergens)] as Allergen[], warnings: [...input.warnings] as string[], origin,
    ...(input.packageGrams !== undefined ? { packageGrams: input.packageGrams as number | null } : {}) };
}

/** Missing or volumetric bases are blank: reviewing the form cannot silently turn mL into g. */
export function labelDraftFormValues(draft: FoodLabelDraft) {
  return { name: draft.name, state: draft.state, basis: draft.basisUnit === 'g' && draft.basisAmount === 100 ? '100g' as const : 'serving' as const,
    basisGrams: draft.basisUnit === 'g' && draft.basisAmount !== null ? String(draft.basisAmount) : '',
    energyUnit: draft.energyUnit, values: { calories: draft.calories === null ? '' : String(draft.calories),
      protein: draft.protein === null ? '' : String(draft.protein), carbs: draft.carbs === null ? '' : String(draft.carbs),
      fat: draft.fat === null ? '' : String(draft.fat), fiber: draft.fiber === null ? '' : String(draft.fiber) } };
}
