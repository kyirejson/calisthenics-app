import type { Profile } from '../types';
import { localWeightDate } from '../domain/weight/weightTrend';
import { FOOD_DATA_VERSION } from './foodData';
import { normalizePhotoEstimate, summarizePhotoEstimate, type PhotoEstimate } from './vision';
import { isValidDateKey, validTimestamp } from './validation';
import { normalizeFoodImportOrigin } from './foodImport';
import { normalizeNutritionPhoto, normalizeNutritionPhotos } from './photoMetadata';
import { isFoodArtworkCategory } from './foodArtwork';
import { normalizeNutritionDays, TRAINING_TIMES } from './state';
import type {
  Allergen, FoodPortion, IntakeEntry, MealSlot, Nutrients,
  NutritionJournal, NutritionPreferences, NutritionRisk, NutritionTargets, TrainingTime,
} from './types';

export { isValidDateKey } from './validation';

const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'snack', 'dinner'];
const ALLERGENS: Allergen[] = ['milk', 'egg', 'soy', 'wheat', 'peanut', 'tree_nut', 'fish', 'shellfish'];
const RISKS: NutritionRisk[] = ['pregnancy', 'medical_condition', 'glucose_medication', 'sglt2', 'eating_disorder'];
const NUTRIENTS: Array<keyof Nutrients> = ['calories', 'protein', 'carbs', 'fat', 'fiber'];
const ZERO = (): Nutrients => ({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const round = (value: number) => Math.round((value + Number.EPSILON) * 10) / 10;
const isSlot = (value: unknown): value is MealSlot => SLOTS.includes(value as MealSlot);
const validText = (value: unknown, max = 200): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,199}$/.test(value);

export function defaultNutritionPreferences(profile: Profile): NutritionPreferences {
  const requested = profile.nutritionGoal;
  return {
    version: 1,
    objective: requested === 'rapid_loss' || requested === 'fat_loss' ? 'fat_loss'
      : requested === 'muscle_gain' || requested === 'performance' ? requested : 'maintain',
    pattern: profile.dietPattern === 'low_carb' || profile.dietPattern === 'keto' ? profile.dietPattern : 'balanced',
    activity: 'light', allergens: [], riskFlags: [], screeningCompletedAt: null,
  };
}

export function normalizeNutritionPreferences(input: unknown): NutritionPreferences | null {
  if (!isRecord(input) || input.version !== 1
    || !['fat_loss', 'muscle_gain', 'maintain', 'performance'].includes(input.objective as string)
    || !['balanced', 'vegetarian', 'low_carb', 'keto'].includes(input.pattern as string)
    || !['sedentary', 'light', 'active'].includes(input.activity as string)
    || !Array.isArray(input.allergens) || !input.allergens.every(item => ALLERGENS.includes(item))
    || !Array.isArray(input.riskFlags) || !input.riskFlags.every(item => RISKS.includes(item))
    || !(input.screeningCompletedAt === null || validTimestamp(input.screeningCompletedAt))) return null;
  return {
    version: 1, objective: input.objective as NutritionPreferences['objective'],
    pattern: input.pattern as NutritionPreferences['pattern'], activity: input.activity as NutritionPreferences['activity'],
    allergens: ALLERGENS.filter(item => (input.allergens as unknown[]).includes(item)),
    riskFlags: RISKS.filter(item => (input.riskFlags as unknown[]).includes(item)),
    screeningCompletedAt: input.screeningCompletedAt as string | null,
  };
}

function noTargets(status: NutritionTargets['status'], message: string): NutritionTargets {
  return { calories: 0, protein: 0, carbs: 0, fat: 0, bmr: 0, tdee: 0, status, message };
}

export function calculateTargets(profile: Profile, preferences: NutritionPreferences | null): NutritionTargets {
  const prefs = normalizeNutritionPreferences(preferences);
  if (!prefs || !prefs.screeningCompletedAt) return noTargets('needs_setup', '请先完成营养偏好与健康风险确认，再生成目标。');
  if (!profile || ![profile.age, profile.height, profile.weight].every(finite)
    || !Number.isInteger(profile.age) || profile.age < 1 || profile.age > 100
    || profile.height < 120 || profile.height > 230 || profile.weight < 30 || profile.weight > 300
    || !['male', 'female'].includes(profile.sex)) {
    return noTargets('needs_setup', '年龄、身高、体重或生理性别不完整，或超出当前估算范围，请核对个人资料。');
  }
  if (profile.age < 18) return noTargets('blocked', '成人估算不适用于未成年人。请由监护人陪同向医生或营养师了解适合生长发育的饮食。');
  if (prefs.riskFlags.length) return noTargets('blocked', '已标记需要专业指导的情况，本功能暂停量化目标。可继续手动记餐，并向医生或营养师寻求个体建议；不要自行调整药物。');
  const bmi = profile.weight / (profile.height / 100) ** 2;
  if (bmi < 18.5) return noTargets('blocked', '当前体重偏低，暂停成人自动目标，请先向医生或营养师了解自身需要。');
  const latestWeight = [...(profile.weightHistory || [])].filter(item => isValidDateKey(item.date) && item.date <= localWeightDate(new Date())
    && finite(item.kg) && item.kg >= 30 && item.kg <= 300).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (latestWeight && latestWeight.kg / (profile.height / 100) ** 2 < 18.5) return noTargets('blocked', '近期体重记录提示体重偏低，请先核对称重和单位；已暂停自动目标，不会继续沿用旧档案的体重给出减重建议。必要时向医生或营养师咨询。');
  if (prefs.pattern === 'low_carb' || prefs.pattern === 'keto') {
    return noTargets('unsupported', '低碳与生酮的专项筛查、配方和审核路径尚未启用。请选择均衡或蛋奶素模式计算目标，手动记餐仍可使用。');
  }
  // Mifflin–St Jeor: https://pubmed.ncbi.nlm.nih.gov/2305711/ .
  // Adult-only scope: https://www.niddk.nih.gov/health-information/weight-management/body-weight-planner .
  // Activity, modest +/- energy changes, bounds and macro allocation below are conservative
  // product defaults, not measured expenditure or an individually prescribed diet.
  const bmr = Math.round(10 * profile.weight + 6.25 * profile.height - 5 * profile.age + (profile.sex === 'male' ? 5 : -161));
  const tdee = Math.round(bmr * ({ sedentary: 1.2, light: 1.4, active: 1.6 }[prefs.activity]));
  const change = prefs.objective === 'fat_loss' ? -0.1 : prefs.objective === 'muscle_gain' ? 0.05 : 0;
  const floor = Math.max(bmr, profile.sex === 'male' ? 1500 : 1200);
  const calories = Math.round(Math.max(floor, tdee * (1 + change)));
  // ISSN 2017 healthy-exerciser range: https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/ .
  // Bound the reference mass and energy share so high body mass cannot scale protein indefinitely.
  const referenceWeight = Math.min(profile.weight, 25 * (profile.height / 100) ** 2);
  const protein = Math.round(Math.min(referenceWeight * (prefs.objective === 'maintain' ? 1.4 : 1.6), calories * 0.3 / 4));
  const fat = Math.round(calories * 0.28 / 9);
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);
  const limited = calories > tdee * (1 + change) + 1 ? '已限制能量下调幅度。' : '';
  return { calories, protein, fat, carbs, bmr, tdee, status: 'ready',
    message: `基于成人公式与所选日常活动程度的起始估算，不是实测消耗或医疗处方。${limited}${referenceWeight < profile.weight ? '蛋白估算采用有上限的参考体重。' : ''}` };
}

