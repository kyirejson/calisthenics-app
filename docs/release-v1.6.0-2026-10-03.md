# v1.6.0 / Android build 8 发布核验

## 发布范围

沿用 `com.zizhong.jinjie`、Expo 项目 `f6e5af9d-46ec-4f38-be5e-ec267e071eb7`、production 渠道与专属 Android 签名。用户自配 API Key；本次不部署 Render，不发布内容 OTA，也不是应用商店上架。

## 本次发现并修复的发布阻断

首个 EAS 构建 `d1b8a7ab-cf1e-456f-8903-12971e08a7dd` 在公开资源过滤后无法解析 `server/validation.mjs`：个人客户端引用了被 `.easignore` 排除的后端目录。本机完整目录的 JS 导出没有暴露这一错误。

修复采用 `src/agent/core/` 共享纯逻辑，客户端直接引用，后端仅转发兼容导出。依赖 Node Buffer 的图片格式检查和流式条码查询仍仅保留在服务器，未复制到客户端。增加公开源码边界及导出身份一致性的两项回归测试，阻止今后再次引用排除目录或复制实现。

## 已验证

- TypeScript 类型检查通过，585 / 585 自动测试通过。
- 发布源码 `5dc04176ce25e987a2173b896c06e8fb7509f85f` 的 GitHub CI 通过。
- EAS 过滤后的独立目录可以完成 Android JS/Hermes 导出：1,230 个模块、244 个公开资源，约 3.5 MB 的 JS/Hermes 包。
- 过滤目录不包含后端文件、原书图片、私有全文、检索索引、环境文件或私有唤醒模型；生成的原书资源映射为空，未覆盖本机原资源。
- 过滤目录 Android prebuild 成功，包名、production 更新头、`uncover` Scheme 及 `adjustResize` 配置正确。
- SecureStore、SQLite、系统语音及 UncoverCopilot 均由 Expo 原生自动链接识别。

## 原生构建

第二次构建：[2e9c6c3c-39ac-4763-90ee-0d296900911f](https://expo.dev/accounts/kyirechou/projects/uncover/builds/2e9c6c3c-39ac-4763-90ee-0d296900911f) 已完成。提交时锁定已有远程签名，未新建或轮换密钥。

- APK 大小：153,813,913 字节。
- APK SHA-256：`46ddd5230552a55d16d93778b79c6a7dfaed74cbfd308f2274d6a7ee8d7d8b3b`。
- Google apksig 8.13.0 密码学签名验证通过，证书 SHA-256：`EF8CE110F9EAB334A0120D2D50374FA6EF31709A5503C9BB7FAF5E6611C0EC81`，与原专属签名一致。
- 编译后 manifest 核验包名、versionCode 8、versionName 1.6.0、非 debuggable、production 更新头与私有唤醒 Service。
- APK 中检出 SecureStore、SQLite、语音识别、UncoverCopilot 和固定官方服务地址；没有发现所检查的本机密钥、私有索引或签名私钥。
- 扫描发现的 15 个 `.ppn/.pv` 文件全部与官方 Maven Porcupine 4.0.2 AAR 内置资源逐字节 SHA-256 相同，并核验 AAR 官方校验和。仅允许这些精确匹配，不豁免其他模型。依赖声明的许可见 [官方 LICENSE](https://github.com/Picovoice/porcupine/blob/master/LICENSE)。它们不是用户私有模型，也不表示本应用的中文自定义唤醒已配置。
- GitHub 上传摘要与本机 APK SHA-256 一致，发布为正式版并成为 latest，标签指向原生构建源码提交。
- [公开下载](https://github.com/kyirejson/calisthenics-app/releases/download/v1.6.0/uncover-v1.6.0.apk) 返回 HTTP 200，Content-Length 与本机文件相同；[发布页](https://github.com/kyirejson/calisthenics-app/releases/tag/v1.6.0)。

## 仍需真机验收

未连接 OPPO。本次自动化结果不能证明该机型的崩溃、语音准确率、键盘避让、桌面快捷请求、覆盖安装和更新重启已经验收。后台唤醒的私有模型及 AccessKey 不提供；公开知识库文件导入、跨设备同步、恢复导入、完整口述训练记录等仍未完成。上游依赖安全审计仍有告警。
