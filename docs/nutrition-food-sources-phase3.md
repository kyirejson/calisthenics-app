# 饮食易用性版本：食品与份量核验

核验日期：2026-09-28。本文保留当时 **51 项食品、20 个现有配方**的记录。当前101项与标签/条码导入见 [2026-09-29 扩充说明](food-library-expansion-2026-09-29.md)。

食品版本：`usda-foundation-2026-04_sr-legacy-2018-04_foods-v2_recipes-v1`。

## 来源与边界

沿用 [原始来源说明](nutrition-food-sources.md) 的两份 USDA 官方 ZIP：Foundation Foods 2026-04-30 与 SR Legacy 2018-04。所有新增值逐条读取原始数据，不由模型生成，也不把缺失营养值补成零。每项在 `catalog.ts` 保留 FDC ID、版本、生熟/可食状态和 CC0-1.0 许可。

完整校验程序：`scripts/test-nutrition-foods.cjs --source-archives <Foundation ZIP> <SR Legacy ZIP>`。
此次实际校验了 ZIP SHA-256、51 个来源 ID 与英文描述、255 项营养数值，以及 16 项代表性生活份量的原始重量，全部通过。原始数组中的 null 分隔项不视为食品记录。

美国通用数据不能冒充中国品牌或中式混合菜的实测值。鸡蛋面、全麦面包、酱油、酸奶、熟肉等均在名称或状态中标明参考范围；包子、馒头、外卖复杂配方仍不在此官方参考目录中。可使用明确标记为“用户录入、未经核验”的包装标签或照片估算，不给不存在的数据编造出处。

## 新增 28 项

| 类别 | 本地 ID（FDC ID） |
| --- | --- |
| 熟主食 | brown-rice-cooked (169704)、egg-noodles-cooked (169762)、potato-boiled (170440)、sweet-potato-boiled (168484)、corn-boiled (169999)、bread-whole-wheat (172688) |
| 蛋与熟肉 | egg-boiled (173424)、chicken-stewed (171478)、pork-tenderloin-roasted (168250)、beef-sirloin-grilled (174693)、shrimp-cooked (171971)、salmon-cooked (175168) |
| 豆奶制品 | tofu-soft (172449)、milk-whole (172217)、yogurt-plain-whole (171284) |
| 熟蔬菜 | spinach-boiled (168463)、carrot-boiled (170394) |
| 水果 | orange-raw (169097)、grapes-raw (174683)、watermelon-raw (167765)、pear-raw (169118)、strawberry-raw (167762)、kiwi-raw (168153) |
| 调味料 | sugar-white (169655)、salt-table (173468)、soy-sauce-shoyu (174277)、vinegar-distilled (172237)、honey (169640) |

## 生活份量

`servings.ts` 提供碗、份、个、片、盒、匙等便捷选项。官方有对应 household weight 的，采用该条目数据；碗、普通熟肉份等没有对应标准的，使用明确写“约”的开发者参考份量，并提示并非推荐食量或实测重量。

例如熟饭小碗 150 g / 普通碗 200 g 是便捷估量，**不是 USDA cup 的等义翻译**。水煮蛋大个 50 g、全麦面包一片 32 g、油一茶匙 4.5 g、白砂糖一茶匙 4.2 g 等有原始份量支持。只能用于所示生熟状态和可食部分；骨、壳、果皮、菜汤不混入对应克重。

自定义食品可填写“一盒 180 g”等包装净重；能量支持 kcal/kJ、按每 100 g 或按每份录入。没有密度依据时不把 mL 当作 g。标签纤维空缺以 `fiberKnown:false` 保存，合计显示信息不完整，不宣称为实测零。

本版本仍不统计钠和微量营养素；食盐零热量不表示可以不限量使用。过敏原标注不覆盖交叉接触，也不是过敏安全认证。
