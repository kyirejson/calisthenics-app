# 当前代码架构

维护日期：2026-10-09。历史审核证据见 [架构审核报告](architecture-audit-2026-10-09.md)，全部整改与验收见 [整改清单](architecture-remediation-2026-10-09.md)。本文描述当前职责，不另写一套训练/营养规则。

## 应用与页面

`App.tsx` 组装状态、更新、跑步与聊天 Provider，管理标签和详情路由。浏览状态放在路由上方，返回动作详情时保留所选分类/日期。不要在详情返回时重新创建默认选择状态。

- `screens/TodayScreen` 只管理训练/饮食/跑步分页、标题和恢复正在进行的跑步。
- `screens/TodayTrainingScreen` 管理徒手/控重训练展示与计划交互；器械分支交给 `EquipmentTodayScreen`。
- `components/TodayTrainingTask`、`todayTrainingStyles` 统一训练清单与排版；`MovementDetail` 统一动作阅读布局。这里只展示真实处方，不定义训练剂量。
- `TrainingScreen` 管理训练会话，`TrainingCockpit` 展示逐组操作。成功保存后才通知路由切到数据页。
- `DataScreen`、`TrainingDaySummary` 展示按实际完成组聚合的历史；再练一次追加新会话，不覆盖前一次。

复杂页面已拆为展示与控制器：`features/today/useTodayTraining` 管计划交互；`features/training/useTrainingSession` 管会话，`TrainingDialogs` 管弹窗；`features/history/useTrainingHistory` 管统计选择/删除，`TrainingHistoryDay` 管单日展示；`features/progression/useProgressionBrowser` 管分类/搜索/进阶，`RouteViews` 管路线展示；`features/chat/useChatSession` 管请求/工具，`useChatAttachments` 管串行文件解析和释放，`ChatMessages` 管消息展示。局部样式在对应功能目录，不复制新的业务算法。

## 业务与持久化边界

```text
页面/组件 → 纯业务计算或模型工具 → 状态协调/平台适配 → 本机存储或用户 API
构建脚本 → Markdown/生成资产 → 安装种子                 （不进入业务运行时）
```

| 目录 | 责任 | 不应放入 |
| --- | --- | --- |
| `src/data` | 静态动作、模板、图片映射、分类与资料；`exerciseCatalog` 是唯一静态动作入口 | 处方、计划、统计和体重趋势算法 |
| `src/domain/training` | 纯目录查询、处方、计划、进阶、会话和统计；`equipment` 为器械领域 | React、网络、存储 I/O |
| `src/domain/weight` | 纯体重趋势和图表数据算法 | React、网络、存储 I/O |
| `src/features` | 按功能划分的控制器、局部展示与样式 | 静态正文副本、跨域持久化 |
| `src/store` | App 状态、迁移、串行写入、错误恢复、重置协调 | JSX 页面、模型提示词、新的训练规则 |
| `src/nutrition` | 营养估算、记录/快照校验、历史照片和个人食品数据兼容 | 已移除的拍照识别 UI/传输、预置菜单 |
| `src/knowledge` | 多库浏览、搜索、笔记链接、只读查询、平台存储、生成种子 | API Key、个人记忆、Node 文件导入脚本 |
| `src/memory` | 个人 `MEMORY.md`、档案映射与平台存储 | 每日记录的整套复制、知识库资料 |
| `src/integrations` | 聊天、附件、用户凭据、模型工具、连接传输 | 另一套训练/营养计算或公共开发者 Key |
| `src/agent` | 文字/后台语音共用会话、消息订阅、取消所有权、执行回执和表达样式接线 | 关键词意图路由、第二套 Agent、工具能力/轮次数量限制 |
| `src/voice` | 原生语音传输、后台任务及共用会话接线 | 私有语音上下文副本、录音上传或 UI 路由 |
| `src/running` | 跑步状态机、地图、Web 记录器、原生传输适配 | 强度计划、臆造 GPS 轨迹 |
| `modules` | Android 跑步原生模块、原生附件文本解析 | 应用页面和跨域业务规则 |
| `scripts/lib` | Node 生成器、现行多库校验、共享测试基础设施 | 可由 App 导入的运行时模块 |

原有 22 个训练/器械/体重算法文件已迁入 `domain`，所有消费者和测试同步切换，不保留旧目录转导出或双实现。静态资料不反向依赖领域算法；新贡献者不得再建第二套处方引擎。

`AppStoreProvider` 只提供稳定的 `AppRepository`，`useAppStore(selector)` 使用 `useSyncExternalStore` 按选择字段通知；不允许无 selector 的全量订阅。动作引用保持稳定。模型工具通过 `useAppRepository().getSnapshot()` 调用时读取最新状态，不依赖旧 React 快照。

