import type { Allergen, Food, Nutrients, Recipe } from './types';

/** Local snapshot; changing composition or recipe portions requires a new version. */
export const FOOD_DATA_VERSION = 'usda-foundation-2026-04_sr-legacy-2018-04_foods-v3_recipes-v1';

type Release = 'foundation' | 'sr';
type NutrientRow = [calories: number, protein: number, carbs: number, fat: number, fiber: number];

function food(
  id: string, name: string, aliases: string[], state: string, values: NutrientRow,
  allergens: Allergen[], vegetarian: boolean, fdcId: number, description: string,
  release: Release, ndbNumber?: string,
): Food {
  const [calories, protein, carbs, fat, fiber] = values;
  const per100g: Nutrients = { calories, protein, carbs, fat, fiber };
  return {
    id, name, aliases, state, per100g, allergens, vegetarian,
    source: {
      title: `USDA FoodData Central — ${description}`,
      url: `https://fdc.nal.usda.gov/food-details/${fdcId}/nutrients`,
      foodCode: `FDC ${fdcId}${ndbNumber ? ` / NDB ${ndbNumber}` : ''}`,
      version: release === 'foundation' ? 'Foundation Foods 2026-04-30 下载快照' : 'SR Legacy 2018-04（FDC 发布 2019-04-01）',
      license: 'CC0-1.0',
    },
  };
}

/** All values are per 100 g edible portion in the stated condition, never per serving.
 * Sources, nutrient IDs, fiber methods and archive checksums: docs/nutrition-food-sources.md
 * and docs/nutrition-food-sources-phase3.md. Household portions are separate estimates.
 * Allergen annotations are developer-reviewed ingredient flags, not USDA certification.
 */
