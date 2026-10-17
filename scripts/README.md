# 脚本入口与分类

根目录保留现有命令名，避免破坏 CI/历史调用。新增通用实现放入 `lib`；不要让 `src` 反向依赖这些 Node 工具。

| 类别 | 入口 | 用途 |
| --- | --- | --- |
| 全量回归 | `test-all.cjs` / `npm test` | 自动发现 `test-*.cjs`；检查 `lib` 的 JS 语法 |
| 共享测试基础设施 | `lib/register-typescript.cjs`、`lib/module-graph.cjs`、`lib/project-features.cjs`、`lib/app-repository-harness.cjs`、`fixtures` | 测试转译、平台/按需运行时图、功能职责范围、实际仓库故障模拟、合成数据 |
| 知识库导入 | `import-knowledge-vault.mjs`、`lib/knowledge/bundle-writer.mjs` | 生成唯一公开正文与私有层；不改原资料 |
| 现行知识库构建/检查 | `build-knowledge-vault.mjs`、`check-knowledge-vault.mjs`、`lib/knowledge/seed-files.mjs` | 同一多库 Markdown、种子和逐篇哈希；无旧服务端索引 |
| 架构性能复测 | `benchmark-architecture.cjs` / `npm run benchmark:architecture` | 实际正文的冷初始化/索引/搜索和订阅通知；加 `-- --browser` 测隔离桌面浏览器 |
| 打包预处理 | `prepare-public-resources.cjs`、`prepare-chat-pdf.cjs`、`prepare-original-resources.cjs`、`verify-release-resources.cjs` | 安装后资源映射/PDF worker；开源开发缺少原书时补空桩，正式 production 构建缺少原文或原图则阻止发布 |
| 浏览器验收 | `smoke-*.cjs` | 按功能运行的隔离会话，需启动 Web 预览及 Playwright |
| 发布/原生验证 | `publish-app-release.ps1`、`check-android-native.ps1`、`build-android-ui-dump.ps1` | 仅在需要构建/发布/设备检查时调用 |
| 本地语音构建 | `prepare-voice-resources.cjs`、`build-running-voices.py` | 下载哈希固定的原生库/模型/AEC 源码，或在隔离工具环境重生成跑步离线播报；构建工具不进入 App |
| 语音验证 | `test-voice-agent.cjs`、`test-voice-turn-assessment.cjs`、`test-agent-conversation.cjs`、`check-voice-models.py`、`build-wake-fixtures.ps1`、`build-voice-dialogue-fixtures.py`、`check-voice-echo.py`、`native/voice-echo-probe.c`、`inspect-apk-voice.cjs` | 共用对话/取消/文字流、只读语义判停回归；声学前端与真实本地模型检查、最终 APK 资源/原生类检查；不冒充真机验收 |
| 公开网页工具 | `test-web-tools.cjs` | 网页分页、公开搜索解析、取消、私网保护；Android 网络另由 instrumentation 检查 |
| 通用手机控制 | `test-phone-agent.cjs`、`smoke-phone-agent.cjs`、`check-phone-control.ps1`、`inspect-apk-phone.cjs` | 无应用白名单的模型工具、真实授权、隔离原生控件/Chrome/Settings/OCR 和最终 APK；模拟聊天不是微信实际发送验收 |
| 手机可靠性/提醒/缓存 | `test-agent-reliability.cjs`、`check-phone-reminders.ps1` | 稳定前缀、真实 usage 计数、流程参数、短摘要收尾；独立 Android 测试包进程退出后的系统通知验收，不自动选择实体手机 |
| 模型日志/缓存结构 | `test-agent-journal.cjs`、`check-agent-browser-storage.cjs` | 原始消息/推理/工具批次、迁移/清空竞态、完整资料引用、显式检查点；后者接收已安装的 Playwright 绝对模块路径和可选浏览器 channel（如 msedge），在隔离浏览器测试 8 MB IndexedDB 写入、刷新恢复和清空，不安装依赖、不调用模型 |
| 历史研究 | `audit*`、图片研究 `.py`/`.json` | 手工研究/一次性素材工具，不属于发版门禁 |

