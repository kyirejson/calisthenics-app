# 本地营养食材与食谱数据

核验日期：2026-09-27。代码：`src/nutrition/catalog.ts`。

当前目录已扩充到 101 项，见 [2026-09-29 食品扩充与个人食品导入](food-library-expansion-2026-09-29.md)。此前 [51 项版本的份量核验](nutrition-food-sources-phase3.md) 与下文首批23项说明作为历史来源记录保留。

首批版本：`usda-foundation-2026-04_sr-legacy-2018-04_recipes-v1`。共 23 个食材条目、20 个开发者编写的单人基础食谱。食品目录与份量计算离线运行；照片和问答仍按各自同意流程联网处理。

## 官方来源及许可

- [USDA FoodData Central 官方下载页](https://fdc.nal.usda.gov/download-datasets/)：Foundation Foods 2026-04-30 快照，以及不再更新的 SR Legacy 2018-04。快照日期不表示每个食材都在 2026 年重新测量。
- [Foundation Foods 原始 JSON 压缩包](https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_json_2026-04-30.zip)：已实际下载并读取。SHA-256：`186e988ec542e913f51ef62b86a47758e8cdd0d1dc3889e7b055581f3c09c77a`。
- [SR Legacy 原始 JSON 压缩包](https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_json_2018-04.zip)：已实际下载并读取。SHA-256：`0fe8ae486a2c8eb42cb96413f058deb51863a46c8fb8eeb4b1fb45006dd338ef`。条目的 FDC 发布日期为 2019-04-01，与原始版本日期区分记录。
- [USDA 许可说明](https://fdc.nal.usda.gov/api-guide/#licensing)：FoodData Central 数据为公共领域，采用 [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)。来源署名：U.S. Department of Agriculture, Agricultural Research Service. FoodData Central.

数据来自上述官方原始文件，未将搜索摘要、营养博客或记忆中的数值作为数据源。下载文件保留在开发机器临时目录，未把两份完整大文件打包到应用。

本次核验将代码转译后的 23 个食材与上述 JSON 按 FDC ID 逐条匹配，115 项营养数值及英文食材描述全部一致；20 个食谱的食材引用、正数份量、唯一编号、四餐覆盖和素食标记也已通过一致性检查。

## 字段映射

数值全部按条目指定状态的 **100 克可食部分**：能量为 kcal，蛋白质、碳水化合物、脂肪、膳食纤维为 g。直接保留来源精度，不根据 4/4/9 重新生成来源能量。

| 本地字段 | USDA nutrient ID | 处理 |
| --- | --- | --- |
| protein | 1003 | Protein |
| carbs | 1005 | Carbohydrate, by difference；总碳水，不是净碳水 |
| fat | 1004 | Total lipid (fat)；不混入 1085 NLEA fat |
| calories | 1008 或 2048 | 有 1008 时采用 Energy；否则采用已报告的 2048 Atwater Specific Factors |
| fiber | 1079 或 2033 | 通常使用 1079；燕麦和罐装鹰嘴豆使用 2033 Total dietary fiber (AOAC 2011.25)，见下表 |

不把缺失字段当作零。基础数据中的部分条目只有脂肪酸，或缺少纤维，所以为需要的食材选用字段完整的 SR Legacy 条目；没有跨食材拼接营养值。不同年代的纤维测量方法仍会影响可比性。

## 逐条可追溯目录

`source.title` 保存英文原始食材描述，`source.foodCode` 保存 FDC ID 与适用的 NDB 代码，`source.version` 保存版本，`source.url` 指向下列官方详情页。F = Foundation 2026-04-30 下载快照，S = SR Legacy 2018-04。NDB 前导零按五位格式展示。

| 本地 ID | 官方条目 | 版本 | 来源状态及特别说明 |
| --- | --- | --- | --- |
| oats-dry | [FDC 2346396](https://fdc.nal.usda.gov/food-details/2346396/nutrients) | F | 原味全谷压片燕麦，干重；fiber 2033 |
| rice-raw | [FDC 2512381](https://fdc.nal.usda.gov/food-details/2512381/nutrients) | F | 未强化长粒白米，生重 |
| brown-rice-raw | [FDC 2512380](https://fdc.nal.usda.gov/food-details/2512380/nutrients) | F | 未强化长粒糙米，生重 |
| rice-cooked | [FDC 168878 / NDB 20045](https://fdc.nal.usda.gov/food-details/168878/nutrients) | S | 强化长粒白米饭，熟重，无额外油 |
| pasta-cooked | [FDC 168910 / NDB 20125](https://fdc.nal.usda.gov/food-details/168910/nutrients) | S | 全麦意面煮熟沥水重量，无额外油 |
| sweet-potato-raw | [FDC 168482 / NDB 11507](https://fdc.nal.usda.gov/food-details/168482/nutrients) | S | 未烹调红薯可食部分 |
| egg-raw | [FDC 748967](https://fdc.nal.usda.gov/food-details/748967/nutrients) | F | A级大鸡蛋，全蛋液、去壳生重 |
| chicken-raw | [FDC 171077 / NDB 05062](https://fdc.nal.usda.gov/food-details/171077/nutrients) | S | 无皮无骨鸡胸肉，生重，不含注水配方 |
| tilapia-raw | [FDC 175176 / NDB 15261](https://fdc.nal.usda.gov/food-details/175176/nutrients) | S | 罗非鱼可食肉，生重 |
| tofu-firm | [FDC 172475 / NDB 16426](https://fdc.nal.usda.gov/food-details/172475/nutrients) | S | 硫酸钙凝固硬豆腐，未烹调 |
| chickpeas-canned | [FDC 2644288](https://fdc.nal.usda.gov/food-details/2644288/nutrients) | F | 加盐罐装，冲洗沥水后的熟豆；fiber 2033 |
| milk-2pct | [FDC 171267 / NDB 01079](https://fdc.nal.usda.gov/food-details/171267/nutrients) | S | 含维生素A和D的2%脂肪液态奶 |
| yogurt-greek | [FDC 170894 / NDB 01256](https://fdc.nal.usda.gov/food-details/170894/nutrients) | S | 原味脱脂希腊酸奶 |
| soy-milk | [FDC 1999630](https://fdc.nal.usda.gov/food-details/1999630/nutrients) | F | 常温包装、无糖、原味豆奶 |
| broccoli-raw | [FDC 747447](https://fdc.nal.usda.gov/food-details/747447/nutrients) | F | 西兰花，生重 |
| bok-choy-raw | [FDC 2685572](https://fdc.nal.usda.gov/food-details/2685572/nutrients) | F | 小白菜，生重 |
| tomato-raw | [FDC 1999634](https://fdc.nal.usda.gov/food-details/1999634/nutrients) | F | 罗马番茄，生重 |
| cucumber-raw | [FDC 168409 / NDB 11205](https://fdc.nal.usda.gov/food-details/168409/nutrients) | S | 带皮黄瓜，生重 |
| mushroom-raw | [FDC 1999629](https://fdc.nal.usda.gov/food-details/1999629/nutrients) | F | 白色双孢蘑菇，生重 |
| banana-raw | [FDC 1105314](https://fdc.nal.usda.gov/food-details/1105314/nutrients) | F | 成熟或稍成熟香蕉，去皮 |
| apple-fuji | [FDC 1750340](https://fdc.nal.usda.gov/food-details/1750340/nutrients) | F | 带皮富士苹果，去核可食部分 |
| almonds-raw | [FDC 2346393](https://fdc.nal.usda.gov/food-details/2346393/nutrients) | F | 生扁桃仁（巴旦木），非苦杏仁 |
| canola-oil | [FDC 172336 / NDB 04582](https://fdc.nal.usda.gov/food-details/172336/nutrients) | S | Canola芥花籽油 |

## 食谱、称重与适用边界

- 食谱是开发者编排的可修改组合，不是 USDA 菜谱，也不声称来自中国膳食指南或由营养师个体处方。`ingredients` 是单人基础份量，实际菜单可能按能量目标调整。
- 肉、鱼、蔬菜按生的可食重量登记；鸡蛋按去壳蛋液；水果去皮或去核按条目说明。切勿把熟鸡胸的克数套到生鸡胸，或把熟米饭克数套到干米。
- 米饭与全麦意面按煮熟后重量；罐装鹰嘴豆按冲洗沥水后重量。包含它们的15分钟食谱以已有这些熟食为前提，事先煮饭、煮面时间不包含在内。30分钟食谱包含切小块红薯的蒸煮。时间是估计，必须以完全熟透为准。
- 菜谱油量是该餐所有步骤的总用油，默认全部食用并计入。无油菜谱不另外添加油；若实际加入油或其他配料，要另行记录。水仅参与烹饪，不增加本模型热量，不纳入食材总克数。
- 计算按原料营养线性相加；尚无出成率、营养保留率、烹调失水、弃汤和锅中残油模型。生重计算得到的整餐估算不能反向当作成品每100克的化验值。
- 目前只估算能量、蛋白质、总碳水、脂肪和纤维，不能据此评估微量营养素、钠、完整膳食质量或治疗膳食。盐、酱油、糖及调味酱没有隐藏在步骤里；添加时需另计，其中钠尚不统计。
- 美国样品与中国品种、加工、品牌及含水量有差异。尤其硬豆腐、希腊酸奶、豆奶、米饭和强化乳制品不能视为同名本地产品的精确化验。别名用于搜索，不代表营养完全等价；应核对显示的详细名称和状态。
- `vegetarian` 指蛋奶素可用，不代表纯素。奶、蛋、豆、麦、坚果标记由开发者按食材身份整理；USDA记录不是过敏原认证。空标记仅表示未列出当前支持的八类固有过敏原，绝不表示“无过敏风险”。
- 燕麦可能与小麦交叉接触，面条可能添加蛋或接触奶/大豆；坚果、豆奶及其他包装食品同样需核对配料、过敏原和共线生产提示。数据库尚未建模芝麻等更多过敏原，也没有交叉接触认证。多种过敏原同时排除可能使可用菜单不足，此时应明确提示而不是自动放宽过滤。
- 食谱包含奶类、豆类、蛋类及全植物组合供选择；替换不是营养等价承诺。扁桃仁水果加餐的蛋白质较少，豆奶的浓度也不能用“自制豆浆”直接替换。

## 更新要求

更新食材时重新下载官方文件，核对 FDC ID、英文描述、称重状态、营养单位及字段存在性。任何条目配方或数值改变，必须提升 `FOOD_DATA_VERSION`，避免让历史记录误认为使用同一快照。已保存的实际摄入记录应保留当时营养值和数据版本。
