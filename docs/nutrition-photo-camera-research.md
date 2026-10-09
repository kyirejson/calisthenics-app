# 拍照营养估算：接口核实与实施边界

核实日期：2026-09-27（Asia/Shanghai）。本文是研究与实现建议，不代表功能已经完成、经过真实照片评测或部署上线。本轮未读取密钥、调用付费模型、上传用户照片或修改业务代码。现有本地营养阶段见 [nutrition-agent-phase1.md](./nutrition-agent-phase1.md)，食物数据来源见 [nutrition-food-sources.md](./nutrition-food-sources.md)。

## 产品结论

可以实现“拍照后直接显示热量、蛋白质、脂肪”，无需让用户先称重或输入克数。照片识别得到的是对画面中食物的估算；默认流程应当是拍照／选图 → 显示估算 → 可选调整 → 用户确认记入。克数可以作为模型内部估计与可选修正信息，不应成为查看结果或记餐的必填门槛。

单张普通照片不包含可靠的实际重量、完整配方、隐藏油糖和已吃比例。建议主数字使用“约”，提供食物名称、影响较大的假设及简单的份量／吃下比例修正。不能把“照片识别成功”解释为营养值已经测准，也不能默认用户吃完了画面中的所有食物。

## DeepSeek 当前接口

### 已核实的调用契约

