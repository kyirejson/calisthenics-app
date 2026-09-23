# v1.0.0 首个正式发布版

> 这是历史版本说明。当前 `main` 分支已进入 Uncover v1.2.0 测试版；详见 [README](README.md) 和 [更新记录](CHANGELOG.md)。

[下载安卓安装包](https://github.com/kyirejson/calisthenics-app/releases/download/v1.0.0/zizhong-jinjie-v1.0.0.apk)

发布日期：2026-09-22。安装包沿用 preview-2 的成功构建，内容未改动。原预发布页面保留，旧下载链接继续有效。以下为当前构建与验收状态。

在 GitHub 的 Actions 页面手动运行 Build Android APK。构建成功后，Releases 会出现 APK 下载附件。

工作流构建 release 模式 APK，内含 JavaScript，可独立启动，无需电脑或 Expo Go。当前使用 Expo 生成工程的默认测试签名，仅适合测试分发。正式发布前需配置专属签名并安全保存密钥。

当前是部分功能迁移：原小程序的周期训练引擎、自定义计划、完整食谱管理、报告、历史备份导入、训练中断恢复尚未移植。GPS 使用前台定位，尚不支持可靠的后台跑步追踪；现有暂停处理也需要修正和真机验证。类型检查和 JavaScript 打包通过不代表已经完成真机验收。

私有仓库的下载链接需要有仓库访问权限；公开仓库的源码及 Release 附件均公开。
