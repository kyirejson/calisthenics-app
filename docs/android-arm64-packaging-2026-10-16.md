# Android 正式手机包 ARM64 裁剪

日期：2026-10-16。只修改打包策略，不更换语音模型。以下保留首次未签名构建的测量记录；用户随后要求发布 ARM64 精简更新，正式版本升至 v1.7.19 / versionCode 28，不替换旧版附件。

## 修改

- 新增 `plugins/withAndroidArchitectures.cjs`，经 app.json 注册，在每次 Expo prebuild 写入 `reactNativeArchitectures=arm64-v8a`。
- `scripts/lib/android-abis.cjs` 提供唯一正式手机架构策略，并去掉重复属性、保留其他 Gradle 配置。
- 当前本地生成的 Android 工程也已更新。该目录按项目原规则不入 Git，持久配置是上述插件。
- APK 检查从扫描每个原生库路径获取架构，不仅检查语音 SO；任何 ARM32/x86/x86_64 库都会导致常规正式包检查失败。检查不再强制要求四架构。
- 模拟器仍可显式覆盖 Gradle 参数 `-PreactNativeArchitectures=x86_64`，此类调试产物不用于正式手机发布。
- 不删除第三方原始 AAR 中的其他平台内容，避免破坏开发/模拟器依赖；由打包过滤从手机 APK 排除。

## 验证

- 新增 3 项配置/检查策略回归通过，包含幂等、无关属性保留及拒绝额外架构。
- Expo prebuild 配置解析通过；独立 ASCII 快照中 `:app:assembleRelease` 成功。
- 实际 APK 通过更新后的 `inspect-apk-voice.cjs`；KWS/ASR/VAD/TTS 资源哈希、ARM64 语音库和既有 Agent 功能标记保留。
- REA 静态清单确认仅 `lib/arm64-v8a/`，不存在其他三套架构库。
- 未进行真机功能/性能验收；体积和架构检查不替代运行验证。

## 实测体积与产物状态

已发布通用 APK：479,079,218 字节（479.08 MB）。

本地新构建未签名 APK：334,599,360 字节（334.60 MB）。本轮不能将未签名体积当成最终签名发布大小；发布签名会有少量变化。

原四架构原生库占 192,825,608 字节；当前 ARM64 原生库占 49,047,952 字节，原生库净少 143,777,656 字节，约 143.78 MB。总 APK 还包含重建元数据、ZIP 和签名差异，所以总体差值不等于纯原生库减量。

语音模型、图片和业务功能未主动裁剪。上述测量对象是首次未签名产物，不能作为安装包交给用户安装；v1.7.18 保留原通用 APK。正式更新另行构建为 v1.7.19，签名与最终大小以该版本 Release 为准。

## 可追溯证据

当时构建目录：`D:/UncoverBuildTools/arm64-v1.7.18-20261016/android/app/build/outputs/apk/release/app-release-unsigned.apk`。该目录用于后续增量构建，会更新内容；历史测量对象由下列摘要及 REA Evidence 标识，不能把目录后来生成的 APK 当作原测量对象。

SHA-256：`ad0169f38638089ebe94e1e75f7898b51a15656d29e7fd1dd88f336adc3d80df`

- REA inspection Evidence：`ev_e61c91e7475685864041dc8d07967818b8ee2b4e4446e68fc42918169b3f0785`
- REA inventory Evidence：`ev_2be4da3d7862e068d071b34842391a1dd533d6e26c42997755545af20517b340`
- Manifest：`agm_6a1a7ed07740d41bc112682a71d15ee1509ccf98201a40498b4e37b6f6ef94ed`

该证据是包内静态清单，不观察手机运行、安装后数据目录、耗电或模型时延。