官方 [Vision 指南](https://api-docs.deepseek.com/guides/vision/) 当前指定 `deepseek-flash`。Chat Completions 图像放在 `user.content` 数组中的 `image_url` 块，支持内联 base64、可公开访问的图片 URL，也支持 Files API。新功能建议使用单张压缩 JPEG 的内联方式，省去创建持久化云文件这一步。该指南列出 JPEG／PNG／GIF／WebP；HEIC 需要先转换。单张内联图上限 32 MiB，请求体上限 48 MiB，这些是提供商上限，不是移动端上传目标。

最小请求形状如下；提示词和 JSON 示例是本项目设计示意，需要与实际服务端校验结构保持一致：

```json
{
  "model": "deepseek-flash",
  "thinking": { "type": "disabled" },
  "stream": false,
  "max_tokens": 1600,
  "response_format": { "type": "json_object" },
  "messages": [
    {
      "role": "system",
      "content": "根据食物照片估算，输出 json。不得要求先输入克数。无法识别时标记不可估算。示例：{\"status\":\"estimated\",\"name\":\"米饭配鸡肉\",\"calories\":520,\"protein\":30,\"fat\":18,\"carbs\":60,\"assumptions\":[\"按画面中一整份估算\"]}。蛋白质、脂肪和碳水单位为g，热量单位为kcal。"
    },
    {
      "role": "user",
      "content": [
        { "type": "text", "text": "估算这张照片中的这一份食物。" },
        {
          "type": "image_url",
          "image_url": { "url": "data:image/jpeg;base64,<BASE64_IMAGE>" }
        }
      ]
    }
  ]
}
```

服务端发送至 `POST https://api.deepseek.com/chat/completions`，使用服务端环境中的凭证构造 Authorization 请求头。图片不能放入 system 或 assistant 消息。[Chat Completions 参考](https://api-docs.deepseek.com/api/create-chat-completion/)

[JSON Output 指南](https://api-docs.deepseek.com/guides/json_mode/)要求 `response_format.type=json_object`，提示词包含 json 并给出示例，还明确提示可能出现空 content。JSON 模式不是业务 schema 保证：必须校验状态、必需字段、数字类型、有限非负值、范围顺序、数量限制与字符串长度；缺失的脂肪不能自动补零。仅解析 `choices[0].message.content`，完成原因异常、截断、空值及不合规对象均不可入账。

官方 [Thinking Mode](https://api-docs.deepseek.com/guides/thinking_mode/)默认启用思考，默认 effort 为 high。示例显式关闭以控制交互延迟和输出预算，这是起始方案，实际质量与速度仍需用食物样本比较；没有官方“几秒内完成营养识别”的保证。检查返回的 usage 和延迟，不以模型名称中的 Flash 作为性能验收结果。

### 模型与费用快照

[模型与价格](https://api-docs.deepseek.com/quick_start/pricing/)于核实日将 `deepseek-flash` 对应到 DeepSeek-V4.1-Flash，并列出图像、JSON、工具调用能力；`deepseek-v4-pro` 未列图像支持。旧 `deepseek-v4-flash`、`deepseek-v4-flash-vision-exp` 名称仍可接受但对应模型已退役并路由至 Flash。不要把旧型号或个人记忆当作当前视觉能力判断依据。

下表单位为美元／百万 token，随官方价格变化而变化：

| Flash token 类别 | 非高峰 | 高峰 |
| --- | ---: | ---: |
| 输入，缓存命中 | 0.003 | 0.006 |
| 输入，缓存未命中 | 0.15 | 0.30 |
| 输出 | 0.60 | 1.20 |

高峰为周一至周五 UTC 01:00–04:00 与 06:00–10:00，不含中国公共假日；上海时间对应 09:00–12:00 与 14:00–18:00。周末及中国公共假日全天为非高峰。上线前再次读取官方价格，不把此快照硬编码为账单。

图像按尺寸折算输入 token，当前指南给出每张最高 1024 token；文本及输出另计。[图像 token 说明](https://api-docs.deepseek.com/guides/vision/#token-usage) 例如假设一次共 2000 个未命中输入 token、1000 个输出 token，高峰模型费用约 0.0018 美元，非高峰约 0.0009 美元；这是算例，未包含重试、网络、服务端及存储。按每次完成后至少等待 12 秒的 live 设计，持续一分钟至多约五次请求，实际还受推理延迟影响，不能按“每餐仅一次”估算费用。

### 隐私与保留：已知和未确认

[Files API](https://api-docs.deepseek.com/guides/files_api/)不设置 `expires_after` 时文件永久保留；显式过期可以是创建后 1 小时至 30 天，也有删除接口。单餐估算建议不使用 Files API。内联图免去独立持久化文件，不等于请求日志、缓存或提供商系统零保留。

[中文隐私政策](https://cdn.deepseek.com/policies/zh-CN/deepseek-privacy-policy.html)更新／生效于 2026-02-10，说明服务收集输入输出可能用于模型训练与优化，存储位于中国境内，保留期限随目的而定；其下游应用用户处理规则需由开发者另行披露。政策中的客户端“数据用于优化体验”开关，不能直接推断为 API 请求的相同控制能力。本次未核实到该 API 的通用零保留承诺、固定请求数据保留天数或默认不训练保证，应在生产隐私说明定稿前核对适用服务协议及实际账号设置，必要时向提供商确认。

[开放平台服务协议](https://cdn.deepseek.com/policies/zh-CN/deepseek-open-platform-terms-of-service.html)更新于 2026-04-22、生效于 2026-04-29，禁止将 API key 暴露在浏览器或其他客户端代码中，并要求开发者处理终端用户数据告知与权利请求。工程上只把裁剪后的餐食图和本次必要文字发给提供商，不顺带发送姓名、体重、病史、定位和完整饮食档案；客户端说明接收方、用途、停止上传方式及本应用自身保留策略。不能把“本应用不保存原图”宣传成“任何平台都不保存”。

## Expo SDK 57 适配

当前仓库 `expo` 为 `~57.0.25`。本地 `node_modules/expo/bundledNativeModules.json` 与核实日 SDK 57 官方页面一致：

| 模块 | SDK 57 映射 | 职责与官方来源 |
| --- | --- | --- |
| expo-camera | `~57.0.5` | 内嵌相机预览、拍照；[Camera](https://docs.expo.dev/versions/v57.0.0/sdk/camera/) |
| expo-image-picker | `~57.0.20` | 系统相册／系统相机；[ImagePicker](https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/) |
| expo-image-manipulator | `~57.0.20` | 本地缩放与 JPEG 重编码；[ImageManipulator](https://docs.expo.dev/versions/v57.0.0/sdk/imagemanipulator/) |

安装应在项目目录运行 `npx expo install expo-camera expo-image-picker expo-image-manipulator`，交给 Expo 选择匹配版本，不能套用旧 SDK 的包版本。新增原生模块、权限或 config plugin 需要重新构建应用二进制；旧 APK 的纯 JS 更新不能补齐原生模块。三者官方页面均列入 Expo Go，但 Expo Go 检查不能替代目标 APK 真机验收。

相机使用 `CameraView`、`useCameraPermissions`；等 `onCameraReady` 后拍照，预览暂停时不要调用 `takePictureAsync`，页面失焦／退到后台时停止采样并卸载预览，同时最多一个活动预览。拍照流程不要申请录音：camera plugin 设置 `recordAudioAndroid:false`，image-picker plugin 设置 `microphonePermission:false`；系统权限与云端上传同意是两件事。[Camera 配置与生命周期](https://docs.expo.dev/versions/v57.0.0/sdk/camera/)

选图使用 `launchImageLibraryAsync({mediaTypes:['images'],allowsMultipleSelection:false})`，处理 `canceled` 和 `assets`；现代图片选择器通常不需要先索取整库权限，按平台实际流程申请必要权限即可。Web 必须从用户点击直接触发选择器；Android 需考虑 Activity 被回收后的 `getPendingResultAsync` 恢复。不要使用已弃用的 `MediaTypeOptions.Images`。[ImagePicker API](https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/)

图像处理使用命名导入 `import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'`，再调用 `ImageManipulator.manipulate(uri)` → `resize(...)` → `renderAsync()` → `saveAsync({format:SaveFormat.JPEG,compress:0.75,base64:true})`；`manipulateAsync` 已弃用。长边 1280 px、JPEG 质量 0.75 是建议起点，不是 Expo 或营养研究规定。宽高比例需保留，避免无意义放大；客户端检查最终大小，服务端再次校验解码后大小、尺寸与真实格式。不要只靠 picker 的 `quality` 限制 Web 上传尺寸。元数据去除必须通过实际样本检查确认，不能仅从重编码 API 名称推断。[ImageManipulator API](https://docs.expo.dev/versions/v57.0.0/sdk/imagemanipulator/)

网页 live 相机需要 HTTPS 或 localhost 安全上下文；手机访问电脑的普通 `http://局域网IP` 不能视为可靠的网页相机测试条件。浏览器不支持或权限拒绝时保留选图入口。[MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)

## 准确度证据应如何解读

[Nutrition5k 原论文](https://arxiv.org/pdf/2103.03375)（CVPR 2021，2021-06-22 修订版）表 3 区分以下条件；百分比是 MAE 除以该指标真值均值，不是逐餐 MAPE、置信区间或准确率。

| 实验条件 | 热量 MAE（kcal／归一化百分比） | 脂肪 MAE（g） | 蛋白质 MAE（g） | 对本项目的区别 |
| --- | ---: | ---: | ---: | --- |
| 2D Direct Prediction | 70.6／26.1% | 5.0 | 5.5 | RGB 直接估计份量及营养 |
| Depth as 4th Channel | 47.6／18.8% | 2.27 | 3.7 | 额外输入真实深度 |
| Volume Scalar | 41.3／16.5% | 3.0 | 5.2 | 由深度估计体积，结合每克营养预测 |
| 2D Portion Independent | 24.1／9.5% | 2.3 | 2.2 | 每克预测乘以真实总重量，不能当免称重结果 |

这些是专门训练模型在特定测试集上的结果，不是 DeepSeek 评测，也不代表任意手机、中国菜或单餐的误差上限。深度方案没有让每项宏量营养都同时最佳。普通 Expo 拍照接口也不会因为手机有多摄像头就自动提供该研究所需的标定深度。

[Google Research 数据集仓库](https://github.com/google-research-datasets/Nutrition5k)说明数据来自 Google 食堂和专用扫描设备，包含视频、部分 RGB-D 图、逐项重量和营养标注；标注依据食谱、称重和营养数据库，不是对每盘食物做热量化验。它可用于离线参考测试，但不能替代本地菜系与目标设备评测。

## 推荐架构与状态流

以下为建议，不是当前实现状态。首版优先完成稳定的单张请求；低频 live 可以复用同一估算接口。

```text
用户拍照／选图
  → 本机限制尺寸、重编码、预览
  → 自有服务端鉴权、限额、图像校验
  → DeepSeek Flash 图像 + JSON
  → 服务端校验、标明来源和估算假设
  → 客户端显示约热量／蛋白质／脂肪
  → 可选份量修正 → 确认记录 → 独立营养快照
```

### 单张照片

- 先给合理估算，再提供“半份／一份／两份”“吃了一半／全部”等可选操作。简单比例缩放可由确定性代码完成，不必为每次点击再次调用模型；份量比例和烹调／食材改动应分开处理。
- 若模型估计克数，它是估计变量，不得标成用户称重。若能匹配本地目录，可采用模型估计份量 × 数据库每克营养并保留 food ID／版本；无匹配时可以保留“AI 照片估算”来源，不能伪造数据库来源或研究引用。生熟状态不能混用。
- 可返回上下界／信心标签，但模型自己生成的区间在本地校准前不具统计覆盖率，不能展示“95% 准确”。食物不清晰、非食物或遮挡严重时返回不可估算状态，引导重拍／补充简单名称，不填假值。
- 识别结果与已吃记录分开。仅确认按钮写入；同一确认使用固定请求／记录标识去重；保存估算来源、模型返回版本、提示词版本、修正比例和当时营养快照，后续模型升级不得回写历史。
- 服务端凭证独立于移动端配置；生产请求应具用户隔离、总预算和个人限额。日志仅保留最少必要元信息，不写 Authorization、base64、原图或完整健康档案。未配置服务时明确返回不可用，不能用演示数值冒充真实识别。
- 支持取消与超时；关闭页面、切换照片、撤回上传后旧请求结果不可覆盖新画面。对 429／临时网络错误采用有上限退避；格式错误仅有限重试，不能无限付费重试。客户端取消不保证提供商停止计费。

### 低频 live

相机预览可以持续显示，但云端接口仍是一张张照片请求。建议每次请求完成后至少等待 12 秒再采样，并采用串行调度，任意时刻最多一个请求在途；这是成本与交互选择，不是识别精度结论。

只在用户明确打开 live、页面处于前台且相机就绪时采样。画面明显变化或用户主动刷新才需要新估算；退出、锁屏、后台、撤回同意时立即停止定时器与相机。保留时间戳和“更新中”，使用递增 request ID 丢弃迟到结果；错误时停止自动连发并提示重试。相似帧避免重复上传可以降成本，但简单图片哈希不能被当成可靠的食物识别算法。

live 数字是当前候选估算，禁止每帧累加到今日摄入。用户冻结画面后确认一次才记餐。多帧平滑只能减少跳动，不能推导隐藏配料或保证正确；新一盘食物不能与前一盘的结果平均。若首版没有实际验证热量、耗电、发热和延迟，宜把 live 保留为明确的实验能力。

## 实施验收与上线边界

代码验收至少覆盖：无克数可显示并确认、非食物／模糊图、拒绝权限、取消选图、断网／超时／429、空或截断 JSON、畸形营养数值、图片过大、重复确认、关闭后返回、重新选图后旧结果到达、清除数据与未完成请求并发，以及 live 退出后不继续上传。

真实营养评测采用知晓配方与称重的餐食，覆盖简单食材、混合炒菜、汤、油炸、外卖、大小份与不同餐具／光线；按菜系和场景报告 kcal／g MAE、系统偏差、极端错误、无法估算率及响应时间，并与营养师或可信配方结果复核。百分比指标要写清分母；区间需检验实际覆盖率。研究中的 Nutrition5k 数字只能当比较背景，不能直接填入本应用宣传。

上线前还需真实 API 联调、服务端授权与成本限额、隐私说明与删除策略、Android／iOS 原生构建和真机权限验收；本地 TypeScript、mock 或网页演示通过都不能替代这些验证。未经单独评测和专业审查，不将照片估算用于胰岛素剂量、疾病治疗膳食或过敏安全认证。日常记餐可以使用估算，但必须让用户知道数字的来源和局限。

本研究仅新增本文档。参数、接口与政策均按核实日记录，上线及后续模型更新时重新确认。
