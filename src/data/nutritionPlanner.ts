import type { DietPattern, NutritionGoal, Profile } from '../types';

export type MealPlanItem = {
  name: string;
  timing: string;
  calories: number;
  foods: string[];
  purpose: string;
};

export type NutritionPlan = {
  requestedGoal: NutritionGoal;
  requestedPattern: DietPattern;
  goal: NutritionGoal;
  pattern: DietPattern;
  goalLabel: string;
  strategy: string;
  bmr: number;
  tdee: number;
  targetCalories: number;
  calorieDelta: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  waterMl: number;
  meals: MealPlanItem[];
  principles: string[];
  bmi: number;
  referenceWeight: number;
  safetyLevel: 'ok' | 'warning' | 'blocked';
  safetyTitle?: string;
  safetyMessage?: string;
  caution?: string;
};

export const nutritionGoals: Array<{ key: NutritionGoal; label: string; subtitle: string }> = [
  { key: 'rapid_loss', label: '体重下降', subtitle: '想先瘦下来，控制节奏而非极端节食' },
  { key: 'fat_loss', label: '减脂塑形', subtitle: '保住肌肉，同时降低体脂率' },
  { key: 'muscle_gain', label: '精益增肌', subtitle: '轻微热量盈余，提高训练恢复' },
  { key: 'performance', label: '力量表现', subtitle: '训练日前后增加碳水供能' },
  { key: 'maintain', label: '健康维持', subtitle: '均衡饮食，稳定体重与精力' },
];

export const dietPatterns: Array<{ key: DietPattern; label: string; subtitle: string }> = [
  { key: 'balanced_cn', label: '均衡家常', subtitle: '谷薯、鱼禽蛋奶豆和蔬菜多样搭配' },
  { key: 'high_protein', label: '高蛋白', subtitle: '提高蛋白比例，适合训练和饱腹管理' },
  { key: 'low_carb', label: '适度低碳', subtitle: '减少精制主食，保留训练所需碳水' },
  { key: 'keto', label: '生酮', subtitle: '每日约 20~40g 总碳水的限制性模式' },
];

type DayMenus = { training: string[][]; rest: string[][] };

const balancedMenus: Record<NutritionGoal, DayMenus> = {
  rapid_loss: {
    training: [
      ['无糖希腊酸奶 200g', '水煮蛋 2 个', '莓果 100g'],
      ['鸡胸肉 180g', '糙米饭 1 小碗', '双份绿叶蔬菜'],
      ['低脂牛奶 250ml', '苹果 1 个'],
      ['清蒸鱼 180g', '菌菇蔬菜 2 份', '小份红薯'],
    ],
    rest: [
      ['鸡蛋蔬菜碗', '无糖豆浆 300ml'],
      ['瘦牛肉 160g', '杂粮饭半碗', '彩色蔬菜 2 份'],
      ['无糖酸奶 150g', '小番茄'],
      ['虾仁豆腐煲', '凉拌蔬菜', '玉米半根'],
    ],
  },
  fat_loss: {
    training: [
      ['燕麦 50g', '鸡蛋 2 个', '无糖牛奶 250ml'],
      ['鸡腿肉去皮 180g', '米饭 1 小碗', '西兰花胡萝卜'],
      ['希腊酸奶 200g', '香蕉 1 根'],
      ['三文鱼 150g', '土豆 200g', '大份沙拉'],
    ],
    rest: [
      ['全麦面包 2 片', '鸡蛋 2 个', '无糖咖啡或茶'],
      ['卤牛腱 160g', '杂粮饭半碗', '时蔬 2 份'],
      ['低脂奶 250ml', '坚果 10g'],
      ['鸡胸肉菌菇汤', '南瓜 150g', '绿叶蔬菜'],
    ],
  },
  muscle_gain: {
    training: [
      ['燕麦 80g', '牛奶 300ml', '鸡蛋 3 个', '香蕉'],
      ['牛肉 200g', '米饭 2 碗', '彩色蔬菜'],
      ['酸奶 250g', '全麦面包 2 片', '花生酱 15g'],
      ['鸡腿肉 220g', '意面或米饭 1.5 碗', '蔬菜'],
    ],
    rest: [
      ['全麦三明治', '鸡蛋 2 个', '牛奶 300ml'],
      ['三文鱼 180g', '米饭 1.5 碗', '蔬菜'],
      ['奶酪或酸奶', '水果', '坚果 20g'],
      ['瘦牛肉 200g', '土豆 300g', '蔬菜汤'],
    ],
  },
  performance: {
    training: [
      ['燕麦香蕉碗', '鸡蛋 2 个', '牛奶 300ml'],
      ['瘦牛肉 180g', '米饭 1.5 碗', '蔬菜'],
      ['训练前：香蕉与酸奶', '训练后：低脂奶 250ml'],
      ['鱼或鸡肉 200g', '土豆或米饭', '绿叶蔬菜'],
    ],
    rest: [
      ['鸡蛋 2 个', '全麦主食', '水果'],
      ['鸡肉 180g', '杂粮饭 1 碗', '蔬菜'],
      ['酸奶 200g', '坚果 15g'],
      ['豆腐牛肉煲', '小份米饭', '蔬菜'],
    ],
  },
  maintain: {
    training: [
      ['燕麦 50g', '鸡蛋 2 个', '时令水果'],
      ['鱼禽肉 160g', '杂粮饭 1 碗', '蔬菜 2 份'],
      ['无糖酸奶', '水果或坚果'],
      ['豆制品与瘦肉', '小份主食', '蔬菜汤'],
    ],
    rest: [
      ['全谷主食', '鸡蛋', '牛奶或豆浆'],
      ['鱼禽肉 150g', '杂粮饭', '深色蔬菜'],
      ['水果 1 份', '坚果 15g'],
      ['豆腐菌菇煲', '小份主食', '蔬菜'],
    ],
  },
};

