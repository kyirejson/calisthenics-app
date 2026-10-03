import type { Food } from '../nutrition/types';
export type PortionReference = { label: string; grams: number; note: string };
/** User-selected visual references, never inferred weights. Mixed dishes have no
 * universal bowl density: expose gram reference sizes without claiming bowl equivalence. */
export function portionReferences(food: Food): PortionReference[] {
  if (food.source.kind === 'user_label') return [];
  if (food.source.kind === 'recipe_estimate') return [150, 250, 400].map(grams => ({ label: '参考成品份量 ' + grams + ' g', grams, note: '仅供你选择估量；不是默认一碗重量，可手动更正。' }));
  if (['rice-cooked', 'brown-rice-cooked'].includes(food.id)) return [{ label: '约一拳熟饭 · 150 g', grams: 150, note: '手型、含水量和压实程度不同，属于粗略估量。' }, { label: '约一普通饭碗 · 200 g', grams: 200, note: '参考碗型，不自动套用其他食品。' }];
  if (['chicken-stewed', 'beef-sirloin-grilled', 'pork-tenderloin-roasted'].includes(food.id)) return [{ label: '约一掌心熟瘦肉 · 100 g', grams: 100, note: '不含手指，厚度与手型会影响重量；并非实测。' }];
  return [];
}
