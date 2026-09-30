import type { Profile } from '../types';
import { localWeightDate } from '../data/weightTrend';
import { RECIPES } from './catalog';
import { allowsRecipe, fitRecipe, getMealAlternatives, mealOverrideBasis, mealScore, normalizeNutritionPreferences, nutritionRevisionKey, planDailyMenu, sumNutrients, type MealTargets } from './engine';
import { MEAL_SLOTS, normalizeAgentAction, normalizeMealOverride } from './state';
import { validTimestamp } from './validation';
import { photoUsesOnlyLabels } from './vision';
import type { DailyMenu, MealSlot, Nutrients, NutritionAgentAction, NutritionJournal, NutritionPlanningContext, NutritionTrainingContext, PlannedMeal } from './types';

export function nutritionPlanningContext(journal: NutritionJournal, training: NutritionTrainingContext): NutritionPlanningContext {
  return { training, trainingTime: journal.trainingTime, overrides: journal.mealOverrides };
}

export function buildNutritionMenu(profile: Profile, journal: NutritionJournal, training: NutritionTrainingContext, date: string): DailyMenu {
  return planDailyMenu(profile, journal.preferences, date, journal.mealRevisions, nutritionPlanningContext(journal, training));
}

export type MealAdjustmentDraft = {
  date: string; slot: MealSlot; request: NutritionAgentAction;
  basisToken: string; mealBasis: string; original: PlannedMeal; meal: PlannedMeal;
  difference: Pick<Nutrients, 'calories' | 'protein' | 'carbs' | 'fat'>;
  projected: Nutrients; projectionLabel: '推荐菜单合计' | '已记＋余下推荐';
  explanation: string; notes: string[];
};
export type MealDraftResult = { status: 'ready'; draft: MealAdjustmentDraft } | { status: 'paused' | 'needs_logs' | 'no_candidate' | 'no_change'; message: string };

function draftToken(menu: DailyMenu, journal: NutritionJournal, training: NutritionTrainingContext): string {
  const day = journal.days[menu.date];
  return JSON.stringify([menu.date, menu.signature, day?.confirmedSlots || [], day?.completedAt || null,
    journal.entries.filter(item => item.date === menu.date).sort((a, b) => a.id.localeCompare(b.id)).map(item => [item.id, item.slot, item.updatedAt, item.nutrients]),
    training]);
}

function nextSlot(journal: NutritionJournal, date: string, menu: DailyMenu, now: Date): MealSlot | undefined {
  const hour = now.getHours();
  const start = hour < 11 ? 0 : hour < 15 ? 1 : hour < 18 ? 2 : 3;
  const unavailable = (slot: MealSlot) => journal.days[date]?.confirmedSlots.includes(slot) || journal.entries.some(item => item.date === date && item.slot === slot);
  return MEAL_SLOTS.slice(start).find(slot => !unavailable(slot) && menu.meals.some(meal => meal.slot === slot));
}
const round = (value: number) => Math.round(value * 10) / 10;
const bounded = (value: number, base: number, low: number, high: number) => Math.max(base * low, Math.min(base * high, value));

/** All quantities come from the catalogue engine. An LLM can request a tool but
 * cannot supply a recipe, bypass allergens, lower targets, or mark food as eaten.
 */