export const FOODS: Food[] = [
  food('oats-dry', '原味燕麦片（干）', ['燕麦', '麦片'], '全谷压片燕麦，烹煮前干重', [379, 13.5, 68.7, 5.89, 10.4], [], true, 2346396, 'Oats, whole grain, rolled, old fashioned', 'foundation'),
  food('rice-raw', '长粒白米（生）', ['大米', '生米'], '未强化长粒白米，煮前干重；不可按熟饭重量登记', [370, 7.04, 80.3, 1.03, 0.149], [], true, 2512381, 'Rice, white, long grain, unenriched, raw', 'foundation'),
  food('brown-rice-raw', '长粒糙米（生）', ['糙米'], '未强化长粒糙米，煮前干重', [368, 7.25, 76.7, 3.31, 3.02], [], true, 2512380, 'Rice, brown, long grain, unenriched, raw', 'foundation'),
  food('rice-cooked', '长粒白米饭（熟）', ['米饭', '白饭'], '强化长粒米煮熟后的可食重量，无额外油；不是生米', [130, 2.69, 28.2, 0.28, 0.4], [], true, 168878, 'Rice, white, long-grain, regular, enriched, cooked', 'sr', '20045'),
  food('pasta-cooked', '全麦意面（熟）', ['全麦面', '意面'], '全麦意面煮熟沥水后称重，无额外油', [149, 5.99, 30.1, 1.71, 3.9], ['wheat'], true, 168910, "Pasta, whole-wheat, cooked (Includes foods for USDA's Food Distribution Program)", 'sr', '20125'),
  food('sweet-potato-raw', '红薯（生）', ['地瓜', '番薯'], '未烹调可食部分，去除不食用部分后称重', [86, 1.57, 20.1, 0.05, 3], [], true, 168482, "Sweet potato, raw, unprepared (Includes foods for USDA's Food Distribution Program)", 'sr', '11507'),
  food('egg-raw', '全鸡蛋（生、去壳）', ['鸡蛋', '蛋'], 'A级大鸡蛋全蛋液，去壳后、烹调前称重', [148, 12.4, 0.96, 9.96, 0], ['egg'], true, 748967, 'Eggs, Grade A, Large, egg whole', 'foundation'),
  food('chicken-raw', '鸡胸肉（生、去皮）', ['鸡胸', '鸡肉'], '无骨无皮、不注水鸡胸肉，烹调前可食生重', [120, 22.5, 0, 2.62, 0], [], false, 171077, 'Chicken, broiler or fryers, breast, skinless, boneless, meat only, raw', 'sr', '05062'),
  food('tilapia-raw', '罗非鱼（生）', ['罗非鱼', '鱼肉'], '生罗非鱼可食鱼肉，去骨后、烹调前称重', [96, 20.1, 0, 1.7, 0], ['fish'], false, 175176, 'Fish, tilapia, raw', 'sr', '15261'),
  food('tofu-firm', '硬豆腐（石膏凝固）', ['豆腐', '硬豆腐'], '未烹调、硫酸钙凝固硬豆腐；非嫩豆腐或内酯豆腐', [144, 17.3, 2.78, 8.72, 2.3], ['soy'], true, 172475, 'Tofu, raw, firm, prepared with calcium sulfate', 'sr', '16426'),
  food('chickpeas-canned', '鹰嘴豆（罐装、沥水）', ['鹰嘴豆'], '加盐罐装鹰嘴豆，冲洗沥水后的熟豆重量', [133, 7.02, 20.3, 3.1, 5.92], [], true, 2644288, 'Chickpeas (garbanzo beans, bengal gram), canned, sodium added, drained and rinsed', 'foundation'),
  food('milk-2pct', '低脂牛奶（2%）', ['牛奶', '低脂奶'], '含维生素A和D的2%脂肪液态奶，按克称量', [50, 3.3, 4.8, 1.98, 0], ['milk'], true, 171267, 'Milk, reduced fat, fluid, 2% milkfat, with added vitamin A and vitamin D', 'sr', '01079'),
  food('yogurt-greek', '原味脱脂希腊酸奶', ['酸奶', '希腊酸奶'], '原味脱脂希腊酸奶；不等同普通或加糖酸奶', [59, 10.2, 3.6, 0.39, 0], ['milk'], true, 170894, "Yogurt, Greek, plain, nonfat (Includes foods for USDA's Food Distribution Program)", 'sr', '01256'),
  food('soy-milk', '无糖原味豆奶', ['豆奶', '无糖豆浆'], '常温包装无糖原味豆奶，按克称量；自制豆浆浓度不同', [38.5, 3.55, 1.29, 2.12, 0], ['soy'], true, 1999630, 'Soy milk, unsweetened, plain, shelf stable', 'foundation'),
  food('broccoli-raw', '西兰花（生）', ['西兰花', '绿花菜'], '生西兰花，可食部分烹调前称重', [31, 2.57, 6.27, 0.34, 2.4], [], true, 747447, 'Broccoli, raw', 'foundation'),
  food('bok-choy-raw', '小白菜（生）', ['青菜', '小白菜', '上海青'], '小白菜可食部分，烹调前生重；品种可能不同', [17, 1.02, 3.51, 0.234, 1.26], [], true, 2685572, 'Cabbage, bok choy, raw', 'foundation'),
  food('tomato-raw', '罗马番茄（生）', ['番茄', '西红柿'], '罗马番茄可食部分生重；普通番茄存在品种差异', [19, 0.696, 3.84, 0.425, 0.971], [], true, 1999634, 'Tomato, roma', 'foundation'),
  food('cucumber-raw', '黄瓜（生、带皮）', ['黄瓜'], '带皮生黄瓜，可食部分重量', [15, 0.65, 3.63, 0.11, 0.5], [], true, 168409, 'Cucumber, with peel, raw', 'sr', '11205'),
  food('mushroom-raw', '白蘑菇（生）', ['蘑菇', '白蘑菇'], '白色双孢蘑菇，可食部分生重', [24.9, 2.89, 4.08, 0.371, 1.72], [], true, 1999629, 'Mushrooms, white button', 'foundation'),
  food('banana-raw', '香蕉（去皮）', ['香蕉'], '成熟或稍成熟香蕉，去皮后可食重量', [97, 0.74, 23, 0.29, 1.7], [], true, 1105314, 'Bananas, ripe and slightly ripe, raw', 'foundation'),
  food('apple-fuji', '富士苹果（带皮）', ['苹果', '富士'], '带皮富士苹果，去核后可食生重', [58.2, 0.148, 15.7, 0.162, 2.08], [], true, 1750340, 'Apples, fuji, with skin, raw', 'foundation'),
  food('almonds-raw', '扁桃仁（生）', ['巴旦木', '扁桃仁'], '生扁桃仁，无壳、无调味；不是苦杏仁', [584, 21.5, 20, 51.1, 10.8], ['tree_nut'], true, 2346393, 'Nuts, almonds, whole, raw', 'foundation'),
  food('canola-oil', '芥花籽油', ['食用油', '菜籽油', '芥花油'], 'Canola油，按实际加入的克数计入；其他油配方可能不同', [884, 0, 0, 100, 0], [], true, 172336, 'Oil, canola', 'sr', '04582'),
  // Additional generic cooked foods support weighed leftovers and ordinary food logging.
  // Keep the exact preparation/variety visible; these are not measured Chinese dishes.
  food('brown-rice-cooked', '长粒糙米饭（熟）', ['糙米饭', '熟糙米'], '长粒糙米煮熟后的可食重量，无额外油；含水量不同会影响每100g营养', [123, 2.74, 25.6, 0.97, 1.6], [], true, 169704, "Rice, brown, long-grain, cooked (Includes foods for USDA's Food Distribution Program)", 'sr', '20037'),
  food('egg-noodles-cooked', '鸡蛋面（熟、参考）', ['面条', '鸡蛋面', '熟面'], '未强化鸡蛋面，加盐煮熟沥水后的重量；含小麦和蛋，不等同所有中式面条，汤和浇头另记', [138, 4.54, 25.2, 2.07, 1.2], ['wheat', 'egg'], true, 169762, 'Noodles, egg, cooked, unenriched, with added salt', 'sr', '20510'),
  food('potato-boiled', '土豆（去皮、水煮熟）', ['土豆', '马铃薯', '熟土豆'], '去皮后不加盐水煮，熟后沥水称可食重量；无油，不等同炸薯条或加奶土豆泥', [86, 1.71, 20, 0.1, 1.8], [], true, 170440, 'Potatoes, boiled, cooked without skin, flesh, without salt', 'sr', '11367'),
  food('sweet-potato-boiled', '红薯（去皮、水煮熟）', ['熟红薯', '水煮红薯', '熟地瓜'], '去皮水煮熟后的可食重量；不是生重，烤红薯或蒸红薯含水量可能不同', [76, 1.37, 17.7, 0.14, 2.5], [], true, 168484, 'Sweet potato, cooked, boiled, without skin', 'sr', '11510'),
  food('corn-boiled', '甜玉米粒（水煮熟）', ['玉米', '甜玉米', '熟玉米'], '黄色甜玉米不加盐水煮后沥水，仅称可食玉米粒，不含玉米芯；不等同糯玉米', [96, 3.41, 21, 1.5, 2.4], [], true, 169999, 'Corn, sweet, yellow, cooked, boiled, drained, without salt', 'sr', '11168'),
  food('bread-whole-wheat', '全麦面包（通用参考）', ['面包', '全麦面包', '吐司'], '市售全麦面包通用参考，食用状态；品牌配方差异大，可能另含奶、蛋或大豆，必须核对包装', [252, 12.4, 42.7, 3.5, 6], ['wheat'], true, 172688, 'Bread, whole-wheat, commercially prepared', 'sr', '18075'),
  food('egg-boiled', '水煮全蛋（熟、去壳）', ['水煮蛋', '水煮鸡蛋', '熟鸡蛋', '煮鸡蛋', '白煮蛋'], '鸡蛋煮至全熟，去壳后称重，无额外油；不可用带壳重量登记', [155, 12.6, 1.12, 10.6, 0], ['egg'], true, 173424, 'Egg, whole, cooked, hard-boiled', 'sr', '01129'),
  food('chicken-stewed', '鸡胸肉（熟、炖煮去皮）', ['熟鸡胸', '水煮鸡胸', '熟鸡肉'], '炖煮熟鸡胸肉，去骨去皮后的熟肉重量；不含汤、油或酱汁，不等同生鸡胸', [151, 29, 0, 3.03, 0], [], false, 171478, 'Chicken, broilers or fryers, breast, meat only, cooked, stewed', 'sr', '05065'),
  food('pork-tenderloin-roasted', '猪里脊瘦肉（熟、烤）', ['猪肉', '熟猪肉', '猪里脊', '瘦猪肉'], '烤熟猪里脊，仅分离出的瘦肉熟重；不是五花肉，不含另加油、糖或酱汁，其他烹法仅可作参考', [143, 26.2, 0, 3.51, 0], [], false, 168250, 'Pork, fresh, loin, tenderloin, separable lean only, cooked, roasted', 'sr', '10061'),
  food('beef-sirloin-grilled', '西冷瘦牛肉（熟、烤）', ['牛肉', '熟牛肉', '牛排', '瘦牛肉'], '去骨西冷菲力烤熟，去除可分离脂肪后的瘦肉熟重；部位与肥瘦不同不可视为等值，不含酱汁', [171, 30.6, 0, 5.37, 0], [], false, 174693, 'Beef, loin, top sirloin filet, boneless, separable lean only, trimmed to 0" fat, all grades, cooked, grilled', 'sr', '23256'),
  food('shrimp-cooked', '熟虾仁（湿热加工参考）', ['虾', '虾仁', '熟虾', '水煮虾'], '混合品种湿热加工熟虾仁，仅可食部分熟重；源样品可能含保水添加剂，不含壳、头或另加酱汁', [119, 22.8, 1.52, 1.7, 0], ['shellfish'], false, 171971, 'Crustaceans, shrimp, mixed species, cooked, moist heat (may contain additives to retain moisture)', 'sr', '15151'),
  food('salmon-cooked', '大西洋三文鱼（熟、烤）', ['三文鱼', '熟三文鱼', '鲑鱼'], '养殖大西洋鲑鱼干热烹熟后的可食鱼肉重量；无另加油或酱汁，不等同生鱼片', [206, 22.1, 0, 12.4, 0], ['fish'], false, 175168, 'Fish, salmon, Atlantic, farmed, cooked, dry heat', 'sr', '15237'),
  food('tofu-soft', '软豆腐（石膏卤水凝固）', ['软豆腐', '嫩豆腐'], '硫酸钙和氯化镁凝固软豆腐，烹调前称重；不是内酯豆腐、豆腐脑或调味豆制品', [61, 7.17, 1.18, 3.69, 0.2], ['soy'], true, 172449, 'Tofu, soft, prepared with calcium sulfate and magnesium chloride (nigari)', 'sr', '16127'),
  food('milk-whole', '全脂牛奶（3.25%参考）', ['全脂奶', '全脂牛奶', '纯牛奶'], '3.25%脂肪液态全脂奶，不额外强化维生素A和D，按克计；品牌以包装标签为准', [61, 3.15, 4.78, 3.27, 0], ['milk'], true, 172217, 'Milk, whole, 3.25% milkfat, without added vitamin A and vitamin D', 'sr', '01211'),
  food('yogurt-plain-whole', '原味全脂酸奶（通用参考）', ['原味酸奶', '全脂酸奶', '普通酸奶'], '普通原味全脂酸奶，食用状态；不是加糖、风味或希腊酸奶，国内品牌应核对标签', [61, 3.47, 4.66, 3.25, 0], ['milk'], true, 171284, 'Yogurt, plain, whole milk', 'sr', '01116'),
  food('spinach-boiled', '菠菜（水煮熟、沥水）', ['菠菜', '熟菠菜'], '菠菜不加盐水煮后沥水的可食熟重；不含另加油、芝麻或酱料', [23, 2.97, 3.75, 0.26, 2.4], [], true, 168463, 'Spinach, cooked, boiled, drained, without salt', 'sr', '11458'),
  food('carrot-boiled', '胡萝卜（水煮熟）', ['胡萝卜', '熟胡萝卜'], '胡萝卜不加盐水煮后沥水的可食熟重；不含另加油、糖或酱料', [35, 0.76, 8.22, 0.18, 3], [], true, 170394, 'Carrots, cooked, boiled, drained, without salt', 'sr', '11125'),
  food('orange-raw', '橙子（去皮）', ['橙子', '橙'], '新鲜橙子，去皮及不食用部分后称可食重量；不是橙汁', [47, 0.94, 11.8, 0.12, 2.4], [], true, 169097, 'Oranges, raw, all commercial varieties', 'sr', '09200'),
  food('grapes-raw', '红绿葡萄（鲜）', ['葡萄', '青提', '红提'], '欧洲型红或绿葡萄的新鲜可食重量，去梗；品种差异较大，不是葡萄干', [69, 0.72, 18.1, 0.16, 0.9], [], true, 174683, 'Grapes, red or green (European type, such as Thompson seedless), raw', 'sr', '09132'),
  food('watermelon-raw', '西瓜（去皮）', ['西瓜', '西瓜瓤'], '新鲜西瓜瓤，去除瓜皮等不食用部分后称重；不是整瓜重量', [30, 0.61, 7.55, 0.15, 0.4], [], true, 167765, 'Watermelon, raw', 'sr', '09326'),
  food('pear-raw', '梨（鲜、通用参考）', ['梨', '鲜梨'], '新鲜梨可食部分，去核称重；美国通用品种参考，不等同各类亚洲梨', [57, 0.36, 15.2, 0.14, 3.1], [], true, 169118, 'Pears, raw', 'sr', '09252'),
  food('strawberry-raw', '草莓（鲜）', ['草莓'], '新鲜草莓去蒂后的可食重量，无糖或其他配料', [32, 0.67, 7.68, 0.3, 2], [], true, 167762, 'Strawberries, raw', 'sr', '09316'),
  food('kiwi-raw', '绿心猕猴桃（去皮）', ['猕猴桃', '奇异果', '绿心猕猴桃'], '绿心猕猴桃新鲜可食部分，按去皮重量计；不等同黄心品种', [61, 1.14, 14.7, 0.52, 3], [], true, 168153, 'Kiwifruit, green, raw', 'sr', '09148'),
  food('sugar-white', '白砂糖', ['糖', '白糖', '砂糖'], '颗粒白砂糖，按实际食用或加入的克数计；菜肴多人分食时按吃下比例分摊', [387, 0, 100, 0, 0], [], true, 169655, 'Sugars, granulated', 'sr', '19335'),
  food('salt-table', '食盐（本模型不统计钠）', ['盐', '食盐'], '食盐按克登记；热量为0不表示可不限量食用，本版本尚不统计钠摄入', [0, 0, 0, 0, 0], [], true, 173468, 'Salt, table', 'sr', '02047'),
  food('soy-sauce-shoyu', '酱油（大豆小麦酿造参考）', ['酱油', '生抽'], 'Shoyu大豆小麦酿造酱油通用参考，不等同所有生抽、老抽或低钠产品；含大豆和小麦，尚不统计钠', [53, 8.14, 4.93, 0.57, 0.8], ['soy', 'wheat'], true, 174277, 'Soy sauce made from soy and wheat (shoyu)', 'sr', '16123'),
  food('vinegar-distilled', '蒸馏白醋（参考）', ['白醋', '蒸馏醋'], '蒸馏醋通用参考，按克登记；不是含糖寿司醋或中式陈醋，酸度和配方可能不同', [18, 0, 0.04, 0, 0], [], true, 172237, 'Vinegar, distilled', 'sr', '02053'),
  food('honey', '蜂蜜', ['蜂蜜'], '蜂蜜食用状态，按实际加入的克数计，不等同无糖甜味剂', [304, 0.3, 82.4, 0, 0.2], [], true, 169640, 'Honey', 'sr', '19296'),
  // Source-checked expansion. Generic USDA samples, not measured Chinese brands/dishes.
  food('millet-raw', '小米（干、参考）', ['小米', '干小米'], 'Millet通用谷粒，煮前干重；不等同含水小米粥，品种存在差异', [378, 11, 72.8, 4.22, 8.5], [], true, 169702, 'Millet, raw', 'sr', '20031'),
  food('millet-cooked', '小米饭（熟、参考）', ['小米饭', '熟小米'], '煮熟谷粒的可食熟重，不是稀粥；含水量不同不可等值', [119, 3.51, 23.7, 1, 1.3], [], true, 168871, 'Millet, cooked', 'sr', '20032'),
  food('rice-noodles-dry', '米粉（干、参考）', ['米粉', '干米粉', '米线'], '米制面条干重，煮前称量；品牌含蛋或其他原料时以标签为准', [364, 5.95, 80.2, 0.56, 1.6], [], true, 169742, 'Rice noodles, dry', 'sr', '20133'),
  food('rice-noodles-cooked', '米粉（熟、沥水参考）', ['熟米粉', '熟米线'], '米制面条煮熟沥水后的重量，不含汤、浇头、油或酱汁', [108, 1.79, 24, 0.2, 1], [], true, 168914, 'Rice noodles, cooked', 'sr', '20134'),
  food('buckwheat-raw', '荞麦粒（干）', ['荞麦', '荞麦粒'], '荞麦谷粒煮前干重；不是荞麦面或熟饭', [343, 13.2, 71.5, 3.4, 10], [], true, 170286, 'Buckwheat', 'sr', '20008'),
  food('barley-cooked', '珍珠大麦（熟）', ['大麦', '大麦饭'], '珍珠大麦煮熟后的可食重量，不是薏米，无额外油', [123, 2.26, 28.2, 0.44, 3.8], [], true, 170285, 'Barley, pearled, cooked', 'sr', '20006'),
  food('glass-noodles-dry', '绿豆粉丝（干、参考）', ['粉丝', '绿豆粉丝'], '脱水绿豆粉丝干重，不是泡发后重量；其他淀粉粉丝以包装为准', [351, 0.16, 86.1, 0.06, 0.5], [], true, 174258, 'Noodles, chinese, cellophane or long rice (mung beans), dehydrated', 'sr', '16082'),
  food('mung-beans-raw', '绿豆（干）', ['绿豆', '干绿豆'], '成熟绿豆煮前干重，不含水、糖；不是熟绿豆汤', [347, 23.9, 62.6, 1.15, 16.3], [], true, 174256, 'Mung beans, mature seeds, raw', 'sr', '16080'),
  food('mung-beans-cooked', '绿豆（水煮熟、沥水）', ['熟绿豆'], '充分煮熟、不加盐的绿豆，按沥水豆粒称重，不含汤和糖', [105, 7.02, 19.2, 0.38, 7.6], [], true, 174257, 'Mung beans, mature seeds, cooked, boiled, without salt', 'sr', '16081'),
  food('adzuki-beans-raw', '赤小豆（干）', ['红豆', '赤小豆', '干红豆'], 'Adzuki成熟干豆，煮前干重，不是红豆沙', [329, 19.9, 62.9, 0.53, 12.7], [], true, 173727, 'Beans, adzuki, mature seeds, raw', 'sr', '16001'),
  food('adzuki-beans-cooked', '赤小豆（水煮熟）', ['熟红豆', '熟赤小豆'], '充分煮熟、不加盐赤小豆，沥水后豆粒熟重，不含糖或汤', [128, 7.52, 24.8, 0.1, 7.3], [], true, 173728, 'Beans, adzuki, mature seeds, cooked, boiled, without salt', 'sr', '16002'),
  food('lentils-cooked', '兵豆（水煮熟）', ['兵豆', '小扁豆', '熟兵豆'], 'Lentils成熟豆煮熟、不加盐，不是中式扁豆荚；熟豆重量', [116, 9.02, 20.1, 0.38, 7.9], [], true, 172421, 'Lentils, mature seeds, cooked, boiled, without salt', 'sr', '16070'),
  food('egg-white-raw', '鸡蛋清（生）', ['蛋清', '鸡蛋白'], '鲜鸡蛋蛋清，去壳分离后生重；需充分烹熟，不含蛋黄', [52, 10.9, 0.73, 0.17, 0], ['egg'], true, 172183, 'Egg, white, raw, fresh', 'sr', '01124'),
  food('cod-cooked', '大西洋鳕鱼（熟、烤）', ['鳕鱼', '熟鳕鱼'], '大西洋鳕鱼干热烹熟后的可食鱼肉重量，去骨；不是银鳕鱼，无额外油', [105, 22.8, 0, 0.86, 0], ['fish'], false, 171956, 'Fish, cod, Atlantic, cooked, dry heat', 'sr', '15016'),
  food('tuna-water-drained', '淡色金枪鱼（水浸罐头、无盐）', ['金枪鱼', '水浸金枪鱼'], '不加盐水浸淡色金枪鱼罐头，沥水鱼肉重量；不同品牌核对标签', [116, 25.5, 0, 0.82, 0], ['fish'], false, 171986, 'Fish, tuna, light, canned in water, without salt, drained solids', 'sr', '15184'),
  food('duck-meat-roasted', '鸭肉（去皮、熟烤）', ['鸭肉', '熟鸭肉'], '家鸭烤熟仅肉的可食熟重，不含皮、骨、酱汁；不是带皮烤鸭', [201, 23.5, 0, 11.2, 0], [], false, 172411, 'Duck, domesticated, meat only, cooked, roasted', 'sr', '05142'),
  food('napa-cabbage-raw', '大白菜（生）', ['大白菜', '白菜'], 'Pe-tsai大白菜可食部分生重；品种存在差异，无额外油', [16, 1.2, 3.23, 0.2, 1.2], [], true, 169979, 'Cabbage, chinese (pe-tsai), raw', 'sr', '11119'),
  food('napa-cabbage-boiled', '大白菜（水煮熟）', ['熟白菜', '水煮白菜'], '不加盐水煮大白菜，沥水后可食熟重，不含油或汤', [14, 1.5, 2.41, 0.17, 1.7], [], true, 169980, 'Cabbage, chinese (pe-tsai), cooked, boiled, drained, without salt', 'sr', '11120'),
  food('cabbage-raw', '圆白菜（生）', ['包菜', '卷心菜', '圆白菜'], '圆白菜可食部分生重，不含调料', [25, 1.28, 5.8, 0.1, 2.5], [], true, 169975, 'Cabbage, raw', 'sr', '11109'),
  food('cauliflower-raw', '花椰菜（生）', ['花菜', '菜花', '花椰菜'], '花椰菜可食部分生重，不是西兰花，无额外油', [25, 1.92, 4.97, 0.28, 2], [], true, 169986, 'Cauliflower, raw', 'sr', '11135'),
  food('cauliflower-boiled', '花椰菜（水煮熟）', ['熟花菜', '水煮花菜'], '不加盐水煮花椰菜，沥水后可食熟重，不含油或汤', [23, 1.84, 4.11, 0.45, 2.3], [], true, 170397, 'Cauliflower, cooked, boiled, drained, without salt', 'sr', '11136'),
  food('celery-raw', '芹菜（生、参考）', ['芹菜', '西芹'], '芹菜可食部分生重，品种和叶茎比例有差异', [14, 0.69, 2.97, 0.17, 1.6], [], true, 169988, 'Celery, raw', 'sr', '11143'),
  food('onion-raw', '洋葱（生）', ['洋葱'], '去除不食用外皮后的可食生重，不含油', [40, 1.1, 9.34, 0.1, 1.7], [], true, 170000, 'Onions, raw', 'sr', '11282'),
  food('garlic-raw', '大蒜（生）', ['蒜', '大蒜', '蒜瓣'], '去皮蒜瓣生重，不含油或腌料', [149, 6.36, 33.1, 0.5, 2.1], [], true, 169230, 'Garlic, raw', 'sr', '11215'),
  food('ginger-raw', '姜（生）', ['姜', '生姜'], '姜根可食部分生重；仅按实际吃下的量登记', [80, 1.82, 17.8, 0.75, 2], [], true, 169231, 'Ginger root, raw', 'sr', '11216'),
  food('eggplant-raw', '茄子（生）', ['茄子'], '茄子可食部分生重；烹调吸油需另外记录', [25, 0.98, 5.88, 0.18, 3], [], true, 169228, 'Eggplant, raw', 'sr', '11209'),
  food('zucchini-raw', '西葫芦（生、带皮）', ['西葫芦', '角瓜'], '带皮西葫芦可食部分生重，不含油', [17, 1.21, 3.11, 0.32, 1], [], true, 169291, 'Squash, summer, zucchini, includes skin, raw', 'sr', '11477'),
  food('shiitake-raw', '香菇（鲜、生）', ['香菇', '鲜香菇'], '新鲜香菇可食部分生重，去除不食用部分，不是干菇泡发重量', [34, 2.24, 6.79, 0.49, 2.5], [], true, 169242, 'Mushrooms, shiitake, raw', 'sr', '11238'),
  food('shiitake-dry', '香菇（干）', ['干香菇'], '干香菇泡发前可食干重；不可用泡发后重量套用', [296, 9.58, 75.4, 0.99, 11.5], [], true, 168436, 'Mushrooms, shiitake, dried', 'sr', '11268'),
  food('oyster-mushroom-raw', '平菇（鲜、生）', ['平菇', '蚝菇'], '新鲜平菇可食部分生重，无额外油', [33, 3.31, 6.09, 0.41, 2.3], [], true, 168580, 'Mushrooms, oyster, raw', 'sr', '11987'),
  food('pumpkin-raw', '南瓜（生、参考）', ['南瓜'], '南瓜去籽等不可食部分后的生重，品种有差异，不是板栗南瓜品牌数据', [26, 1, 6.5, 0.1, 0.5], [], true, 168448, 'Pumpkin, raw', 'sr', '11422'),
  food('pumpkin-boiled', '南瓜（水煮熟、参考）', ['熟南瓜', '水煮南瓜'], '不加盐水煮南瓜，沥水后可食熟重；无糖、油，品种有差异', [20, 0.72, 4.9, 0.07, 1.1], [], true, 168449, 'Pumpkin, cooked, boiled, drained, without salt', 'sr', '11423'),
  food('peas-boiled', '青豌豆（水煮熟）', ['豌豆', '青豌豆', '熟豌豆'], '不加盐水煮青豌豆粒，沥水后的熟重，不含豆荚或油', [84, 5.36, 15.6, 0.22, 5.5], [], true, 170420, 'Peas, green, cooked, boiled, drained, without salt', 'sr', '11305'),
  food('green-beans-boiled', '四季豆（水煮熟）', ['四季豆', '熟四季豆', '芸豆荚'], '不加盐水煮绿色四季豆荚，充分煮熟沥水后的熟重，不含油', [35, 1.89, 7.88, 0.28, 3.2], [], true, 169141, 'Beans, snap, green, cooked, boiled, drained, without salt', 'sr', '11053'),
  food('pepper-red-raw', '红甜椒（生）', ['彩椒', '红甜椒', '红椒'], '红色甜椒可食生重，不是辣椒，不含油', [26, 0.99, 6.03, 0.3, 2.1], [], true, 170108, 'Peppers, sweet, red, raw', 'sr', '11821'),
  food('asparagus-raw', '芦笋（生）', ['芦笋'], '芦笋可食部分生重，去除不食用老根，无额外油', [20, 2.2, 3.88, 0.12, 2.1], [], true, 168389, 'Asparagus, raw', 'sr', '11011'),
  food('scallion-raw', '小葱（生、参考）', ['葱', '小葱', '香葱'], 'Scallions包括葱叶和葱白的可食生重，品种有差异', [32, 1.83, 7.34, 0.19, 2.6], [], true, 170005, 'Onions, spring or scallions (includes tops and bulb), raw', 'sr', '11291'),
  food('mango-raw', '芒果（鲜、去皮去核）', ['芒果'], '新鲜芒果仅可食果肉重量，不含皮、核或糖', [60, 0.82, 15, 0.38, 1.6], [], true, 169910, 'Mangos, raw', 'sr', '09176'),
  food('papaya-raw', '木瓜（鲜、去皮去籽）', ['木瓜'], '新鲜木瓜仅可食果肉重量，不含皮、籽或糖', [43, 0.47, 10.8, 0.26, 1.7], [], true, 169926, 'Papayas, raw', 'sr', '09226'),
  food('pineapple-raw', '菠萝（鲜、去皮）', ['菠萝', '凤梨'], '新鲜菠萝可食部分重量，不含皮、不可食硬芯或糖', [50, 0.54, 13.1, 0.12, 1.4], [], true, 169124, 'Pineapple, raw, all varieties', 'sr', '09266'),
  food('peach-raw', '黄桃（鲜、去核）', ['桃', '黄桃', '鲜桃'], '鲜黄桃可食生重，去核；不是糖水罐头，其他桃品种仅作参考', [39, 0.91, 9.54, 0.25, 1.5], [], true, 169928, 'Peaches, yellow, raw', 'sr', '09236'),
  food('mandarin-raw', '橘子（鲜、去皮参考）', ['橘子', '桔子', '柑橘'], 'Mandarin新鲜可食果肉重量，去皮，品种有差异', [53, 0.81, 13.3, 0.31, 1.8], [], true, 169105, 'Tangerines, (mandarin oranges), raw', 'sr', '09218'),
  food('raisins-dark', '深色无籽葡萄干', ['葡萄干'], '深色无籽葡萄干，食用状态，不是鲜葡萄或另加糖的产品', [299, 3.3, 79.3, 0.25, 4.5], [], true, 168165, "Raisins, dark, seedless (Includes foods for USDA's Food Distribution Program)", 'sr', '09298'),
  food('peanuts-raw', '花生仁（生）', ['花生', '花生仁'], '去壳花生仁可食生重，无调味，不是带壳重量', [567, 25.8, 16.1, 49.2, 8.5], ['peanut'], true, 172430, 'Peanuts, all types, raw', 'sr', '16087'),
  food('peanuts-dry-roasted', '花生仁（干烤、无盐）', ['熟花生', '烤花生'], '去壳干烤花生仁，不加盐，无额外油；不是油炸花生', [587, 24.4, 21.3, 49.7, 8.4], ['peanut'], true, 173806, 'Peanuts, all types, dry-roasted, without salt', 'sr', '16390'),
  food('cashews-raw', '腰果仁（生）', ['腰果'], '生腰果仁可食重量，无额外油、糖或盐', [553, 18.2, 30.2, 43.8, 3.3], ['tree_nut'], true, 170162, 'Nuts, cashew nuts, raw', 'sr', '12087'),
  food('walnuts', '核桃仁（普通核桃）', ['核桃', '核桃仁'], 'English walnut去壳核桃仁重量，不是带壳重量，无额外调味', [654, 15.2, 13.7, 65.2, 6.7], ['tree_nut'], true, 170187, 'Nuts, walnuts, english', 'sr', '12155'),
  food('sesame-whole-dry', '芝麻（整粒、干）', ['芝麻', '白芝麻'], '整粒干芝麻重量，不是芝麻酱；芝麻过敏不在本版八类标注内，须自行核对', [573, 17.7, 23.4, 49.7, 11.8], [], true, 170150, 'Seeds, sesame seeds, whole, dried', 'sr', '12023'),
  food('olive-oil', '橄榄油（烹饪用）', ['橄榄油'], '烹调用橄榄油，按实际加入和吃下的克数登记，不按毫升直接换算', [884, 0, 0, 100, 0], [], true, 171413, 'Oil, olive, salad or cooking', 'sr', '04053'),
  food('sesame-oil', '芝麻油（烹饪用）', ['香油', '芝麻油'], '烹调用芝麻油，按克登记；芝麻过敏不在本版八类标注内，须自行核对', [884, 0, 0, 100, 0], [], true, 171016, 'Oil, sesame, salad or cooking', 'sr', '04058'),
];

