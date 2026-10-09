# 饮食与「我的」页面 UI 复核 · 2026-09-28

## 范围

仅本地界面优化，无 GitHub 推送、APK 发布或付费模型测试调用。保留已有训练计划、进阶判定、菜单算法、同意流程及历史摄入快照。

## 模板对照与落实

| 原有差距 | 本次调整 |
| --- | --- |
| 日期导航、重复说明和目标记录占据首页顶部 | 收进紧凑能量卡工具入口；历史日期与目标快照仍可查 |
| 常用餐、助手和大块记录挤占主要位置 | 能量 → 拍照/搜索 → 今日已记录饮食 → 下一餐建议 → 助手；快捷复用和复盘下移 |
| 缺少清晰的餐食缩略图 | 按完整食材集合匹配菜谱示意图；未知组合用食材示意，照片估算不冒充保存了用户原始照片 |
| 每条记录直接摆开所有管理按钮 | 按餐次聚合成紧凑行，点开查看原记录并编辑、收藏或删除 |
| 推荐餐不突出，做法入口层级过深 | 独立橄榄色建议卡，图片旁提供换餐与做法；换餐仍先预览并确认 |
| 我的页是浅色样式，密度与数据页不同 | 共用深色背景、卡片色、荧光绿、22 px 主标题、16 px 边距、440 px 最大内容宽度 |
| 我的页累计数字可能包含无效记录 | 复用数据页 validHistorySessions / groupHistoryByDay，不计仅打开、空训练或未来训练 |

模板中的示例数值没有写入实际数据。推荐菜单不会自动变成已吃；历史记录聚合使用当时保存的 nutrients，而不是今天的食材数据库重新计算。

## 校验

- TypeScript 检查通过。
- 营养、历史、进阶与本次展示逻辑共 169 项单元测试通过（含 8 项新展示测试）。
- 浏览器实测 320、390、681、1280 px，饮食/我的/数据内容宽度与边距一致，无页面级横向溢出；普通当天能量卡实测 206 px。
- 验证配图加载、菜谱只读、摄入编辑取消、历史缺目标状态、返回今天、档案与开关保存/刷新、存储失败不伪装成功、清空取消不删除数据。
- 原营养页面与训练联动回归通过：常用餐复用、拍照选图与修正、保存与刷新、多轮助手（模拟请求）、菜单草案确认、实际摄入不被推荐覆盖、历史目标不补造。
- 今日训练、饮食、跑步、训练中以及数据/进阶原有比例与记录回归通过。
- 使用独立浏览器环境与虚构测试资料，未读取或改写用户当前浏览器中的记录。
- 未进行 Android/iOS 真机触摸、键盘、性能或相机测试；浏览器检查不代表原生验证。

实际页面截图（隔离测试数据）：

- `C:/Users/28257/AppData/Local/Temp/uncover-nutrition-profile-ui-KLemQV/diet-recorded-390.png`
- `C:/Users/28257/AppData/Local/Temp/uncover-nutrition-profile-ui-KLemQV/profile-390.png`
- `C:/Users/28257/AppData/Local/Temp/uncover-nutrition-profile-ui-KLemQV/profile-edit-320.png`

## 菜谱配图资产与生成记录

项目没有现成餐食照片。本次使用 imagegen 内建生成工具（generate / 全新生成 / 不使用人物或图像参考），补充四张独立方形菜谱示意图。它们不是用户提交的餐食实拍，也不参与热量识别或份量计算。做法详情明确注明图片为示意，实际份量与生熟状态以清单为准。

- `D:/001号仓库/calisthenics-app/assets/nutrition-recipes/soy-banana-oats-v1.png`
- `D:/001号仓库/calisthenics-app/assets/nutrition-recipes/chicken-mushroom-pasta-v1.png`
- `D:/001号仓库/calisthenics-app/assets/nutrition-recipes/chickpea-cucumber-snack-v1.png`
- `D:/001号仓库/calisthenics-app/assets/nutrition-recipes/tilapia-bok-choy-rice-v1.png`