const patternMenus: Record<Exclude<DietPattern, 'balanced_cn'>, DayMenus> = {
  high_protein: {
    training: [
      ['无糖希腊酸奶 250g', '鸡蛋 2 个', '燕麦 40g', '莓果 100g'],
      ['鸡胸肉或瘦牛肉 200g', '杂粮饭 1 碗', '双份绿叶蔬菜'],
      ['低脂牛奶 300ml', '低脂奶酪或无糖酸奶 1 份'],
      ['清蒸鱼 200g', '豆腐 150g', '菌菇蔬菜 2 份', '小份薯类'],
    ],
    rest: [
      ['鸡蛋 2 个', '无糖豆浆 300ml', '全麦面包 1 片'],
      ['去皮鸡腿肉 200g', '杂粮饭半碗', '彩色蔬菜 2 份'],
      ['无糖希腊酸奶 200g', '坚果 10g'],
      ['虾仁 180g', '老豆腐 150g', '绿叶蔬菜 2 份'],
    ],
  },
  low_carb: {
    training: [
      ['鸡蛋 2 个', '无糖酸奶 200g', '莓果 100g'],
      ['瘦牛肉 180g', '糙米饭半碗', '西兰花与菌菇 2 份'],
      ['训练前香蕉半根', '无糖豆浆 250ml'],
      ['清蒸鱼 200g', '豆腐 100g', '大份非淀粉蔬菜'],
    ],
    rest: [
      ['鸡蛋蔬菜碗', '无糖豆浆 300ml'],
      ['去皮鸡腿肉 180g', '菜花饭或杂粮饭三分之一碗', '蔬菜 2 份'],
      ['无糖希腊酸奶 150g', '坚果 15g'],
      ['虾仁豆腐煲', '凉拌绿叶蔬菜', '牛油果四分之一个'],
    ],
  },
  keto: {
    training: [
      ['鸡蛋 3 个', '牛油果半个', '无糖咖啡或茶'],
      ['三文鱼 180g', '橄榄油沙拉', '西兰花 250g'],
      ['原味希腊酸奶 100g', '核桃 20g'],
      ['牛排 180g', '菌菇与绿叶蔬菜', '橄榄油 10g'],
    ],
    rest: [
      ['芝士煎蛋', '牛油果半个', '菠菜'],
      ['鸡腿肉 200g', '橄榄油蔬菜沙拉', '豆腐 100g'],
      ['坚果 20g', '黄瓜'],
      ['清蒸鱼 200g', '菌菇', '低碳绿叶蔬菜 2 份'],
    ],
  },
};

