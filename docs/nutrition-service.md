# 本地营养 AI 服务

服务支持本机开发和 Render 环境。Node 内置 HTTP/fetch 实现，无额外运行依赖。线上是否运行当前代码，需要在部署后另行验证。照片辅助识别和一般营养问答使用 DeepSeek；确定性的目标、菜单与已吃合计仍由客户端计算。

2026-09-29 新增 `POST /v1/nutrition/read-label`（抄录包装标签，最多1800输出tokens）与 `POST /v1/nutrition/lookup-barcode`（Open Food Facts只读查询，不调用LLM）。协议、许可、计量与确认规则见 [食品库扩充说明](food-library-expansion-2026-09-29.md)。沿用本文的本机访问控制与上线边界。

同日拍照记餐升级：`analyze-photo`一次调用自动区分标签与餐食；包装返回`{kind:'label',draft}`，普通餐食返回食材候选，均经客户端核对后确定性计算。三步 UI、可选本机照片保存与旧记录补拍纠错详见[拍照升级说明](nutrition-photo-upgrade-2026-09-29.md)。服务不保存上传图片的边界不变。

## 知识库就绪与部署

训练原书知识库仅保留囚徒健身；施瓦辛格索引、构建入口、助手检索接入及器械旧书籍导入文本/章节锚点/匹配报告已经移除。施瓦辛格原书目录此前已不存在；独立器械动作、现代指导和生成演示图保留。索引不随公共仓库或手机包分发。默认读取 `server/private/prisoner-index.json`；部署可通过 `NUTRITION_KNOWLEDGE_DIR` 指定目录，或通过 `NUTRITION_PRISONER_INDEX` 指定一个索引文件。后者优先，支持 `.json` 和受大小限制的 `.json.gz.b64` 压缩文本。仅在资料许可允许时提供这些文件，不要把书籍原文提交 Git。

部署前运行 `npm run knowledge:check`；缺失、损坏或空索引会返回非零状态。需要完整原书功能的服务设置 `NUTRITION_REQUIRE_BOOK_KNOWLEDGE=true`，索引不完整时拒绝启动。该开关默认不启用，避免中断不依赖书籍的食品识别。

`GET /health` 返回 `configured`（仅表示密钥已填写，不能证明有效）、`readiness` 和 `knowledge.prisoner` 状态及片段数量。`unconfigured` 为未配置密钥，`degraded` 为囚徒索引未加载，`ready` 为密钥已配置且囚徒索引结构有效；均不代表真实模型调用已经验收。诊断不暴露文件路径、原文或密钥。

本轮只修改本地代码，没有部署 Render，也没有上传私人索引。公网服务需在实际部署、提供有权使用的索引后验证。

### Render 私人资料同步