图片使用 contain 完整显示餐盘，不拉伸、不拼接两张；匹配完整食材集合，不能因为名称类似或热量接近就展示另一道菜。照片估算记录因未保存原始照片，使用相机占位而不是生成图片冒充实拍。

最终生成提示词（原文，供复现）：

### soy-banana-oats

```text
Use case: photorealistic-natural. Asset type: single square meal thumbnail for a real Chinese fitness nutrition app. One overhead close-up photorealistic food scene, entire small matte off-white ceramic bowl or plate visible with modest padding on charcoal tabletop. Soft natural side light, appetizing natural food texture, premium restrained food photography. Dish fills about 85% of the square. Not a UI mockup, not an illustration, not a multi-panel layout. No text, labels, watermarks, people, cutlery, unrelated props or extra garnish. This is a recipe illustration, not a photo submitted by a real user. Subject: A bowl of cooked rolled oats in unsweetened soy milk, topped ONLY with banana slices and whole or chopped almonds. Distinct soft oats texture and banana slices, simple home-cooked breakfast. No berries, yogurt, honey, eggs, other fruits or seeds.
```

### chicken-mushroom-pasta

```text
Use case: photorealistic-natural. Asset type: single square meal thumbnail for a real Chinese fitness nutrition app. One overhead close-up photorealistic food scene, entire small matte off-white ceramic bowl or plate visible with modest padding on charcoal tabletop. Soft natural side light, appetizing natural food texture, premium restrained food photography. Dish fills about 85% of the square. Not a UI mockup, not an illustration, not a multi-panel layout. No text, labels, watermarks, people, cutlery, unrelated props or extra garnish. This is a recipe illustration, not a photo submitted by a real user. Subject: A bowl of cooked whole-wheat short pasta with fully cooked thin chicken breast slices, sliced white button mushrooms and pieces of cooked tomato, a light canola-oil gloss. Whole-wheat pasta is light brown. No cheese, cream, herbs, broccoli, salad, other meats or nuts. All four ingredients clearly distinguishable.
```

### chickpea-cucumber-snack

```text
Use case: photorealistic-natural. Asset type: single square meal thumbnail for a real Chinese fitness nutrition app. One overhead close-up photorealistic food scene, entire small matte off-white ceramic bowl or plate visible with modest padding on charcoal tabletop. Soft natural side light, appetizing natural food texture, premium restrained food photography. Dish fills about 85% of the square. Not a UI mockup, not an illustration, not a multi-panel layout. No text, labels, watermarks, people, cutlery, unrelated props or extra garnish. This is a recipe illustration, not a photo submitted by a real user. Subject: A small ceramic bowl containing ONLY cooked drained chickpeas and fresh cucumber cubes, lightly mixed, no dressing or oil. Distinct beige chickpeas and vivid green cucumber. No tomatoes, feta, cheese, leaves, chicken, rice or other ingredients.
```

### tilapia-bok-choy-rice

```text
Use case: photorealistic-natural. Asset type: single square meal thumbnail for a real Chinese fitness nutrition app. One overhead close-up photorealistic food scene, entire small matte off-white ceramic bowl or plate visible with modest padding on charcoal tabletop. Soft natural side light, appetizing natural food texture, premium restrained food photography. Dish fills about 85% of the square. Not a UI mockup, not an illustration, not a multi-panel layout. No text, labels, watermarks, people, cutlery, unrelated props or extra garnish. This is a recipe illustration, not a photo submitted by a real user. Subject: A simple plate of fully cooked steamed boneless white tilapia fillet, tender cooked bok choy with white stalks and green leaves, and a mound of steamed white rice, minimal canola-oil gloss. All three components recognizable. No salmon, chicken, egg, broccoli, tomatoes, herbs, garnish, sauces or nuts.
```