const patternStrategies: Record<DietPattern, string> = {
  balanced_cn: '以全谷薯类、鱼禽蛋奶豆和多种蔬菜完成均衡搭配',
  high_protein: '把蛋白质均匀分到四餐，同时保留训练所需主食',
  low_carb: '减少精制主食，把有限碳水优先安排在训练前后',
  keto: '将总碳水控制在约 20~40g，以不饱和脂肪和非淀粉蔬菜补足能量',
};

const mealDistributions: Record<DietPattern, number[]> = {
  balanced_cn: [0.25, 0.35, 0.12, 0.28],
  high_protein: [0.25, 0.34, 0.16, 0.25],
  low_carb: [0.27, 0.36, 0.1, 0.27],
  keto: [0.28, 0.35, 0.1, 0.27],
};

const patternPrinciples: Record<DietPattern, string[]> = {
  balanced_cn: [
    '每餐包含一掌心优质蛋白，主食粗细搭配',
    '每天至少两种深色蔬菜和一种完整水果',
    '训练日把较多主食放在训练前后，休息日保持蛋白不变',
  ],
  high_protein: [
    '将全天蛋白平均分到四餐，避免只在晚餐集中补充',
    '优先选择鱼、禽、蛋、低脂奶和豆制品，少依赖加工肉类',
    '高蛋白不等于零主食；训练日前后仍保留全谷物或薯类',
  ],
  low_carb: [
    '先减少甜饮、甜点和精制主食，不削减蔬菜与优质蛋白',
    '训练日前后保留一小份全谷物、水果或薯类支持表现',
    '用鱼、坚果、牛油果和橄榄油补充脂肪，避免以肥肉替代主食',
  ],
  keto: [
    '按总碳水记录，主食、薯类、甜饮和多数甜水果不进入日常餐单',
    '脂肪优先来自鱼、坚果、牛油果和橄榄油，并保证低碳蔬菜',
    '训练表现持续下降、明显乏力或胃肠不适时停止限制并咨询专业人士',
  ],
};

const mealPurposes: Record<DietPattern, { training: string[]; rest: string[] }> = {
  balanced_cn: {
    training: ['启动上午供能', '提供主要训练能量', '训练前后补给', '补足蛋白并促进恢复'],
    rest: ['稳定上午精力', '完成全天主要营养', '避免晚餐前过度饥饿', '清淡收尾并促进恢复'],
  },
  high_protein: {
    training: ['完成第一份优质蛋白', '补足蛋白与训练主食', '分散蛋白并支持恢复', '完成全天蛋白目标'],
    rest: ['用蛋白提高饱腹感', '保持蛋白与蔬菜份量', '平稳衔接两顿正餐', '低负担完成蛋白目标'],
  },
  low_carb: {
    training: ['低糖开启并保持饱腹', '把主要碳水留给训练', '用少量碳水支持训练', '以蛋白和蔬菜完成恢复'],
    rest: ['减少精制碳水波动', '以蛋白蔬菜为正餐主体', '用乳品坚果控制饥饿', '低碳高纤收尾'],
  },
  keto: {
    training: ['低碳高脂稳定供能', '补足蛋白和不饱和脂肪', '控制碳水的轻量加餐', '低碳完成训练恢复'],
    rest: ['维持低碳节奏', '以蛋白和脂肪供能', '避免隐形碳水', '补足蔬菜与优质脂肪'],
  },
};

const goalConfig: Record<NutritionGoal, { label: string; strategy: string; protein: number; deficit: number; fatRatio: number }> = {
  rapid_loss: { label: '体重下降', strategy: '适度热量缺口 + 高蛋白 + 高体积蔬菜', protein: 1.8, deficit: -0.2, fatRatio: 0.27 },
  fat_loss: { label: '减脂塑形', strategy: '小幅热量缺口，优先保留肌肉和训练表现', protein: 2, deficit: -0.14, fatRatio: 0.27 },
  muscle_gain: { label: '精益增肌', strategy: '轻微热量盈余，训练日前后集中补充碳水', protein: 1.7, deficit: 0.1, fatRatio: 0.25 },
  performance: { label: '力量表现', strategy: '接近维持热量，用充足碳水支持高质量训练', protein: 1.6, deficit: 0.04, fatRatio: 0.25 },
  maintain: { label: '健康维持', strategy: '能量平衡、食物多样、规律三餐和稳定活动量', protein: 1.4, deficit: 0, fatRatio: 0.28 },
};