function validatePortions(input: unknown): FoodPortion[] {
  if (!Array.isArray(input) || !input.length || input.length > 100) throw new Error('请至少选择一种食物，单次最多 100 项。');
  return input.map(item => {
    if (!isRecord(item) || !validId(item.foodId)) throw new Error('食物不存在，请重新选择。');
    if (!finite(item.grams) || item.grams <= 0 || item.grams > 2000) throw new Error('每项食物重量须为大于 0、至多 2000 的有限克数。');
    return { foodId: item.foodId, grams: item.grams };
  });
}

export function sumNutrients(items: Nutrients[]): Nutrients {
  const totals = ZERO();
  for (const item of items) for (const key of NUTRIENTS) {
    if (!item || !finite(item[key]) || item[key] < 0) throw new Error('营养数值无效。');
    totals[key] += item[key];
    if (!Number.isFinite(totals[key])) throw new Error('营养合计超出范围。');
  }
  for (const key of NUTRIENTS) {
    totals[key] = round(totals[key]);
    if (!Number.isFinite(totals[key])) throw new Error('营养合计超出范围。');
  }
  return totals;
}

export function calculatePortions(portions: FoodPortion[], customFoods: import('./types').Food[] = []): Nutrients {
  const foods = validateCustomFoods(customFoods);
  return sumNutrients(validatePortions(portions).map(portion => {
    const food = foods.find(item => item.id === portion.foodId);
    if (!food) throw new Error('食物不存在，请重新选择。');
    return Object.fromEntries(NUTRIENTS.map(key => [key, food.per100g[key] * portion.grams / 100])) as Nutrients;
  }));
}

