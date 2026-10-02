import { withAssistantFact, type AssistantFact } from './assistantState';
import type { Allergen, NutritionJournal } from './types';

const allergenNames: ReadonlyArray<[string, Allergen]> = [
  ['牛奶', 'milk'], ['乳制品', 'milk'], ['鸡蛋', 'egg'], ['大豆', 'soy'], ['小麦', 'wheat'],
  ['花生', 'peanut'], ['坚果', 'tree_nut'], ['鱼', 'fish'], ['虾', 'shellfish'], ['贝类', 'shellfish'],
];
export function rememberedAllergens(facts: AssistantFact[]): Allergen[] {
  return [...new Set(facts.filter(f => f.kind === 'allergy' && !/没有|不是|并非|不过敏|不$/u.test(f.text))
    .flatMap(f => allergenNames.filter(([name]) => f.text.includes(name)).map(([, allergen]) => allergen)))];
}

/** Keep manual exclusions distinct so removing a memory cannot erase a manual allergy. */
export function synchronizeMemoryAllergens(journal: NutritionJournal): NutritionJournal {
  const manualAllergens = journal.manualAllergens ?? journal.preferences?.allergens ?? [];
  if (!journal.preferences) return { ...journal, manualAllergens };
  const allergens = [...new Set([...manualAllergens, ...rememberedAllergens(journal.assistant.facts)])];
  return { ...journal, manualAllergens, preferences: { ...journal.preferences, allergens } };
}

export function withRememberedFact(journal: NutritionJournal, fact: AssistantFact): NutritionJournal {
  const remembered = withAssistantFact(journal.assistant, fact);
  const assistant = { ...remembered, conversations: remembered.conversations.map(turn => fact.id === 'fact-' + turn.id
    ? { ...turn, answer: '已记住，可在“记忆”中查看或删除。' } : turn) };
  return synchronizeMemoryAllergens({ ...journal, assistant });
}
export function withoutRememberedFact(journal: NutritionJournal, id: string): NutritionJournal {
  return synchronizeMemoryAllergens({ ...journal, assistant: { ...journal.assistant, facts: journal.assistant.facts.filter(f => f.id !== id) } });
}
