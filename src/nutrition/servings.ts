import { getFood } from './catalog';
import type { Food } from './types';

export type FoodServing = { label: string; grams: number };

export const SERVING_ESTIMATE_NOTE = '碗、杯、个和份均为参考估量，不是推荐摄入量；餐具、大小和含水量不同，请按食物所示生熟状态与可食部分核对，能称重时优先称重。';

// Household weights from the food's own USDA record where available; otherwise
// explicit developer reference portions. See docs/nutrition-food-sources-phase3.md.
// A Chinese bowl is NOT a USDA cup. Bowl values below are convenience estimates.
const portions: Record<string, readonly FoodServing[]> = {
  'oats-dry': [{ label: '约1参考份（干40g）', grams: 40 }, { label: '约1较大份（干60g）', grams: 60 }],
  'rice-raw': [{ label: '约1参考份（生米45g）', grams: 45 }, { label: '约1较大份（生米75g）', grams: 75 }],
  'brown-rice-raw': [{ label: '约1参考份（生米45g）', grams: 45 }, { label: '约1较大份（生米75g）', grams: 75 }],
  'rice-cooked': [{ label: '约1小碗（熟饭150g）', grams: 150 }, { label: '约1普通碗（熟饭200g）', grams: 200 }],
  'brown-rice-cooked': [{ label: '约1小碗（熟饭150g）', grams: 150 }, { label: '约1普通碗（熟饭200g）', grams: 200 }],
  'pasta-cooked': [{ label: '约1小份（熟面150g）', grams: 150 }, { label: '约1份（熟面200g）', grams: 200 }],
  'egg-noodles-cooked': [{ label: '约1小碗（熟面150g）', grams: 150 }, { label: '约1普通碗（熟面200g）', grams: 200 }],
  'sweet-potato-raw': [{ label: '约1中等个（生、可食130g）', grams: 130 }, { label: '约1大份（生、可食200g）', grams: 200 }],
  'sweet-potato-boiled': [{ label: '约1中等个（熟、去皮151g）', grams: 151 }, { label: '约1小份（熟、去皮100g）', grams: 100 }],
  'potato-boiled': [{ label: '约1中等个（熟、去皮167g）', grams: 167 }, { label: '约1小个（熟、去皮125g）', grams: 125 }],
  'corn-boiled': [{ label: '约1中等根（仅熟玉米粒103g）', grams: 103 }, { label: '约1小碗（仅熟玉米粒150g）', grams: 150 }],
  'bread-whole-wheat': [{ label: '约1片（32g）', grams: 32 }, { label: '约2片（64g）', grams: 64 }],
  'egg-raw': [{ label: '约1大个（去壳生蛋液50.3g）', grams: 50.3 }, { label: '约2大个（去壳生蛋液100.6g）', grams: 100.6 }],
  'egg-boiled': [{ label: '约1大个（熟、去壳50g）', grams: 50 }, { label: '约2大个（熟、去壳100g）', grams: 100 }],
  'chicken-raw': [{ label: '约1小份（去骨皮生肉100g）', grams: 100 }, { label: '约1份（去骨皮生肉150g）', grams: 150 }],
  'chicken-stewed': [{ label: '约1小份（去骨皮熟肉100g）', grams: 100 }, { label: '约1份（去骨皮熟肉150g）', grams: 150 }],
  'pork-tenderloin-roasted': [{ label: '约1小份（熟瘦肉100g）', grams: 100 }, { label: '约1份（熟瘦肉150g）', grams: 150 }],
  'beef-sirloin-grilled': [{ label: '约1小份（熟瘦肉100g）', grams: 100 }, { label: '约1份（熟瘦肉150g）', grams: 150 }],
  'tilapia-raw': [{ label: '约1参考鱼片（生、可食116g）', grams: 116 }, { label: '约1份（生、可食150g）', grams: 150 }],
  'shrimp-cooked': [{ label: '约1小份（熟虾仁85g）', grams: 85 }, { label: '约1份（熟虾仁150g）', grams: 150 }],
  'salmon-cooked': [{ label: '约1小份（熟、可食85g）', grams: 85 }, { label: '约1份（熟、可食150g）', grams: 150 }],
  'tofu-firm': [{ label: '约半参考量杯（烹调前126g）', grams: 126 }, { label: '约1份（烹调前200g）', grams: 200 }],
  'tofu-soft': [{ label: '约1小份（烹调前100g）', grams: 100 }, { label: '约1份（烹调前200g）', grams: 200 }],
  'chickpeas-canned': [{ label: '约1参考份（冲洗沥水130g）', grams: 130 }, { label: '约1小碗（冲洗沥水150g）', grams: 150 }],
  'milk-2pct': [{ label: '约1参考量杯（244g）', grams: 244 }, { label: '约半参考量杯（122g）', grams: 122 }],
  'milk-whole': [{ label: '约1参考量杯（244g）', grams: 244 }, { label: '约半参考量杯（122g）', grams: 122 }],
  'yogurt-greek': [{ label: '约1参考盒（170g，核对净重）', grams: 170 }, { label: '约1小份（100g）', grams: 100 }],
  'yogurt-plain-whole': [{ label: '约1小份（100g）', grams: 100 }, { label: '约1参考盒（170g，核对净重）', grams: 170 }],
  'soy-milk': [{ label: '约1参考杯（250g，非毫升）', grams: 250 }, { label: '约半参考杯（125g，非毫升）', grams: 125 }],
  'broccoli-raw': [{ label: '约1小份（可食生重100g）', grams: 100 }, { label: '约1份（可食生重200g）', grams: 200 }],
  'bok-choy-raw': [{ label: '约1小份（可食生重100g）', grams: 100 }, { label: '约1份（可食生重200g）', grams: 200 }],
  'tomato-raw': [{ label: '约1小份（可食生重100g）', grams: 100 }, { label: '约1份（可食生重150g）', grams: 150 }],
  'cucumber-raw': [{ label: '约半参考量杯切片（生52g）', grams: 52 }, { label: '约1份（可食生重150g）', grams: 150 }],
  'mushroom-raw': [{ label: '约1小份（可食生重100g）', grams: 100 }, { label: '约1份（可食生重150g）', grams: 150 }],
  'spinach-boiled': [{ label: '约1参考量杯（熟、沥水180g）', grams: 180 }, { label: '约1小份（熟、沥水100g）', grams: 100 }],
  'carrot-boiled': [{ label: '约1参考根（熟、可食46g）', grams: 46 }, { label: '约1份（熟、可食100g）', grams: 100 }],
  'banana-raw': [{ label: '约1参考根（去皮115g）', grams: 115 }, { label: '约半参考根（去皮57.5g）', grams: 57.5 }],
  'apple-fuji': [{ label: '约1参考份（去核140g）', grams: 140 }, { label: '约1大份（去核200g）', grams: 200 }],
  'orange-raw': [{ label: '约1中等个（去皮131g）', grams: 131 }, { label: '约1小个（去皮96g）', grams: 96 }],
  'grapes-raw': [{ label: '约10颗（去梗49g）', grams: 49 }, { label: '约1参考量杯（去梗151g）', grams: 151 }],
  'watermelon-raw': [{ label: '约1小碗切块（去皮150g）', grams: 150 }, { label: '约1参考块（去皮286g）', grams: 286 }],
  'pear-raw': [{ label: '约1中等个（可食178g）', grams: 178 }, { label: '约半中等个（可食89g）', grams: 89 }],
  'strawberry-raw': [{ label: '约5大颗（去蒂90g）', grams: 90 }, { label: '约1小碗（去蒂150g）', grams: 150 }],
  'kiwi-raw': [{ label: '约1参考个（去皮69g）', grams: 69 }, { label: '约2参考个（去皮138g）', grams: 138 }],
  'almonds-raw': [{ label: '约1小份（去壳15g）', grams: 15 }, { label: '约1参考份（去壳30g）', grams: 30 }],
  'canola-oil': [{ label: '约1茶匙（4.5g）', grams: 4.5 }, { label: '约1汤匙（14g）', grams: 14 }],
  'olive-oil': [{ label: '约1计量份（5g）', grams: 5 }, { label: '约2计量份（10g）', grams: 10 }],
  'sesame-oil': [{ label: '约1计量份（5g）', grams: 5 }, { label: '约2计量份（10g）', grams: 10 }],
  'sesame-whole-dry': [{ label: '约1计量份（干3g）', grams: 3 }, { label: '约1较大计量份（干10g）', grams: 10 }],
  'peanuts-raw': [{ label: '约1小份（去壳生15g）', grams: 15 }, { label: '约2小份（去壳生30g）', grams: 30 }],
  'peanuts-dry-roasted': [{ label: '约1小份（去壳熟15g）', grams: 15 }, { label: '约2小份（去壳熟30g）', grams: 30 }],
  'cashews-raw': [{ label: '约1小份（去壳15g）', grams: 15 }, { label: '约2小份（去壳30g）', grams: 30 }],
  'walnuts': [{ label: '约1小份（去壳15g）', grams: 15 }, { label: '约2小份（去壳30g）', grams: 30 }],
  'millet-raw': [{ label: '约1计量份（干45g）', grams: 45 }, { label: '约1较大计量份（干75g）', grams: 75 }],
  'buckwheat-raw': [{ label: '约1计量份（干45g）', grams: 45 }, { label: '约1较大计量份（干75g）', grams: 75 }],
  'rice-noodles-dry': [{ label: '约1计量份（干50g）', grams: 50 }, { label: '约1较大计量份（干75g）', grams: 75 }],
  'glass-noodles-dry': [{ label: '约1计量份（干25g）', grams: 25 }, { label: '约2计量份（干50g）', grams: 50 }],
  'shiitake-dry': [{ label: '约1计量份（泡发前干5g）', grams: 5 }, { label: '约2计量份（泡发前干10g）', grams: 10 }],
  'garlic-raw': [{ label: '约1计量份（去皮生3g）', grams: 3 }, { label: '约2计量份（去皮生6g）', grams: 6 }],
  'ginger-raw': [{ label: '约1计量份（生2g）', grams: 2 }, { label: '约1较大计量份（生5g）', grams: 5 }],
  'scallion-raw': [{ label: '约1计量份（生5g）', grams: 5 }, { label: '约2计量份（生10g）', grams: 10 }],
  'sugar-white': [{ label: '约1平茶匙（4.2g）', grams: 4.2 }, { label: '约2平茶匙（8.4g）', grams: 8.4 }],
  'salt-table': [{ label: '约1小撮（0.4g，不统计钠）', grams: 0.4 }, { label: '约1计量份（1g，不统计钠）', grams: 1 }],
  'soy-sauce-shoyu': [{ label: '约1茶匙（5.3g）', grams: 5.3 }, { label: '约1汤匙（16g）', grams: 16 }],
  'vinegar-distilled': [{ label: '约1茶匙（5g）', grams: 5 }, { label: '约1汤匙（14.9g）', grams: 14.9 }],
  'honey': [{ label: '约1汤匙（21g）', grams: 21 }, { label: '约半汤匙（10.5g）', grams: 10.5 }],
};

/** Returns fresh choices so an editor cannot mutate the shared portion reference. */
export function getFoodServings(input: string | Food): FoodServing[] {
  const food = typeof input === 'string' ? getFood(input) : input;
  if (!food) return [];
  if (food.source.kind === 'user_label') {
    const serving = food.serving;
    return serving && Number.isFinite(serving.grams) && serving.grams > 0 && serving.grams <= 2000
      ? [{ label: serving.label, grams: serving.grams }, { label: '半份（' + serving.label + '）', grams: serving.grams / 2 }]
      : [{ label: '100 g（按标签状态）', grams: 100 }];
  }
  const foodId = food.id;
  if (!getFood(foodId)) return [];
  return (portions[foodId] ?? [{ label: '约1计量份（按所示状态100g）', grams: 100 }, { label: '约半计量份（按所示状态50g）', grams: 50 }]).map(item => ({ ...item }));
}