export function nutritionRevisionKey(date: string, slot: MealSlot): string {
  if (!isValidDateKey(date) || !isSlot(slot)) throw new Error('餐次或日期无效。');
  return `${date}:${slot}`;
}

export function createIntakeEntry(args: {
  id: string; date: string; slot: MealSlot; name: string; portions: FoodPortion[];
  source: IntakeEntry['source']; sourceKey?: string; now?: string; photoEstimate?: PhotoEstimate; customFoods?: import('./types').Food[]; photos?: IntakeEntry['photos'];
}): IntakeEntry {
  if (!validId(args.id) || !isValidDateKey(args.date) || !isSlot(args.slot) || !validText(args.name)) throw new Error('记录名称、日期、餐次或编号无效。');
  if (!['manual', 'planned_meal', 'photo_estimate'].includes(args.source)) throw new Error('记录来源无效。');
  if (args.source === 'planned_meal' && !validId(args.sourceKey)) throw new Error('计划餐记录缺少有效来源编号。');
  if (args.sourceKey !== undefined && !validId(args.sourceKey)) throw new Error('来源编号无效。');
  const now = args.now ?? new Date().toISOString();
  if (!validTimestamp(now)) throw new Error('记录时间无效。');
  const photos = normalizeNutritionPhotos(args.photos);
  if (!photos) throw new Error('照片引用无效，请重新保存。');
  const attachments = photos.length ? { photos } : {};
  if (args.source === 'photo_estimate') {
    const estimate = normalizePhotoEstimate(args.photoEstimate);
    if (!estimate) throw new Error('照片营养估算无效，请重新识别。');
    return { id: args.id, date: args.date, slot: args.slot, name: args.name.trim(), portions: [],
      nutrients: summarizePhotoEstimate(estimate).nutrients, source: 'photo_estimate', photoEstimate: estimate,
      ...attachments, ...(estimate.items.some(item => item.provenance?.kind === 'catalog' && item.provenance.fiberKnown === false) ? { fiberIncomplete: true } : {}),
      createdAt: now, updatedAt: now, foodDataVersion: 'vision-estimate-v1' };
  }
  const portions = validatePortions(args.portions);
  const customFoods = validateCustomFoods(args.customFoods ?? []).filter(food => portions.some(portion => portion.foodId === food.id));
  const fiberIncomplete = customFoods.some(food => food.fiberKnown === false);
  return { id: args.id, date: args.date, slot: args.slot, name: args.name.trim(), portions,
    nutrients: calculatePortions(portions, customFoods), source: args.source,
    ...attachments, ...(customFoods.length ? { customFoods } : {}), ...(fiberIncomplete ? { fiberIncomplete: true } : {}),
    ...(args.sourceKey ? { sourceKey: args.sourceKey } : {}), createdAt: now, updatedAt: now, foodDataVersion: FOOD_DATA_VERSION };
}