export function normalizeNutritionGoal(value: unknown): NutritionGoal {
  if (value === 'cut') return 'fat_loss';
  if (value === 'gain') return 'muscle_gain';
  if (value === 'strength') return 'performance';
  if (value === 'health') return 'maintain';
  return nutritionGoals.some((item) => item.key === value) ? value as NutritionGoal : 'maintain';
}

export function normalizeDietPattern(value: unknown): DietPattern {
  return dietPatterns.some((item) => item.key === value) ? value as DietPattern : 'balanced_cn';
}

const KETO_CAUTION = '生酮属于限制性饮食。孕期或哺乳期、肝肾或胰腺疾病、1 型糖尿病、进食障碍史，以及正在使用 SGLT2 类药物的人群不应自行开始；其他糖尿病用药人群也应先咨询医生或注册营养师。';

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function roundTo(value: number, step: number) {
  return Math.round(value / step) * step;
}

function formatPortion(value: number) {
  return Number(value.toFixed(2)).toString();
}

function scaleFoodPortion(food: string, proteinScale: number, carbScale: number, fatScale: number, energyScale: number) {
  const fatFood = /坚果|核桃|牛油果|花生酱|橄榄油/.test(food);
  const carbFood = /燕麦|米饭|杂粮|全麦|面包|土豆|红薯|玉米|南瓜|水果|香蕉|苹果|莓果|意面|薯类|主食/.test(food);
  const proteinFood = /鸡蛋|牛奶|奶酪|芝士|豆浆|酸奶|鸡胸|鸡腿|鸡肉|牛肉|牛排|鱼|虾|豆腐|瘦肉|三文鱼|牛腱/.test(food);
  const vegetableFood = /蔬菜|绿叶|西兰花|菌菇|菠菜|黄瓜|沙拉|小番茄/.test(food);
  const scale = fatFood
    ? fatScale
    : carbFood
      ? carbScale
      : proteinFood
        ? proteinScale
        : vegetableFood
          ? Math.max(1, energyScale)
          : energyScale;
  let scaled = food
    .replace(/三分之一碗/g, '0.33 碗')
    .replace(/四分之一个/g, '0.25 个')
    .replace(/1\s*小碗/g, '0.75 碗')
    .replace(/半碗/g, '0.5 碗')
    .replace(/半根/g, '0.5 根')
    .replace(/半个/g, '0.5 个')
    .replace(/小碗/g, '0.75 碗')
    .replace(/小份/g, '0.75 份')
    .replace(/大份/g, '1.5 份')
    .replace(/双份/g, '2 份');
  scaled = scaled.replace(/(\d+(?:\.\d+)?)\s*(g|ml|个|根|片|碗|份)/g, (_match, rawValue: string, unit: string) => {
    const value = Number(rawValue) * scale;
    if (unit === 'g') return `${Math.max(5, roundTo(value, 5))}g`;
    if (unit === 'ml') return `${Math.max(50, roundTo(value, 50))}ml`;
    const step = unit === '个' && !/牛油果/.test(food) ? 0.5 : unit === '根' || unit === '片' ? 0.5 : 0.25;
    const count = Math.max(step, roundTo(value, step));
    return `${formatPortion(count)} ${unit}`;
  });
  if (!/\d+(?:\.\d+)?\s*(?:g|ml|个|根|片|碗|份|杯)/.test(scaled)) {
    const serving = Math.max(0.5, roundTo(scale, 0.25));
    return /咖啡|茶/.test(scaled) ? `${scaled} 1 杯` : `${scaled} ${formatPortion(serving)} 份`;
  }
  return scaled;
}