Render Secret Files 总量限制为 1 MB，运行路径为 `/etc/secrets/<filename>`。见 [Render 官方说明](https://render.com/docs/configure-environment-variables#secret-files)。原始 JSON 超过此限制，因此使用 gzip + Base64 文本；这只是传输压缩，不是加密。

1. 本机运行 `npm run knowledge:build`，生成被 Git 忽略的 `server/private/prisoner-index.json.gz.b64`，以及本机 JSON。当前源资料为 68 文档、1368 片段，压缩文本约 849 KB。构建脚本会检查文件大小并输出 SHA-256，不打印原文。
2. Render 服务 `uncover-nutrition-api` → Environment → Secret Files，新增 `prisoner-index.json.gz.b64`；将该本机文件完整内容粘贴到 Contents，不发到聊天或公开仓库。与其他 Secret Files 合计仍须低于平台限制。
3. 设置 `NUTRITION_PRISONER_INDEX=/etc/secrets/prisoner-index.json.gz.b64`。若以前配置过施瓦辛格 secret file，删除那个文件；保留 DeepSeek 密钥。要强制要求原书资料可用，设置 `NUTRITION_REQUIRE_BOOK_KNOWLEDGE=true`。
4. 将本次服务端代码发布到 Render 对应的仓库版本并部署。旧服务端代码不支持此压缩格式，单独上传文件不能完成升级。当前 Blueprint 关闭自动部署，不能假定提交后已经上线。
5. 在 Render Shell（如实例支持）运行 `npm run knowledge:check`；再检查 `/health`：只含 `knowledge.prisoner`，`available=true`、`chunks=1368`、`readiness=ready`。最后用一条囚徒动作问题验证引用与行号，并确认施瓦辛格问题不再检索原书。若部署仍是旧版，不能宣布同步成功。

未取得已登录 Render 的操作渠道前，以上是同步准备与操作步骤，不是已上传证明。完整三专题及双权限 harness 的当前审阅稿见 [助手 harness V2](nutrition-assistant-harness-v2.md)；尚未启用。

## 启动

使用 Node 22.9 以上版本（本轮测试为 Node 24）。在项目根目录创建仅供本机使用的 `server/.env`：

```dotenv
DEEPSEEK_API_KEY=填写自己的服务端密钥
DEEPSEEK_MODEL=deepseek-flash
NUTRITION_PORT=8787
NUTRITION_ALLOWED_ORIGINS=http://localhost:8081,http://127.0.0.1:8081
```

项目 `.gitignore` 已忽略 `.env` 和 `.env.*`。密钥只能在此服务端环境中使用，不能写进 `EXPO_PUBLIC_*`、应用代码、截图或前端打包资源。启动脚本依次加载 `server/.env` 与可选的 `server/.env.local`，后者用于本机覆盖；二者均不提交 Git，也不包含在手机包中。系统环境变量仍优先于文件配置。修改凭据后重启后端。

```powershell
npm run dev:nutrition
```

默认只监听 `127.0.0.1:8787`。`NUTRITION_HOST` 仅接受 `127.0.0.1`、`::1` 或 `localhost`，不支持公开网络监听。Android 本地设备调试可通过 `adb reverse tcp:8787 tcp:8787` 访问；使用网页时须将实际页面来源完整列入 `NUTRITION_ALLOWED_ORIGINS`，来源不含路径与末尾斜杠。

检查 `http://127.0.0.1:8787/health`，返回 `configured/provider/model`。`configured: true` 只说明已填入非空密钥，不代表账户额度、密钥有效性或外网连接已验证。无密钥时能启动服务，需调用 AI 的请求返回 503。

## 接口

所有业务请求使用 `Content-Type: application/json`，错误统一为 `{"error":{"code":"…","message":"中文说明"}}`。

`POST /v1/nutrition/analyze-photo`

输入 `{imageDataUrl, note?}`。只允许 JPEG、PNG、GIF、WebP 的 base64 data URL；拒绝远程 URL、非规范 base64、声明与实际签名不符、超大尺寸和超过 4 MiB 的编码后 JSON。图片签名、基本结构与尺寸检查不是完整图片解码。上传超时十秒。

普通餐食输出 `{kind:'ingredients',id,model,dishName,needsOilReview,ingredients,warnings}`，每项为 `{name,state:'raw'|'cooked'|'unknown',role:'food'|'oil',estimatedGrams:number|null,count:number|null}`。禁止模型返回热量、宏量营养、食品编号或来源；油量必须为null，炒菜通过needsOilReview要求用户确认。客户端精确名称/别名匹配本地食品（校验生熟状态，歧义拒绝自动匹配），用户确认食材、用油和食用比例后才按每100g数据计算。找不到食品或份量未知时阻止计算，不默认100g。包装/营养表输出`{kind:'label',draft}`，保留印刷kJ/kcal、计量基准与可见净重，缺失为null。两种响应不混合；来源由服务端控制。图片使用high detail，服务不写入饮食记录。旧的整道菜营养猜值响应已从新识图接口删除，仅保留历史快照的读取和编辑。

没有可识别食物时返回 422 `NO_FOOD_DETECTED`，提示重新拍照或手动记餐。AI 格式不完整、截断、数值异常或额外字段均返回 502，不悄悄截断或补造结果。

`POST /v1/nutrition/advice`

输入 `{question, context, history?, assistantMode?, memory?}`，问题最多一千字。`memory`最多40项`{kind:'like'|'avoid'|'need'|'allergy',text}`，内容最多80字符。`history` 最多六条、即最近三轮问答，按 `user/assistant` 交替且必须成对；每条用户文本最多一千字符、助手文本最多一千八百字符，不接受 system/tool 角色或额外字段。历史文本仍是不可信数据，不能覆盖服务端规则。context 只接受：

- `safetyStatus`：`ready/needs_setup/blocked/unsupported`。
- `objective`、`pattern`、`riskFlags`、`age`：可选，使用应用现有枚举，风险另支持 `underweight/under18`。
- `preferences`：应用现有营养偏好对象或 null；服务端只转发必要的已校验字段，将筛查时间归约为是否完成。
- `targets`：现有目标数值、`status/message`；UI 说明文字通过校验但不会转发给模型。
- `consumed`：五项已吃营养合计。
- `menu`：最多四项 `{slot,name,nutrients,editable?}`，不得直接上传完整菜单对象、步骤、食材或其他档案字段。
- `logging`：日期、已确认餐次、全日记完状态、记录条数、是否含照片；全日记完必须有四个餐次的明确确认。
- `training`：课程类型与标题、预计分钟、已练分钟、打钩组数、有效训练次数、状态及用户选择的时段。
- `weekly`：完整记录天数、可比较天数、实际训练天数、含照片天数、复盘状态、完整记录日的营养均值；不上传逐日明细。
- `toolsAllowed`：是否允许提出本地菜单工具意图，不是执行工具的授权。

问答请求最多 64 KiB，筛选后的 context 最多八千字符、history 最多九千字符。缺少准备状态、未完成筛查、未成年人、已标记健康风险、低碳/生酮等情况由固定规则返回说明，不转发到模型。当前或最近三轮用户问题中明确出现疾病、药物调整、未成年等情况也进入固定拦截，当前过敏相关问题返回固定谨慎说明；历史过敏不会阻断普通问答，但过敏过滤保留；这不是完整医学筛查或经过临床验证的风险识别器。

输出 `{answer, sources:[{title,url}], action?, intent?, references?}`，正文最多50个Unicode字符。`references`仅允许本次原书检索的章节片段和行号；`intent`支持受限记餐或需求记忆，不可与菜单action同时出现。完整规则见 [助手说明](./nutrition-assistant-2026-09-29.md)。问答仅解释定性原则，不重新计算现有目标、不新开数字处方；输出中数字、网址、未知来源或明显治疗断言会被拒绝。药物与极端节食措辞采用保守拒绝，包含这些措辞的否定句也可能触发。已知过敏食物提及、过敏安全保证及声称已执行或保存等内容也采用保守拒绝，关键词检查可能误拦且无法覆盖全部风险。如果已解码且非空的回答未通过校验，服务会完整丢弃该回答、来源及 action，返回明确标注“这次生成的建议未通过可靠性检查，暂不采用”的固定一般饮食说明与固定 NIDDK 来源，状态为 200；不引用、修补或冒充原回答已经通过校验。缺失/空回答、上游 JSON 损坏或截断仍返回 502。来源只从 `server/knowledge.mjs` 的有限摘要和本次本地原书检索中选择，不能使用模型自写网址。问答不是联网检索、医疗咨询或完整营养知识库；规则和提示词不能保证模型不会出错，结果仍需审阅。

可选 action 只接受 `{type,slot,focus}`：type 为 `swap_meal/rebalance_meal`，slot 为四个餐次或 `next`，focus 为 `balanced/protein/quick`。拒绝数量、食品或食谱编号、修改摄入记录、删除数据等任意参数；目标未就绪、工具不允许、当天记完或指定餐次不可编辑时不接受操作意图。客户端使用当前食品库和限制本地生成草案，预览后由用户确认；应用时重新计算并检查状态指纹，拒绝过期或被改动的草案。服务本身没有写入客户端记录的能力。

## 边界与费用控制

- 本服务不记录请求、照片、问题、健康资料、响应正文或密钥，也不保存上传文件。图片与最少必要的问答上下文会发送给 DeepSeek；问答包括营养偏好中的过敏与风险标记、今日摘要和最近三轮会话，不包括姓名、原图或逐日完整历史。用户主动输入在问题里的信息也会发送。其处理和保留政策由服务商决定，不能承诺服务商不保留。用户须在上传前明确同意；旧助手本地菜单快捷工具已删除，未同意时仍能手动记餐。已确认需求和最近三轮对话参与问答，本机保留记忆与最近30轮记录。
- 使用固定 HTTPS 服务商地址，不允许客户端指定模型、URL、提示词、工具或 token 数量。图片及用户文字按不可信数据处理。
- 默认每个 IP 每分钟十二次、全服务每分钟三十次、全服务滚动一天一百二十次 POST；全局最多两项并发，不排队，不自动重试。无效请求也会消耗本地次数。限流计数仅在内存中，重启会重置，不能代替服务商账户预算。
- 图片最多输出 3500 tokens，问答最多 1400 tokens；关闭思考模式，JSON 输出。上游请求超时四十五秒，响应体最多 128 KiB；用户断开连接后会取消上游。取消无法保证服务商没有产生费用。
- CORS 默认仅允许本机网页端口 8081；拒绝未知 Host，降低本机 DNS 重绑定风险。CORS 不是账号鉴权，其他本机程序仍可调用。
- 401/403 密钥错误、402 额度不足、429 限流、超时和网络故障仅返回统一中文说明，不向客户端透出上游正文或凭据。

正式部署必须另做账号鉴权、用户隔离、TLS、反向代理限额、共享限流/预算、隐私与保留/删除机制、成本告警和营养专业评审；不能把此本地入口直接公开为付费 API 代理。

## 验证

```powershell
node scripts/test-nutrition-service.cjs
```

测试使用本机临时端口和注入的模拟 fetch，覆盖输入/输出校验、CORS/Host、无密钥、照片成功与无食物、异常上游、超时/取消、限流/并发、多轮历史、受限 action、过敏回答和问答边界；2026-09-28 本轮七十九项通过，不会向真实服务商发请求或产生费用。`createNutritionServer(options)` 可导入；导入模块不会自动启动服务。注入参数供测试使用，包括 `fetchImpl/apiKey/model/corsOrigins/requestTimeoutMs/maxConcurrency/rateLimit`。

核对日期：2026-09-27。实现依据：[DeepSeek 图片理解](https://api-docs.deepseek.com/guides/vision/)、[JSON 输出](https://api-docs.deepseek.com/guides/json_mode/)、[Chat Completions 参数](https://api-docs.deepseek.com/api/create-chat-completion/)。当前官方说明 `deepseek-flash` 支持 `image_url` 与 JSON 输出；接口能力可能变化，真实联调需检查实际账户和服务商响应。

知识摘要依据：[NIDDK 成人健康饮食](https://www.niddk.nih.gov/health-information/weight-management/healthy-eating-physical-activity-for-life/health-tips-for-adults)、[NIDDK 成人体重工具范围](https://www.niddk.nih.gov/health-information/weight-management/body-weight-planner)、[ISSN 蛋白质与运动声明](https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/)、[ISSN 营养时机声明](https://pmc.ncbi.nlm.nih.gov/articles/PMC5596471/)、[USDA 食品数据说明](https://fdc.nal.usda.gov/data-documentation.html)。2026-09-28 补充营养时机摘要；这些短摘要经过来源核对，尚未经临床专业审核。训练饮食闭环的本地规则与验收见 [第三阶段说明](./nutrition-training-loop.md)。