export function emptyNutritionJournal(): NutritionJournal {
  return { version: 1, manualAllergens: [], photoConsentAt: null, preferences: null, entries: [], customFoods: [], savedMeals: [], trainingTime: 'unspecified', days: {} };
}

/** User labels never impersonate the curated catalogue or a measured USDA source. */
export function normalizeCustomFood(input: unknown): import('./types').Food | null {
  if (!isRecord(input) || !validId(input.id) || !input.id.startsWith('custom-')
    || !validText(input.name, 80) || !validText(input.state, 120) || !isRecord(input.per100g)
    || !Array.isArray(input.allergens) || input.allergens.length > ALLERGENS.length || !input.allergens.every(item => ALLERGENS.includes(item))
    || !isRecord(input.source) || input.source.kind !== 'user_label' || typeof input.fiberKnown !== 'boolean'
    || !NUTRIENTS.every(key => finite(input.per100g && (input.per100g as Record<string, unknown>)[key])
      && ((input.per100g as Record<string, unknown>)[key] as number) >= 0
      && ((input.per100g as Record<string, unknown>)[key] as number) <= (key === 'calories' ? 1000 : 100))) return null;
  const values = input.per100g as Nutrients;
  const origin = input.source.origin === undefined ? undefined : normalizeFoodImportOrigin(input.source.origin);
  if (origin === null) return null;
  const photo = input.photo === undefined ? undefined : normalizeNutritionPhoto(input.photo);
  if (photo === null || (input.artworkCategory !== undefined && !isFoodArtworkCategory(input.artworkCategory))) return null;
  if (input.packageGrams !== undefined && (!finite(input.packageGrams) || input.packageGrams <= 0 || input.packageGrams > 2000)) return null;
  if (input.fiberKnown === false && values.fiber !== 0) return null;
  if (values.calories + 50 < values.protein * 3 + values.fat * 7 + Math.max(0, values.carbs - values.fiber) * 2) return null;
  let serving: import('./types').Food['serving'];
  if (input.serving !== undefined) {
    if (!isRecord(input.serving) || !validText(input.serving.label, 40) || !finite(input.serving.grams)
      || input.serving.grams <= 0 || input.serving.grams > 2000) return null;
    serving = { label: input.serving.label.trim(), grams: input.serving.grams };
  }
  return { id: input.id, name: input.name.trim(), aliases: [], state: input.state.trim(),
    per100g: Object.fromEntries(NUTRIENTS.map(key => [key, values[key]])) as Nutrients,
    allergens: ALLERGENS.filter(item => (input.allergens as unknown[]).includes(item)), vegetarian: false,
    fiberKnown: input.fiberKnown, ...(serving ? { serving } : {}), ...(input.packageGrams !== undefined ? { packageGrams: input.packageGrams as number } : {}),
    ...(photo ? { photo } : {}), ...(isFoodArtworkCategory(input.artworkCategory) ? { artworkCategory: input.artworkCategory } : {}),
    source: { kind: 'user_label', title: origin?.provider === 'open_food_facts' ? 'Open Food Facts 社区数据（用户核对保存，未经本应用核验）'
      : origin ? '用户拍摄包装标签（模型抄录、用户核对，未经本应用核验）' : '用户录入包装营养标签（未经核验）',
      url: origin?.url ?? '', foodCode: origin?.provider === 'open_food_facts' ? 'OFF ' + origin.identifier : input.id,
      version: origin ? origin.fetchedAt : 'user-label-v1', license: origin?.license ?? 'user-entered', ...(origin ? { origin } : {}) } };
}

