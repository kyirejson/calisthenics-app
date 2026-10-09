# 通用本地知识库

## 层级

存储和模型接口按独立资料库 → 文件夹 → Markdown 笔记组织。App 中的整库浏览、创建、笔记编辑及搜索页面已移除；动作详情仍可显示对应动作的原文与配图。章节链接和反向链接限定当前资料库，避免同名笔记串库。隐藏入口不代表加密；公开源码中的知识正文可以被获取。

## 存储

- 构建侧：`knowledge/libraries/<id>/` 保存 Markdown 和 `library.json` 元数据。
- `knowledge/sources.local.json` 描述待导入库、源目录和排除目录，不提交公网。
- 安装种子：`src/knowledge/referenceBundle.ts` 是已授权分发的正文唯一副本；`src/knowledge/private/bundle.ts` 只引用它并追加本地私有库，不再重复两套公开全文。
- 统一生成器：`scripts/lib/knowledge/bundle-writer.mjs`。新导入的其他库默认留在私有层，不会因运行导入命令自动进入公开安装包。
- 手机：App 文档目录 `knowledge/libraries/<id>/`，笔记是独立 Markdown 文件，目录索引单独保存。
- 浏览器：IndexedDB `uncover-knowledge` v2，`libraries` 保存库与笔记元数据，`notes` 保存 Markdown，以 `库ID/路径` 为键。
- 个人 `MEMORY.md`、档案、密钥与知识库完全分开。

图片文件、图片引用、图片空行不导入。保留正文和章节链接。

公开知识资料及种子用 `.gitattributes` 固定 LF 换行，避免 Windows 的自动 CRLF 转换使正文逐篇哈希不一致。

种子只在模型调用读取工具时载入，不在 App 启动时初始化数据库或正文索引。索引基于不可变资料对象缓存，可丢弃重建；每次列库会刷新实际文件/IndexedDB，外部修改不会被缓存隐藏。

## 安装包升级与冲突

库元数据保存种子版本指纹、各笔记基线指纹和待解决冲突。比较上一种子、本机正文、新种子：

- 未修改的笔记升级；新版新增笔记加入，未修改且上游删除的笔记移除。
- 本机个人添加、修改或删除不会被静默覆盖/复活。
- 本机与上游同时变更时，存储层保留冲突和本机正文，不静默覆盖。当前 App 没有冲突处理界面；需由开发侧调用存储接口处理。
- 旧版没有基线时，只对可用原始 SHA-256 确认未改的笔记自动升级；来源不明/同名个人笔记按冲突保护。
- 冲突选择写入成功后才刷新；失败可以重试。同一新版不重复弹出已处理冲突；后续新版仍重新比较。

Web 批次保存使用单个 IndexedDB 事务。原生写入先持久保存完整目录和前后正文日志，处理中断先恢复；报告写入失败时回滚，回滚失败保留恢复日志并停止继续写入。空资料库也可正常创建。只处理该库自有路径，不清除个人记忆或业务记录。

## 操作

开发侧使用下方导入和构建命令管理资料。资料库 UI 已退场，不再向 App 用户开放整库浏览、导入或编辑；聊天附件上传与整库管理是两个独立功能。存储层仍保护同名文件，批次重复或无效文件时不提交该批次。

营养资料独立导入，不需增加专用界面。当前已导入用户指定的“运动营养与食物知识库”，48 篇 Markdown，正文不改写，仅进行现有图片引用清理。

## 导入现有目录

`npm run knowledge:import` 按本地源配置导入，保留多个资料库。

`npm run knowledge:import -- "D:/资料/营养" nutrition "营养知识"` 导入新的独立库并重新生成多库种子。源目录不修改。

当前囚徒健身包含四册和知识地图，69 篇 Markdown；“产品设计”两篇文档明确排除。用户已指定将囚徒健身和营养两套文字资料加入安装包，并公开到 GitHub 的 `knowledge/libraries/nutrition`、`knowledge/libraries/prisoner` 和 `src/knowledge/referenceBundle.ts`。原文及原图映射随正式手机构建上传，原图不随 Git 公开；本机源目录配置、个人记忆、密钥及额外私有库不公开。

`npm run knowledge:build` 从 `knowledge/libraries` 重建同一多库种子；`npm run knowledge:check` 校验每篇正文哈希及存在的自有 Markdown 副本。缺少副本时导入源目录，不再生成/读取旧 `server/private/prisoner-index`。性能可用 `npm run benchmark:architecture` 复测，桌面数值不能代替真机验收。

## 已清理的旧版

旧 `knowledge/vaults/prisoner/` 导入副本已删除。浏览器由 v1 升级 v2 时清除原单库缓存；手机首次使用新版时只删除旧 `knowledge/prisoner/`。重新从文本源导入四册，不清除个人记忆或其他业务数据。该清理不保留旧单库功能。

模型已接入只读工具：`list_knowledge_libraries`、`browse_knowledge_folder`、`search_knowledge`、`read_knowledge_note`。目录与搜索结果提供真实库 ID 和文件路径；搜索可翻页，笔记读取返回完整 Markdown、章节标题和相关笔记，不截断。所有资料库（包括用户后续创建的营养库）使用同一读取接口，无需硬编码书名。模型没有知识库增删改工具。工具读取的正文会发送至用户配置的 DeepSeek API，不会每轮自动发送整套书。

未实现 Obsidian 插件系统、图谱或云同步。原生文件持久化需在手机安装包上实测。