本轮已删除四个对应已退场相机/条码功能的 smoke。`test-nutrition-photo-history` 只保护历史营养照片、份量快照与照片存储兼容，不提供新拍照功能。

浏览器验证需提供可用的 Playwright 路径（`PLAYWRIGHT_PATH`）和浏览器。支持 `PLAYWRIGHT_EXECUTABLE` 的旧脚本可指定现有 Chrome，不必另行安装测试 Chromium；不同脚本的覆盖尺寸和浏览器选项以入口参数为准。

建议页面回归：`smoke-training-visual-unification`、`smoke-today-overview`、`smoke-equipment-training`、`smoke-progression-return`、`smoke-nutrition-dock`、`smoke-chat-attachments`、`smoke-knowledge-vault`、`smoke-running-map`。这些脚本通过不等于已完成实体手机验收。

补充数据行为回归：`smoke-repeat-training`、`smoke-training-cockpit`、`smoke-training-history-cards`、`smoke-knowledge-upgrade`、`smoke-knowledge-model`。知识升级 smoke 检查同步写入异常时整笔回滚；模型 smoke 用模拟 SSE，但调用实际本机工具。`smoke-repeat-training` 使用固定日期，避免现实星期变化导致错误地期待引体训练。结构测试按功能文件组或 AST/容许换行的规则检查，不要求业务与 JSX 回到同一个大文件。

训练修复专项：`smoke-training-resume-delete` 检查实际组编辑、退出续练、刷新恢复、整日删除及菜单移除；`smoke-running-focus` 检查目标、倒计时、锁定和公里分段。`smoke-running-android`、`smoke-running-focus-android`、`smoke-original-offline-android` 只接受 emulator 序列号，分别验证 Android 跑步生命周期、原生全屏交互与断网原文显示；后者的原图需要人工检查输出截图。

退场索引已归档到 `D:/UncoverBuildTools/archives/uncover-retired-server-index-20261009/`，可恢复，不参与命令或安装包。研究工具保留原名称以保护外部调用，但不属于应用运行时或发布门禁。

跑步行为专项：`test-running-behaviors` 验证自动暂停的连续速度证据、手动暂停不自动恢复、校准计步来源和中断配速保护。浏览器 GPS 隔离工具集中在 `lib/browser-running-harness.cjs`。原生 MotionGate、RunDistance、StepEvidence 的 JUnit 使用 `check-android-native.ps1 -Target ModuleTests -ProjectRoot <英文路径副本>`；Windows JVM 测试进程及 C++ 完整构建需英文路径副本，原仓库不需移动。模拟测试不能证明真机计步精度。

MAX 播放专项：设置 `ANDROID_SERIAL=emulator-<编号>` 后运行
`check-android-native.ps1 -Target VoicePlaybackTests -ProjectRoot <英文路径副本> -AndroidSdk <SDK路径>`。
Android instrumentation 测试直接调用生产 `VoiceSpeaker` 和流式 `VoicePcmPlayer`，
要求 PCM 实际播完、连续分段提前续入、字幕按播放位置推进、暂停恢复及取消代次隔离；
实际内置 MeloTTS、AEC/VAD/ASR 与回声隔离也在测试范围内，不依赖手机系统 TTS，不登记声纹。
仅进入“倾听”状态不算播放成功；不自动选中实体手机，
不授予麦克风权限、不访问个人资料，测试 Activity 不进入正式 App。

MAX 离线唤醒模型检查：在 Windows PowerShell 5.1 中运行
`build-wake-fixtures.ps1 -OutputDirectory D:/UncoverBuildTools/voice-agent-20261014/max-fixtures`，
再给 `check-voice-models.py` 提供 `--resources`、`--fixtures` 与上游中文 `--asr-fixture`。
仅生成 Max / Hey Max / 非唤醒句三个合成 WAV；检测使用生产 KWS 参数及 512 样本帧，
前置 200 毫秒静音模拟待机上下文。合成素材不进入生产 APK，不能冒充真人口音或真机麦克风验收。