function validateCustomFoods(input: unknown): import('./types').Food[] {
  if (!Array.isArray(input) || input.length > 200) throw new Error('自定义食品列表无效或超过 200 项。');
  const result: import('./types').Food[] = [];
  for (const value of input) {
    const food = normalizeCustomFood(value);
    if (!food || result.some(item => item.id === food.id)) throw new Error('自定义食品数据无效，请核对包装标签。');
    result.push(food);
  }
  return result;
}

export function createCustomFoodFromLabel(input: import('./types').CustomFoodLabelInput): import('./types').Food {
  if (!finite(input.basisGrams) || input.basisGrams <= 0 || input.basisGrams > 2000
    || !['kcal', 'kJ'].includes(input.energyUnit)
    || ![input.calories, input.protein, input.carbs, input.fat].every(value => finite(value) && value >= 0)
    || (input.fiber !== undefined && (!finite(input.fiber) || input.fiber < 0))) throw new Error('请填写有效的包装营养数值和对应重量。');
  const factor = 100 / input.basisGrams;
  const food = normalizeCustomFood({ id: input.id, name: input.name, state: input.state?.trim() || '按包装营养标签所示状态', aliases: [],
    per100g: { calories: input.calories / (input.energyUnit === 'kJ' ? 4.184 : 1) * factor,
      protein: input.protein * factor, carbs: input.carbs * factor, fat: input.fat * factor, fiber: (input.fiber ?? 0) * factor },
    fiberKnown: input.fiber !== undefined, allergens: input.allergens, serving: input.serving, packageGrams: input.packageGrams,
    source: { kind: 'user_label', ...(input.origin ? { origin: input.origin } : {}) } });
  if (!food) throw new Error('标签数值或食品信息超出合理范围，请核对单位与每份重量。');
  return food;
}

export function normalizeIntakeEntry(input: unknown): IntakeEntry | null {
  if (!isRecord(input) || !validId(input.id) || !isValidDateKey(input.date) || !isSlot(input.slot)
    || !validText(input.name) || !validText(input.foodDataVersion, 120)
    || !validTimestamp(input.createdAt) || !validTimestamp(input.updatedAt)
    || Date.parse(input.updatedAt) < Date.parse(input.createdAt)
    || !['manual', 'planned_meal', 'photo_estimate'].includes(input.source as string)
    || (input.source === 'planned_meal' && !validId(input.sourceKey))
    || (input.sourceKey !== undefined && !validId(input.sourceKey)) || !isRecord(input.nutrients)) return null;
  const photos = normalizeNutritionPhotos(input.photos);
  if (!photos) return null;
  const attachments = photos.length ? { photos } : {};
  if (input.source === 'photo_estimate') {
    const estimate = normalizePhotoEstimate(input.photoEstimate);
    if (!estimate || input.foodDataVersion !== 'vision-estimate-v1' || !Array.isArray(input.portions) || input.portions.length) return null;
    const nutrients = summarizePhotoEstimate(estimate).nutrients;
    if (!NUTRIENTS.every(key => input.nutrients && (input.nutrients as Record<string, unknown>)[key] === nutrients[key])) return null;
    return { id: input.id, date: input.date, slot: input.slot, name: input.name.trim(), portions: [], nutrients,
      ...attachments, ...(estimate.items.some(item => item.provenance?.kind === 'catalog' && item.provenance.fiberKnown === false) ? { fiberIncomplete: true } : {}),
      source: 'photo_estimate', photoEstimate: estimate, foodDataVersion: 'vision-estimate-v1', createdAt: input.createdAt, updatedAt: input.updatedAt };
  }
  let portions: FoodPortion[];
  let customFoods: import('./types').Food[];
  try {
    portions = validatePortions(input.portions);
    customFoods = validateCustomFoods(input.customFoods ?? []).filter(food => portions.some(portion => portion.foodId === food.id));
    if (portions.some(portion => !customFoods.some(food => food.id === portion.foodId)
      && (input.foodDataVersion === FOOD_DATA_VERSION || portion.foodId.startsWith('custom-')))) return null;
  } catch { return null; }
  const nutrients = input.nutrients;
  const mass = portions.reduce((sum, item) => sum + item.grams, 0);
  // Historical snapshots are validated for finite, plausible bounds, never recomputed with today's DB.
  if (!NUTRIENTS.every(key => finite(nutrients[key]) && (nutrients[key] as number) >= 0
    && (nutrients[key] as number) <= mass * (key === 'calories' ? 10 : 1) + 1)) return null;
  return { id: input.id, date: input.date, slot: input.slot, name: input.name.trim(), portions,
    nutrients: Object.fromEntries(NUTRIENTS.map(key => [key, nutrients[key]])) as Nutrients,
    ...attachments, source: input.source as IntakeEntry['source'],
    ...(customFoods.length ? { customFoods } : {}),
    ...(customFoods.some(food => food.fiberKnown === false) ? { fiberIncomplete: true } : {}),
    ...(input.source === 'planned_meal' ? { sourceKey: nutritionRevisionKey(input.date, input.slot) }
      : input.sourceKey ? { sourceKey: input.sourceKey as string } : {}),
    createdAt: input.createdAt, updatedAt: input.updatedAt, foodDataVersion: input.foodDataVersion };
}

