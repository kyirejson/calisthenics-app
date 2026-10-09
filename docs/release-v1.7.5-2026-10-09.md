# v1.7.5 发布核验 · 2026-10-09

- App version: 1.7.5；Android versionCode: 14；包名 com.zizhong.jinjie。
- EAS production build: 56d21938-ec95-494f-988c-00cff53eadd1，FINISHED。
- 源码归档检查通过：定位修复的 TypeScript、Kotlin 文件哈希与工作区一致；排除环境文件、签名密钥、个人 MEMORY.md 及原始素材。
- 严格类型检查、396/396 测试通过；此前定位修复的浏览器回归及原生模块编译通过。
- 完整 APK 构建成功；apksigner v2 验证通过，签名与 v1.7.4 一致，可覆盖安装。
- aapt 核对版本与精确/粗略定位、定位前台服务权限通过；无 CAMERA 权限。
- APK DEX 实际包含 GpsDiagnostics、GpsSubscription，新原生修复确实进入安装包；旧 v1.7.4 作为负向检查未包含这些类。
- 大小：113005349 bytes。
- SHA-256：19af676b56b250897d04541bd119cb68b066f224ee79c1d163be9898fce8290b。
- GitHub 非草稿发布，公开 latest=v1.7.5，附件大小和 digest 与本地匹配。首次无查询参数的 latest 请求返回旧缓存；绕过缓存后验证成功。
- 下载：https://github.com/kyirejson/calisthenics-app/releases/download/v1.7.5/uncover-v1.7.5.apk。

本次发布 APK，不发送 OTA，也不提交或推送混合工作区源码。不要卸载或清空数据。尚未做 OPPO 真机验收，不能声称已确定该手机定位失败的唯一原因或所有环境均可定位；本版修复确认的生命周期缺陷，并提供实际诊断反馈。