const foodById = new Map(FOODS.map(item => [item.id, item]));
export function getFood(id: string): Food | undefined { return foodById.get(id); }

/** Developer-authored one-person starting portions, not USDA or dietary-guideline recipes.
 * Time assumes cooked rice/pasta or canned beans are already available where listed.
 * Use each food's weighing state; water is excluded and every added oil portion is explicit.
 */
export const RECIPES: Recipe[] = [
  {
    id: 'soy-banana-oats', name: '豆奶香蕉燕麦粥', slots: ['breakfast'], minutes: 10, budget: 'economy', vegetarian: true,
    ingredients: [{ foodId: 'oats-dry', grams: 60 }, { foodId: 'soy-milk', grams: 300 }, { foodId: 'banana-raw', grams: 80 }, { foodId: 'almonds-raw', grams: 10 }],
    steps: ['按清单称干燕麦、豆奶和去皮香蕉。', '燕麦加入豆奶及适量水，按包装要求煮熟，防止糊底。', '加入香蕉片和扁桃仁，不另外加糖或油。'],
  },
  {
    id: 'yogurt-apple-oats', name: '牛奶燕麦配苹果酸奶', slots: ['breakfast'], minutes: 10, budget: 'standard', vegetarian: true,
    ingredients: [{ foodId: 'oats-dry', grams: 50 }, { foodId: 'milk-2pct', grams: 200 }, { foodId: 'yogurt-greek', grams: 150 }, { foodId: 'apple-fuji', grams: 100 }],
    steps: ['称干燕麦、牛奶、酸奶和去核苹果。', '燕麦与牛奶加少量水煮熟，稍放凉。', '搭配原味脱脂希腊酸奶和苹果丁食用。'],
  },
  {
    id: 'egg-sweet-potato', name: '蒸蛋配红薯黄瓜', slots: ['breakfast'], minutes: 30, budget: 'economy', vegetarian: true,
    ingredients: [{ foodId: 'egg-raw', grams: 120 }, { foodId: 'sweet-potato-raw', grams: 220 }, { foodId: 'cucumber-raw', grams: 100 }],
    steps: ['红薯去除不食用部分后称生重、切小块；鸡蛋去壳称蛋液。', '红薯蒸至软熟；蛋液加水搅匀，另碗蒸至中心完全凝固。', '洗净黄瓜切段同食，本餐不额外用油。'],
  },
  {
    id: 'tofu-breakfast-rice', name: '青菜豆腐热饭', slots: ['breakfast', 'lunch'], minutes: 15, budget: 'economy', vegetarian: true,
    ingredients: [{ foodId: 'tofu-firm', grams: 170 }, { foodId: 'rice-cooked', grams: 130 }, { foodId: 'bok-choy-raw', grams: 150 }, { foodId: 'canola-oil', grams: 5 }],
    steps: ['米饭按熟重称量；硬豆腐和洗净青菜按烹调前重量称量。', '用清单中的全部油翻炒豆腐和青菜，加少量水焖熟。', '搭配彻底热透的米饭；15分钟以已有熟饭为前提。'],
  },
  {
    id: 'chickpea-savory-oats', name: '鹰嘴豆番茄咸燕麦', slots: ['breakfast'], minutes: 15, budget: 'economy', vegetarian: true,
    ingredients: [{ foodId: 'chickpeas-canned', grams: 200 }, { foodId: 'oats-dry', grams: 40 }, { foodId: 'tomato-raw', grams: 150 }, { foodId: 'canola-oil', grams: 5 }],
    steps: ['罐装鹰嘴豆冲洗沥水后称重；番茄切丁，燕麦称干重。', '用清单中的油炒软番茄，加水与燕麦煮熟。', '加入熟鹰嘴豆煮至热透；不使用生干豆替代称重。'],
  },
  {
    id: 'chicken-broccoli-rice', name: '西兰花鸡胸配米饭', slots: ['lunch', 'dinner'], minutes: 15, budget: 'economy', vegetarian: false,
    ingredients: [{ foodId: 'chicken-raw', grams: 170 }, { foodId: 'broccoli-raw', grams: 200 }, { foodId: 'rice-cooked', grams: 180 }, { foodId: 'canola-oil', grams: 8 }],
    steps: ['鸡胸和西兰花称生重，鸡胸切薄片；米饭称熟重。', '用清单中的油炒鸡片，加入西兰花和少量水，加盖焖至鸡肉完全熟透。', '熟米饭彻底热透后搭配；15分钟以已有熟饭为前提。'],
  },
  {
    id: 'tomato-egg-rice', name: '番茄炒蛋配米饭', slots: ['lunch', 'dinner'], minutes: 15, budget: 'economy', vegetarian: true,
    ingredients: [{ foodId: 'egg-raw', grams: 150 }, { foodId: 'tomato-raw', grams: 200 }, { foodId: 'rice-cooked', grams: 180 }, { foodId: 'canola-oil', grams: 6 }],
    steps: ['鸡蛋去壳称蛋液，番茄称生重切块，米饭称熟重。', '用一部分清单油炒蛋至完全凝固，再用余油炒番茄，合炒。', '搭配彻底热透的熟饭；清单油量是两次下锅的合计。'],
  },
  {
    id: 'tofu-mushroom-rice', name: '蘑菇烧豆腐配米饭', slots: ['lunch', 'dinner'], minutes: 15, budget: 'economy', vegetarian: true,
    ingredients: [{ foodId: 'tofu-firm', grams: 180 }, { foodId: 'mushroom-raw', grams: 150 }, { foodId: 'rice-cooked', grams: 180 }, { foodId: 'canola-oil', grams: 6 }],
    steps: ['硬豆腐和白蘑菇按烹调前重量称量切块，米饭称熟重。', '用清单油炒蘑菇，加豆腐和少量水焖至熟透。', '米饭彻底热透后同食；不另加含糖酱汁。'],
  },
  {
    id: 'tilapia-bok-choy-rice', name: '清蒸罗非鱼青菜饭', slots: ['lunch', 'dinner'], minutes: 30, budget: 'standard', vegetarian: false,
    ingredients: [{ foodId: 'tilapia-raw', grams: 180 }, { foodId: 'bok-choy-raw', grams: 200 }, { foodId: 'rice-cooked', grams: 180 }, { foodId: 'canola-oil', grams: 8 }],
    steps: ['去骨鱼肉和青菜称生重，米饭称熟重。', '鱼肉蒸至内部完全熟透；用清单中的油炒熟青菜。', '米饭彻底热透后同食；鱼肉中仍可能有细刺，食用前检查。'],
  },
  {
    id: 'chickpea-broccoli-rice', name: '鹰嘴豆西兰花盖饭', slots: ['lunch', 'dinner'], minutes: 15, budget: 'economy', vegetarian: true,
    ingredients: [{ foodId: 'chickpeas-canned', grams: 230 }, { foodId: 'broccoli-raw', grams: 200 }, { foodId: 'rice-cooked', grams: 130 }, { foodId: 'canola-oil', grams: 8 }],
    steps: ['罐装鹰嘴豆冲洗沥水称重，西兰花称生重，米饭称熟重。', '用清单油炒西兰花，加少量水焖熟，再加入熟鹰嘴豆热透。', '盖在彻底热透的米饭上；不把熟豆克数换成干豆克数。'],
  },
  {
    id: 'chicken-mushroom-pasta', name: '鸡胸蘑菇全麦意面', slots: ['lunch', 'dinner'], minutes: 15, budget: 'standard', vegetarian: false,
    ingredients: [{ foodId: 'chicken-raw', grams: 150 }, { foodId: 'mushroom-raw', grams: 150 }, { foodId: 'pasta-cooked', grams: 180 }, { foodId: 'tomato-raw', grams: 150 }, { foodId: 'canola-oil', grams: 8 }],
    steps: ['鸡胸、蘑菇、番茄按生重称量；全麦意面必须煮熟沥水后称量。', '用清单油炒熟切薄片的鸡胸，加入蘑菇和番茄煮至熟透。', '加入熟意面加热拌匀；15分钟以已有熟面为前提，核对面条包装过敏原。'],
  },
  {
    id: 'tofu-broccoli-mushroom', name: '豆腐西兰花蘑菇锅', slots: ['lunch', 'dinner'], minutes: 15, budget: 'economy', vegetarian: true,
    ingredients: [{ foodId: 'tofu-firm', grams: 250 }, { foodId: 'broccoli-raw', grams: 200 }, { foodId: 'mushroom-raw', grams: 150 }, { foodId: 'canola-oil', grams: 8 }],
    steps: ['硬豆腐、西兰花和蘑菇均按烹调前可食重量称量。', '用清单油炒蘑菇和西兰花，加入豆腐与少量水。', '加盖焖至全部熟透，连同锅内食材食用，不另外加油。'],
  },
  {
    id: 'chicken-egg-vegetables', name: '鸡胸鸡蛋青菜盘', slots: ['lunch', 'dinner'], minutes: 15, budget: 'economy', vegetarian: false,
    ingredients: [{ foodId: 'chicken-raw', grams: 150 }, { foodId: 'egg-raw', grams: 100 }, { foodId: 'bok-choy-raw', grams: 250 }, { foodId: 'canola-oil', grams: 10 }],
    steps: ['鸡胸和青菜称生重；鸡蛋去壳后称蛋液。', '用清单中的一部分油炒熟蛋液盛出，再用余油炒薄鸡片。', '加入青菜和少量水焖至鸡肉熟透，再加入熟蛋；油量按全餐合计。'],
  },
  {
    id: 'fish-sweet-potato', name: '蒸鱼红薯配西兰花', slots: ['lunch', 'dinner'], minutes: 30, budget: 'standard', vegetarian: false,
    ingredients: [{ foodId: 'tilapia-raw', grams: 180 }, { foodId: 'sweet-potato-raw', grams: 260 }, { foodId: 'broccoli-raw', grams: 200 }, { foodId: 'canola-oil', grams: 8 }],
    steps: ['鱼肉去骨、红薯去除不食用部分、西兰花洗净后分别称生重。', '红薯切小块蒸软，鱼肉另盘蒸至内部完全熟透。', '用清单油炒熟西兰花，搭配蒸鱼和红薯；食用前检查鱼刺。'],
  },
  {
    id: 'chickpea-mushroom-pasta', name: '鹰嘴豆蘑菇全麦意面', slots: ['lunch', 'dinner'], minutes: 15, budget: 'economy', vegetarian: true,
    ingredients: [{ foodId: 'chickpeas-canned', grams: 200 }, { foodId: 'mushroom-raw', grams: 150 }, { foodId: 'pasta-cooked', grams: 180 }, { foodId: 'tomato-raw', grams: 150 }, { foodId: 'canola-oil', grams: 5 }],
    steps: ['鹰嘴豆冲洗沥水称重；意面煮熟沥水称重；蔬菜称生重。', '用清单油炒蘑菇和番茄，加少量水煮熟。', '加入熟鹰嘴豆和熟意面热透；15分钟以已有熟面为前提，核对面条包装过敏原。'],
  },
  {
    id: 'yogurt-apple-snack', name: '原味希腊酸奶配苹果', slots: ['snack'], minutes: 5, budget: 'standard', vegetarian: true,
    ingredients: [{ foodId: 'yogurt-greek', grams: 200 }, { foodId: 'apple-fuji', grams: 120 }],
    steps: ['称原味脱脂希腊酸奶；苹果洗净去核后称可食重量。', '苹果切丁与酸奶搭配，不额外加糖。'],
  },
  {
    id: 'soy-banana-snack', name: '无糖豆奶配香蕉', slots: ['snack'], minutes: 5, budget: 'economy', vegetarian: true,
    ingredients: [{ foodId: 'soy-milk', grams: 350 }, { foodId: 'banana-raw', grams: 100 }],
    steps: ['无糖原味豆奶按克称量，香蕉去皮后称重。', '豆奶按包装说明饮用，搭配香蕉；不以同体积浓豆浆替代。'],
  },
  {
    id: 'almond-apple-snack', name: '扁桃仁配苹果', slots: ['snack'], minutes: 5, budget: 'standard', vegetarian: true,
    ingredients: [{ foodId: 'almonds-raw', grams: 30 }, { foodId: 'apple-fuji', grams: 150 }],
    steps: ['称无调味生扁桃仁，苹果洗净去核称可食重量。', '搭配食用；此组合蛋白质较少，不能等量替代高蛋白加餐。'],
  },
  {
    id: 'chickpea-cucumber-snack', name: '温鹰嘴豆配黄瓜', slots: ['snack'], minutes: 5, budget: 'economy', vegetarian: true,
    ingredients: [{ foodId: 'chickpeas-canned', grams: 180 }, { foodId: 'cucumber-raw', grams: 150 }],
    steps: ['罐装熟鹰嘴豆冲洗沥水后称重，按包装要求食用或加热。', '黄瓜洗净称重切丁，与熟豆搭配，不加额外油或酱料。'],
  },
  {
    id: 'egg-tomato-snack', name: '番茄蒸蛋', slots: ['snack'], minutes: 15, budget: 'economy', vegetarian: true,
    ingredients: [{ foodId: 'egg-raw', grams: 100 }, { foodId: 'tomato-raw', grams: 150 }],
    steps: ['鸡蛋去壳后称蛋液，番茄洗净称生重切小丁。', '蛋液加少量水搅匀，加入番茄，蒸至中心完全凝固；不额外用油。'],
  },
];