export function normalizeNutritionJournal(input: unknown): NutritionJournal {
  const result = emptyNutritionJournal();
  if (!isRecord(input) || input.version !== 1) return result;
  result.photoConsentAt = validTimestamp(input.photoConsentAt) ? input.photoConsentAt : null;
  result.preferences = normalizeNutritionPreferences(input.preferences);
  // Legacy data has no provenance; preserve those exclusions as manual rather than guessing.
  const manual = input.manualAllergens;
  result.manualAllergens = Array.isArray(manual) && manual.every(a => ALLERGENS.includes(a))
    ? ALLERGENS.filter(a => manual.includes(a)) : result.preferences?.allergens ?? [];
  result.trainingTime = TRAINING_TIMES.includes(input.trainingTime as TrainingTime) ? input.trainingTime as TrainingTime : 'unspecified';
  result.days = normalizeNutritionDays(input.days);
  const ids = new Set<string>();
  const sources = new Set<string>();
  if (Array.isArray(input.entries)) for (const value of input.entries) {
    const entry = normalizeIntakeEntry(value);
    const sourceIdentity = entry?.source === 'planned_meal' ? nutritionRevisionKey(entry.date, entry.slot) : null;
    if (!entry || ids.has(entry.id) || (sourceIdentity && sources.has(sourceIdentity))) continue;
    ids.add(entry.id);
    if (sourceIdentity) sources.add(sourceIdentity);
    result.entries.push(entry);
  }
  if (Array.isArray(input.customFoods)) for (const value of input.customFoods.slice(0, 200)) {
    const food = normalizeCustomFood(value);
    if (food && !result.customFoods.some(item => item.id === food.id)) result.customFoods.push(food);
  }
  for (const [date, day] of Object.entries(result.days)) {
    const conflicts = (day.skippedSlots || []).filter(slot => result.entries.some(entry => entry.date === date && entry.slot === slot));
    if (conflicts.length) result.days[date] = { ...day, skippedSlots: day.skippedSlots!.filter(slot => !conflicts.includes(slot)), confirmedSlots: day.confirmedSlots.filter(slot => !conflicts.includes(slot)), completedAt: null };
  }
  if (Array.isArray(input.savedMeals)) for (const value of input.savedMeals.slice(0, 100)) {
    const entry = normalizeIntakeEntry(value);
    if (entry && !result.savedMeals.some(item => item.id === entry.id)) result.savedMeals.push(entry);
  }
  return result;
}
