# v1.7.3 / Android build 12 发布核验

## 发布范围

使用现有 `com.zizhong.jinjie` 包名、Expo 项目 `f6e5af9d-46ec-4f38-be5e-ec267e071eb7`、production 渠道及远程专属签名。通过现有 GitHub Releases 分发 APK，不部署服务器、不发布 OTA、不提交应用商店。

本次发布当前工作树的已完成更新，重点为聊天 UI 和本机附件文字读取；没有增加聊天提示词、模型规则、OCR、文件服务器或自动知识库导入。包含此前完成的训练 UI、训练历史、重复训练累计、进阶返回分类和 Android 地图跑步记录器。保留已要求加入安装包的两套文字知识库。

## 源码与本机验证

- 原工作树 TypeScript 与 374 项自动测试通过；更新检测专项 7 项测试通过。
- 附件隔离浏览器测试通过 320、390、607 宽度的 MD/DOCX/文字 PDF 提取、空 PDF 错误提示、失败重试和草稿保留。
- Android 原生编译通过；本机 Android 与 Web 导出通过。
- EAS 过滤后的独立源码 Android/Hermes 导出通过：1,137 个模块、239 个资源，约 4.7 MB 的 JS/Hermes 包。
- 发布源码确认包含 `uncover-chat-files`、`uncover-running`、`expo-document-picker`、`expo-secure-store` 原生模块。
- 发布过滤目录不包含服务器代码、私有源目录、环境文件、签名密钥、私人 MEMORY.md 或运行时聊天附件；原书图片不包含。
- 公开文字 bundle 包含运动营养 48 篇、囚徒健身 69 篇。文件 SHA-256：`78ab30ae07e00e1e1fe2dda75795ee5c7b6a0d395112d43ebceffd63bc73d7bb`。
- 此次 EAS 上传来自本机工作树；旧 Git 提交元信息不代表本次所有源文件已提交至仓库。本次未擅自提交或推送其他用户改动。

## 云端构建与发布

- 构建：[caf6fde5-0228-4c2a-8f74-1d92747a2af6](https://expo.dev/accounts/kyirechou/projects/uncover/builds/caf6fde5-0228-4c2a-8f74-1d92747a2af6)。
- 目标版本：1.7.3 / versionCode 12。
- 云端构建成功，Android Gradle 构建耗时 7 分 3 秒；包名、版本和跑步定位/前台服务权限检查通过。
- APK v2 密码学签名校验通过，与 v1.7.2 的签名证书一致。证书 SHA-256：`EF8CE110F9EAB334A0120D2D50374FA6EF31709A5503C9BB7FAF5E6611C0EC81`。
- APK 大小：138,241,868 字节。SHA-256：`b42b1b6d4a5855a138c7fc3bf1fc75c0346e7260bfb087488f6263d7d8452258`。
- 最终 APK 内确认包含 `UncoverChatFilesModule`、PDFTextStripper、`UncoverRunningModule`，Hermes 包内确认两套知识库全部 117 篇文档摘要均已打包。
- 已发布：[v1.7.3](https://github.com/kyirejson/calisthenics-app/releases/tag/v1.7.3)，北京时间 2026-10-08 22:44:49。
- 下载：[uncover-v1.7.3.apk](https://github.com/kyirejson/calisthenics-app/releases/download/v1.7.3/uncover-v1.7.3.apk)。独立核验 GitHub latest 已为 v1.7.3、非草稿、非预发布，资产大小与 SHA-256 与本机一致，下载链接 HTTP 200。
- 构建状态查询超时及下载连接中断曾导致发布延迟；发布脚本增加查询超时、下载重试与断点续传，重用同一云端构建，没有重复打包或发布不完整文件。

## 未覆盖的验收

未连接 OPPO；本次不声称手机 GPS、后台省电策略、附件选择、键盘避让与覆盖安装已通过真机验收。悬浮球鼠标拖动的浏览器回归仍未通过，本次未更改其交互逻辑。附件仅发送提取出的文字，无文字扫描 PDF 不支持 OCR。