export function calculateNutritionPlan(profile: Profile, isTrainingDay: boolean): NutritionPlan {
  const requestedGoal = normalizeNutritionGoal(profile.nutritionGoal || profile.goal);
  const requestedPattern = normalizeDietPattern(profile.dietPattern);
  const rawAge = Number(profile.age);
  const rawHeight = Number(profile.height);
  const rawWeight = Number(profile.weight);
  const rawFrequency = Number(profile.frequency);
  const hasInvalidMetrics = ![rawAge, rawHeight, rawWeight, rawFrequency].every(Number.isFinite)
    || rawAge < 13 || rawAge > 100
    || rawHeight < 120 || rawHeight > 230
    || rawWeight < 30 || rawWeight > 300
    || rawFrequency < 1 || rawFrequency > 6;
  const age = clamp(Number.isFinite(rawAge) ? rawAge : 30, 18, 90);
  const height = clamp(Number.isFinite(rawHeight) ? rawHeight : 170, 120, 230);
  const weight = clamp(Number.isFinite(rawWeight) ? rawWeight : 65, 30, 300);
  const frequency = clamp(Math.round(Number.isFinite(rawFrequency) ? rawFrequency : 3), 1, 6);
  const bmi = weight / ((height / 100) ** 2);
  const isMinor = !hasInvalidMetrics && rawAge < 18;
  const isUnderweight = !hasInvalidMetrics && bmi < 18.5;
  let goal = requestedGoal;
  let pattern = requestedPattern;
  let safetyLevel: NutritionPlan['safetyLevel'] = 'ok';
  let safetyTitle: string | undefined;
  let safetyMessage: string | undefined;

  if (hasInvalidMetrics) {
    goal = 'maintain';
    pattern = 'balanced_cn';
    safetyLevel = 'blocked';
    safetyTitle = '资料异常，已暂停个性化计划';
    safetyMessage = '年龄、身高、体重或每周训练次数超出可可靠估算的范围。当前仅展示保守的均衡维持示例，请先返回个人资料修正数据。';
  } else if (isMinor) {
    goal = 'maintain';
    pattern = 'balanced_cn';
    safetyLevel = 'blocked';
    safetyTitle = '未成年人仅展示基础均衡方案';
    safetyMessage = '生长发育期不应按成人公式自行减重、增肌或生酮。已停用热量缺口和限制性饮食，请由监护人陪同咨询儿科医生或注册营养师。';
  } else if (isUnderweight) {
    goal = 'maintain';
    pattern = 'balanced_cn';
    safetyLevel = 'blocked';
    safetyTitle = '当前体重偏低，已关闭减重和限制饮食';
    safetyMessage = `BMI 约 ${bmi.toFixed(1)}，当前计划已切换为均衡维持，不提供减脂、快速减重或生酮方案。建议先由医生或注册营养师评估体重偏低原因。`;
  } else if (requestedPattern === 'keto') {
    safetyLevel = 'warning';
    safetyTitle = '生酮启用前必须确认禁忌';
    safetyMessage = KETO_CAUTION;
  }

  const config = goalConfig[goal];
  const bmr = Math.round(10 * weight + 6.25 * height - 5 * age + (profile.sex === 'male' ? 5 : -161));
  const activityFactor = Math.min(1.75, 1.3 + frequency * 0.055);
  const tdee = Math.round(bmr * activityFactor);
  const baseTarget = tdee * (1 + config.deficit);
  const safeFloor = Math.max(profile.sex === 'male' ? 1500 : 1200, bmr * 1.05);
  const weeklyMeanTarget = Math.max(safeFloor, baseTarget);
  const restDays = 7 - frequency;
  const preferredTrainingBonus = Math.min(150, frequency * 25);
  const maximumFloorSafeBonus = Math.max(0, (weeklyMeanTarget - safeFloor) * restDays / frequency);
  const trainingBonus = Math.min(preferredTrainingBonus, maximumFloorSafeBonus);
  const restReduction = trainingBonus * frequency / restDays;
  const targetCalories = Math.round(isTrainingDay ? weeklyMeanTarget + trainingBonus : weeklyMeanTarget - restReduction);
  const weightAtBmi25 = 25 * ((height / 100) ** 2);
  const referenceWeight = bmi >= 30
    ? Math.min(weight, weightAtBmi25 + (weight - weightAtBmi25) * 0.25)
    : weight;
  const proteinFactor = pattern === 'high_protein'
    ? Math.min(2.2, config.protein + 0.3)
    : pattern === 'low_carb'
      ? Math.min(2.1, config.protein + 0.15)
      : pattern === 'keto'
        ? Math.min(1.8, Math.max(1.4, config.protein))
        : config.protein;
  const proteinEnergyCap = pattern === 'high_protein' ? 0.4 : 0.35;
  const protein = Math.min(220, Math.round(referenceWeight * proteinFactor), Math.floor(targetCalories * proteinEnergyCap / 4));
  let carbs: number;
  let fat: number;
  if (pattern === 'keto') {
    carbs = Math.min(40, Math.max(20, Math.round(targetCalories * 0.06 / 4)));
    fat = Math.max(40, Math.round((targetCalories - protein * 4 - carbs * 4) / 9));
  } else if (pattern === 'low_carb') {
    const carbRatio = isTrainingDay ? (goal === 'performance' ? 0.42 : 0.38) : 0.35;
    carbs = Math.max(isTrainingDay ? 100 : 90, Math.round(targetCalories * carbRatio / 4));
    fat = Math.max(35, Math.round((targetCalories - protein * 4 - carbs * 4) / 9));
  } else if (pattern === 'high_protein') {
    const fatRatio = Math.max(0.22, config.fatRatio - 0.02);
    fat = Math.round(targetCalories * fatRatio / 9);
    carbs = Math.max(80, Math.round((targetCalories - protein * 4 - fat * 9) / 4));
  } else {
    fat = Math.round(targetCalories * config.fatRatio / 9);
    carbs = Math.max(80, Math.round((targetCalories - protein * 4 - fat * 9) / 4));
  }
  const distribution = mealDistributions[pattern];
  const timings = ['07:00–09:00', '11:30–13:30', '15:00–17:00', '18:00–20:00'];
  const mealNames = ['早餐', '午餐', '加餐', '晚餐'];
  const dayType: keyof DayMenus = isTrainingDay ? 'training' : 'rest';
  const purposes = mealPurposes[pattern][dayType];
  const menuSet: DayMenus = pattern === 'balanced_cn' ? balancedMenus[goal] : patternMenus[pattern];
  const proteinScale = clamp(protein / 130, 0.65, 1.7);
  const carbScale = clamp(carbs / 260, 0.25, 1.8);
  const fatScale = clamp(fat / 75, 0.65, 2.2);
  const energyScale = clamp(targetCalories / 2200, 0.75, 1.4);
  const selectedMenu = menuSet[dayType].map((meal) => meal.map((food) => scaleFoodPortion(food, proteinScale, carbScale, fatScale, energyScale)));
  const meals = selectedMenu.map((foods, index) => ({
    name: mealNames[index], timing: timings[index], calories: Math.round(targetCalories * distribution[index]), foods, purpose: purposes[index],
  }));
  const principles = [...patternPrinciples[pattern]];
  if (bmi >= 30) {
    principles.push(`蛋白质与饮水按约 ${referenceWeight.toFixed(1)}kg 参考体重估算，避免直接按当前体重线性放大。`);
    if (safetyLevel === 'ok') {
      safetyLevel = 'warning';
      safetyTitle = '已启用高 BMI 保护计算';
      safetyMessage = `BMI 约 ${bmi.toFixed(1)}；蛋白质与饮水按调整参考体重估算，热量仍依据当前身体数据和活动量计算。`;
    }
  }
  const safetyAdjusted = goal !== requestedGoal || pattern !== requestedPattern;
  return {
    requestedGoal, requestedPattern, goal, pattern, goalLabel: `${config.label}${safetyAdjusted ? '（安全调整）' : ''}`,
    strategy: `${config.strategy}；${patternStrategies[pattern]}`, bmr, tdee, targetCalories,
    calorieDelta: targetCalories - tdee, protein, carbs, fat,
    fiber: pattern === 'balanced_cn' ? 30 : pattern === 'high_protein' ? 28 : pattern === 'low_carb' ? 26 : 25,
    waterMl: clamp(roundTo(referenceWeight * 32 + (isTrainingDay ? 400 : 0), 50), 1500, 4000),
    meals, principles, bmi: Number(bmi.toFixed(1)), referenceWeight: Number(referenceWeight.toFixed(1)),
    safetyLevel, safetyTitle, safetyMessage,
    caution: pattern === 'keto' ? KETO_CAUTION : undefined,
  };
}