export function prepareMealAdjustment(profile: Profile, journal: NutritionJournal, training: NutritionTrainingContext, date: string, action: NutritionAgentAction, now = new Date().toISOString()): MealDraftResult {
  const request = normalizeAgentAction(action);
  if (!request || !validTimestamp(now) || date !== localWeightDate(new Date(now))) return { status: 'paused', message: '菜单操作仅用于今天；请回到今天并重新生成草案。' };
  const menu = buildNutritionMenu(profile, journal, training, date);
  const prefs = normalizeNutritionPreferences(journal.preferences);
  if (!prefs || menu.targets.status !== 'ready') return { status: 'paused', message: '当前健康筛查或营养模式未开放自动配餐，不能生成菜单操作。仍可手动记餐。' };
  const slot = request.slot === 'next' ? nextSlot(journal, date, menu, new Date(now)) : request.slot;
  if (!slot || journal.days[date]?.completedAt) return { status: 'no_candidate', message: '今天没有可调整的未吃餐次。明天正常进餐，不用为今天补偿。' };
  if (journal.entries.some(item => item.date === date && item.slot === slot) || journal.days[date]?.confirmedSlots.includes(slot)) return { status: 'no_candidate', message: '这餐已经有摄入记录或已确认结束，请编辑实际记录，不要用菜单替换已吃的食物。' };
  const original = menu.meals.find(meal => meal.slot === slot);
  if (!original) return { status: 'no_candidate', message: '当前限制下这餐没有完整菜谱。过敏限制不能放宽，可调整制作时间或预算。' };
  const entries = journal.entries.filter(item => item.date === date);
  const consumed = sumNutrients(entries.map(item => item.nutrients));
  const notes = ['只修改这餐推荐，不改全天目标、不动其他餐，也不自动记为已吃。'];
  let meal: PlannedMeal | undefined;
  let projected: Nutrients;
  let projectionLabel: MealAdjustmentDraft['projectionLabel'];
  let explanation: string;
  if (request.type === 'swap_meal') {
    const alternatives = getMealAlternatives(profile, prefs, date, journal.mealRevisions, slot, nutritionPlanningContext(journal, training));
    const ranked = [...alternatives].sort((a, b) => {
      const score = (candidate: typeof a) => mealScore(candidate.meal.nutrients, original.nutrients)
        + (request.focus === 'quick' ? candidate.meal.minutes / 20 : 0)
        - (request.focus === 'protein' ? Math.min(0.3, candidate.meal.nutrients.protein / Math.max(1, original.nutrients.protein) * 0.1) : 0);
      return score(a) - score(b) || a.meal.recipeId.localeCompare(b.meal.recipeId);
    });
    meal = ranked[0]?.meal;
    if (!meal) return { status: 'no_candidate', message: '暂无符合过敏、饮食方式、制作时间和预算的另一道菜，保留当前推荐。' };
    projected = sumNutrients(menu.meals.map(item => item.slot === slot ? meal!.nutrients : item.nutrients));
    projectionLabel = '推荐菜单合计';
    explanation = request.focus === 'quick' ? '优先选择制作更省时、营养差距较小的菜谱。'
      : request.focus === 'protein' ? '在现有完整菜谱中优先考虑蛋白质，不直接加开补剂。' : '换一道符合当前偏好的菜，先比较营养差异。';
  } else {
    const day = journal.days[date];
    const earlier = MEAL_SLOTS.slice(0, MEAL_SLOTS.indexOf(slot));
    if (earlier.some(item => !day?.confirmedSlots.includes(item)) || entries.some(item => !day?.confirmedSlots.includes(item.slot))) {
      return { status: 'needs_logs', message: '先确认前面各餐和已有记录已记完整（包括饮料、用油；未吃也要确认），再按实际摄入调整下一餐。漏记不算少吃。' };
    }
    if (menu.meals.length !== MEAL_SLOTS.length) return { status: 'no_candidate', message: '今日菜单不完整，暂不推算余下全天供能。可以直接换一道，不强行补齐。' };
    const later = menu.meals.filter(item => MEAL_SLOTS.indexOf(item.slot) > MEAL_SLOTS.indexOf(slot)
      && !day?.confirmedSlots.includes(item.slot) && !entries.some(entry => entry.slot === item.slot));
    const fixed = sumNutrients([consumed, ...later.map(item => item.nutrients)]);
    // A single meal never compensates for a whole day's shortfall or overshoot.
    // These deliberately modest bounds are product guardrails, not clinical doses.
    const desired: MealTargets = {
      calories: bounded(menu.targets.calories - fixed.calories, original.nutrients.calories, 0.85, 1.15),
      protein: bounded(menu.targets.protein - fixed.protein, original.nutrients.protein, 0.8, 1.25),
      carbs: bounded(menu.targets.carbs - fixed.carbs, original.nutrients.carbs, 0.85, 1.15),
      fat: bounded(menu.targets.fat - fixed.fat, original.nutrients.fat, 0.85, 1.1),
    };
    const candidates = RECIPES.filter(recipe => recipe.slots.includes(slot) && allowsRecipe(recipe, prefs))
      .map(recipe => fitRecipe(recipe, slot, desired))
      // Optimizer tolerances must not expand the meal into punitive extremes.
      .filter(candidate => candidate.nutrients.calories >= original.nutrients.calories * 0.8
        && candidate.nutrients.calories <= original.nutrients.calories * 1.2);
    const proteinPenalty = (candidate: PlannedMeal) => request.focus === 'protein' ? Math.max(0, desired.protein - candidate.nutrients.protein) / Math.max(1, desired.protein) : 0;
    candidates.sort((a, b) => mealScore(a.nutrients, desired) - mealScore(b.nutrients, desired) + proteinPenalty(a) - proteinPenalty(b)
      + (request.focus === 'quick' ? (a.minutes - b.minutes) / 40 : 0)
      + (a.recipeId === original.recipeId ? -0.01 : 0) - (b.recipeId === original.recipeId ? -0.01 : 0)
      || a.recipeId.localeCompare(b.recipeId));
    meal = candidates[0];
    if (!meal) return { status: 'no_candidate', message: '现有配方在温和调整范围内找不到合适方案，保留这餐，不能靠极端增减份量凑目标。' };
    projected = sumNutrients([fixed, meal.nutrients]);
    projectionLabel = '已记＋余下推荐';
    explanation = '以已确认记完整的摄入为基础，余下餐保持不变，只温和调整这一餐。';
    notes.push('合计包含尚未吃的推荐，不是实际全天摄入；不能识别漏记或保证达标。');
    if (entries.some(entry => entry.source === 'photo_estimate' && !photoUsesOnlyLabels(entry.photoEstimate))) notes.push('前面的记录含照片估算，份量、用油和隐藏配料会影响这份草案。');
    if (consumed.calories >= menu.targets.calories) notes.push('已记能量达到参考；下一餐仍正常吃，不以不吃饭或额外运动补偿。');
  }
  const difference = Object.fromEntries((['calories', 'protein', 'carbs', 'fat'] as const).map(key => [key, round(meal!.nutrients[key] - original.nutrients[key])])) as MealAdjustmentDraft['difference'];
  if (meal.recipeId === original.recipeId && Math.abs(difference.calories) < 1 && Math.abs(difference.protein) < 0.5
    && Math.abs(difference.carbs) < 0.5 && Math.abs(difference.fat) < 0.5) return { status: 'no_change', message: '这餐已经接近温和调整后的安排，保持原菜谱即可，不为制造变化而换餐。' };
  if (prefs.allergens.length) notes.push('食材已按过敏标注筛选；购买时仍需核对包装、酱料与交叉接触，不是过敏安全保证。');
  if (Math.abs(projected.calories - menu.targets.calories) > menu.targets.calories * 0.15) notes.push('所列组合仍与全天能量参考有较大差距，不会强行用这一餐凑齐。');
  if ((prefs.objective === 'muscle_gain' && projected.calories < menu.targets.tdee)
    || (prefs.objective === 'fat_loss' && projected.calories > menu.targets.tdee)) notes.push('所列组合尚未满足当前目标的供能方向，不能称为已经达标。');
  notes.push(...menu.warnings);
  return { status: 'ready', draft: { date, slot, request: { ...request, slot }, basisToken: draftToken(menu, journal, training),
    mealBasis: mealOverrideBasis(menu.planningSignature, slot, journal.mealRevisions[nutritionRevisionKey(date, slot)] || 0),
    original, meal, difference, projected, projectionLabel, explanation, notes: [...new Set(notes)] } };
}

export function withAppliedMealDraft(current: NutritionJournal, profile: Profile, training: NutritionTrainingContext, draft: MealAdjustmentDraft, now = new Date().toISOString()): NutritionJournal {
  if (!draft || typeof draft.basisToken !== 'string') throw new Error('草案无效，请重新生成。');
  const result = prepareMealAdjustment(profile, current, training, draft.date, draft.request, now);
  if (result.status !== 'ready') throw new Error(result.message);
  if (result.draft.basisToken !== draft.basisToken || JSON.stringify(result.draft.meal) !== JSON.stringify(draft.meal)) throw new Error('饮食记录、目标或课程已变化，请重新生成草案，查看差异后再确认。');
  const override = normalizeMealOverride({ basis: result.draft.mealBasis, meal: result.draft.meal, kind: draft.request.type === 'swap_meal' ? 'swap' : 'rebalance', createdAt: now });
  if (!override) throw new Error('草案份量无法通过校验，未更改任何记录。');
  return { ...current, mealOverrides: { ...current.mealOverrides, [nutritionRevisionKey(draft.date, draft.slot)]: override } };
}
