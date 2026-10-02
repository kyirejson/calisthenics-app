import { defaultNutritionPreferences } from './engine';
import { withNutritionPreferences } from './journal';
import { normalizePreferencePatch } from './preferenceIntent.mjs';
import { rememberedAllergens } from './assistantMemory';
import type { AssistantPreferencePatch } from './assistantState';
import type { NutritionJournal } from './types';
import type { Profile } from '../types';

export function withAssistantPreferences(current: NutritionJournal, profile: Profile | null, input: AssistantPreferencePatch): NutritionJournal {
  const patch = normalizePreferencePatch(input) as AssistantPreferencePatch | null;
  if (!patch || !profile) throw new Error('营养偏好或个人资料无效，请重新描述。');
  const base = current.preferences || defaultNutritionPreferences(profile);
  const { noListedRisks, removeAllergens = [], ...fields } = patch;
  if (removeAllergens.some(a => rememberedAllergens(current.assistant.facts).includes(a))) throw new Error('此过敏原仍在助手记忆中，请先删除对应记忆，再更正偏好。');
  return withNutritionPreferences(current, {
    ...base, ...fields,
    // Preserve manual/memory provenance; additions must not overwrite earlier allergens.
    allergens: [...new Set([...(current.manualAllergens ?? base.allergens).filter(a => !removeAllergens.includes(a)), ...(patch.allergens || [])])],
    riskFlags: noListedRisks ? [] : [...new Set([...base.riskFlags, ...(patch.riskFlags || [])])],
    screeningCompletedAt: noListedRisks || patch.riskFlags?.length ? new Date().toISOString() : base.screeningCompletedAt,
  });
}