`accountDomain`、`trainingDomain`、`nutritionDomain` 独立串行队列，失败不毒化后续任务；持久化成功后才提交不可变状态。目标快照先等待档案和训练任务；导出、重新加载、清除统一协调已接受写入，生命周期处理时拒绝新写入。历史日记能力保留，没有新增 Agent 记餐。

训练日重置的两键写入由 `training_write_ahead_v1` 日志保护：删除日志才算提交；半写入/中断恢复原键。恢复失败保留原日志并暂停训练写入，可导出备份后重试。损坏独立领域只暂停该域，不把原始数据替换为空文档。存储键、记录格式和历史照片继续兼容。

## 平台实现

`memory/storage.ts` 与 `.web.ts`、`knowledge/storage.ts` 与 `.web.ts`、附件平台文件分别适配文件系统或浏览器存储。这是必要分支，不是重复业务规则。相同校验/状态规则放到平台无关模块，不能把 DOM API 引入原生路径。

Android 跑步由 `modules/uncover-running` 的前台服务记录；浏览器使用 `webRecorder`，只支持前台定位。附件由原生解析模块或 Web PDF/文本解析处理。移除相机模块不影响附件的文档选择器，也不删除历史本机照片。

文字和后台语音复用 `runAgentTurn` 的模型、全部现有工具、同一 `appRepository`。
`agentConversation` 是两者唯一会话所有者，生成/播放中止会失效旧回调，工具成功回执仍保留。
原生语音保持单麦克风、播放参考/回声消除、VAD 和识别；只将实际对话文字送往模型。
本地 AEC3、声学相关性和采样时钟负责声源处理，不按文字关键词屏蔽用户输入。
唤醒事件交给同一模型，不额外播放固定答话；语音模型可用 `continue_listening` 暂不出声，保留上下文和同批工具回执，不渲染空回复。
`responseStyle` 仅引导表达，不截断输出，不规定音乐或饮食意图，不限制工具轮次。

## 知识库的唯一正文与私人层

```text
原资料目录（不修改）
    ↓ knowledge:import：清理图片引用
knowledge/libraries/<id>/*.md + library.json（权威副本）
    ↓ scripts/lib/knowledge/bundle-writer.mjs
referenceBundle.ts（仅已授权的营养/囚徒正文，唯一副本）
private/bundle.ts（引用公开正文 + 其他真正的私有资料）
    ↓ 首次打开/模型工具读取时按需载入，三方升级，保护个人笔记
手机 Markdown/索引 或 浏览器 IndexedDB
    ↓ 列库、浏览、搜索、读笔记
用户配置的模型 API
```

公开构建排除 `knowledge/libraries` 和 `src/knowledge/private`，安装脚本只补私有层转导出。其他新库不会自动分发。`knowledge:build/check` 已统一到现行多库 Markdown 与哈希，旧服务端索引链退场，两份生成索引已移到本机可恢复归档，不参与构建。不需要部署知识服务端。

启动静态依赖图不含种子模块；这是按需执行，不宣称原生发布包自动网络分包。索引基于不可变资料对象缓存，可丢弃重建；每次读取刷新实际 Markdown/IndexedDB，外部修改会产生新索引。

升级比较旧种子指纹、本机正文、新种子：未改正文自动升级，个人改动/删除/新增保留；冲突可逐篇保留本机或采用新版。Web 使用单个 IndexedDB 事务；原生先保存完整目录与前后正文的恢复日志，中断先恢复，回滚失败保留日志。个人记忆和密钥不进入知识库事务。

## 检查与改动原则

运行 `npm run check`：TypeScript + 自动发现的 `test-*.cjs`。共享测试转译入口是 `scripts/lib/register-typescript.cjs`，保留调用者的目标/JSX 参数，不替代真正的 typecheck。

`test-code-architecture` 按 Web/Android/iOS 检查运行时依赖环、静态/领域边界、开发工具越界、按需种子、显式 selector、控制器和退场代码；纯类型关联不当作运行时循环。知识库测试覆盖正文哈希、私有隔离、升级/冲突、写入故障/中断恢复。

`npm run benchmark:architecture` 可复测实际 117 篇正文的初始化/索引/搜索与通知隔离；加 `-- --browser` 需要本地预览与 Playwright，测隔离桌面 Chrome。性能数值不代表所有手机。

页面变化运行相关隔离浏览器 smoke；原生配置变化还需新二进制构建/设备验收。网页通过不代表所有手机上都可用。更新版本或发布必须属于用户当前请求。
