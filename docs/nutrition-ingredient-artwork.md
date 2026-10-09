# 食材缩略图

模式：内置 imagegen，generate / product-mockup。单个资产单独生成，非双图拼接；已复制至项目目录。所有素材仅作为类别视觉，不是实物份量或营养数据依据。

输出：`assets/nutrition-ingredients/egg.png`、`assets/nutrition-ingredients/tomato.png`、`assets/nutrition-ingredients/oil.png`。

三张共用提示词（将 subject 换为下列对应句）：

> Use case: product-mockup. Asset type: separate square ingredient thumbnail for the approved dark Uncover nutrition app UI. Primary request: [subject] Photorealistic premium editorial food photography, centered tight three-quarter close-up composition filling 80% of square, realistic texture, dark charcoal #1B2028 seamless background, soft natural side light, subtle shadow. No text, no UI, no numbers, no logos, no watermark, no collage, no grid, no extra foods. Output one single square image.

egg: Two whole uncracked brown chicken eggs and a small shallow matte dark bowl with one cracked raw egg, yolk intact. No shell fragments.

tomato: Two ripe red tomatoes, one cut tomato half with visible natural seeds, a small fresh green stem.

oil: A small clear unlabeled glass cruet holding golden cooking oil, one small spoon nearby with a little oil.


## 统一食品图库（2026-09-29升级）

模式：内置imagegen / generate / product-mockup。10类分别单独生成，非拼图。原图逐张查看确认；机械缩小为320×320 JPEG quality88接入应用。原始生成文件保留，不修改或删除。

运行时：`assets/nutrition-foods/{key}-v1.jpg`。另将原有egg/tomato/oil压缩至此目录，不再将大PNG用于食材缩略图。

共用提示词：

> Use case: product-mockup. Asset type: ONE separate square category thumbnail for the dark Uncover nutrition app. Primary request: [SUBJECT] Photorealistic editorial food photography, centered tight three-quarter close-up composition filling 80% of square. Matte seamless dark charcoal #1B2028 background, soft natural side light, realistic food texture and appetizing natural colours, minimal subtle shadow. All subjects readable at 56px thumbnail. No text, UI, numbers, brands, logos, watermark, collage, grid or split panels. Output one single square image. This is a category illustration, not documentation of a particular user's food or portion.

各资产SUBJECT与原始输出：

### staples

A matte charcoal bowl of steamed white rice, a small portion of dry oat flakes beside it. A representative grains and staple foods still life.

原图：`C:/Users/28257/.codex/generated_images/01a0c83f-1356-7c61-9ca5-86d99a687ed5/exec-9336ca2a-7ecf-46fd-8f4e-9642f988b9da.png`。

应用：`assets/nutrition-foods/staples-v1.jpg`。

### vegetables

A fresh broccoli head, an orange carrot and a small green leafy cabbage. Representative vegetables, uncooked.

原图：`C:/Users/28257/.codex/generated_images/01a0c83f-1356-7c61-9ca5-86d99a687ed5/exec-24fd7359-ac79-40aa-be3f-91106b1a9bdc.png`。

应用：`assets/nutrition-foods/vegetables-v1.jpg`。

### fruit

A yellow banana, one red apple, a sliced orange. Representative fresh fruit.

原图：`C:/Users/28257/.codex/generated_images/01a0c83f-1356-7c61-9ca5-86d99a687ed5/exec-d77eea90-cb71-4e04-9cbf-b8e0ffd0305d.png`。

应用：`assets/nutrition-foods/fruit-v1.jpg`。

### meat

A small matte charcoal plate with a cooked plain chicken breast and two slices cut from it, no sauce. Representative meat food category.

原图：`C:/Users/28257/.codex/generated_images/01a0c83f-1356-7c61-9ca5-86d99a687ed5/exec-fc0d8cb2-eefb-472d-9220-2c523f80e171.png`。

应用：`assets/nutrition-foods/meat-v1.jpg`。

### seafood

A cooked plain salmon fillet and two peeled cooked shrimp on a small charcoal plate, no sauce. Representative seafood category.

原图：`C:/Users/28257/.codex/generated_images/01a0c83f-1356-7c61-9ca5-86d99a687ed5/exec-2d2d9815-7ec2-4f6f-901e-fc57ba009f34.png`。

应用：`assets/nutrition-foods/seafood-v1.jpg`。

### dairy

An unlabelled clear glass of milk and a small matte charcoal bowl of plain white yogurt. Representative dairy category.

原图：`C:/Users/28257/.codex/generated_images/01a0c83f-1356-7c61-9ca5-86d99a687ed5/exec-42f17b99-6831-4f91-b8f1-14bf26337231.png`。

应用：`assets/nutrition-foods/dairy-v1.jpg`。

### legumes

Three plain white tofu cubes on a small charcoal plate, a few pale soybeans alongside. Representative legumes and soy products category.

原图：`C:/Users/28257/.codex/generated_images/01a0c83f-1356-7c61-9ca5-86d99a687ed5/exec-b51dbc7b-7993-481f-9dbf-a466cc665ce7.png`。

应用：`assets/nutrition-foods/legumes-v1.jpg`。

### nuts

A small matte charcoal bowl of cashew kernels, walnut halves and a few almonds. Representative nuts and seeds category.

原图：`C:/Users/28257/.codex/generated_images/01a0c83f-1356-7c61-9ca5-86d99a687ed5/exec-f4a7ff8f-0d03-4544-b80b-ed2dc0d74fba.png`。

应用：`assets/nutrition-foods/nuts-v1.jpg`。

### condiments

Three small charcoal dishes with white sugar crystals, table salt and dark soy sauce. Representative condiments category, no bottles or labels.

原图：`C:/Users/28257/.codex/generated_images/01a0c83f-1356-7c61-9ca5-86d99a687ed5/exec-5c1c89dc-576c-422b-af66-922b22ca113c.png`。

应用：`assets/nutrition-foods/condiments-v1.jpg`。

### mixed

A single small charcoal plate with rice, a few green vegetables and plain cooked chicken slices, clearly one composite balanced meal. General food category fallback.

原图：`C:/Users/28257/.codex/generated_images/01a0c83f-1356-7c61-9ca5-86d99a687ed5/exec-094a2d9d-bf53-461c-ba57-25839d68552c.png`。

应用：`assets/nutrition-foods/mixed-v1.jpg`。

101食品并非101张专属实物照。分类图在UI中明确标注“主食图/蔬菜图”等，不能用配图推断份量、生熟状态或营养数值；用户确认保存的个人照片优先显示。
