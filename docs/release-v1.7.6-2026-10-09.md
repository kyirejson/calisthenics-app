# v1.7.6 发布核验 · 2026-10-09

- App version: 1.7.6；Android versionCode: 15；包名 com.zizhong.jinjie。
- EAS production build: c8216fe3-df85-4311-8876-8b8a3fdb7a9e，FINISHED。
- 源码归档核验 9 项源码哈希与工作区一致；个人 MEMORY.md、环境文件、签名密钥和私有原始素材未上传。
- 399/399 自动测试、严格类型检查通过；跑步浏览器回归及 Android 原生定位模块编译通过。
- 完整 APK 构建完成，apksigner v2 签名验证通过，签名与 v1.7.5 一致，可覆盖安装。
- aapt 核对版本、精确/粗略位置与定位前台服务权限通过；无 CAMERA 权限。
- 实际 APK DEX 含 GPS 诊断和订阅类，以及 mapLocation、mapPosition、auxiliaryProviders、networkAvailable 辅助定位代码标识。旧 v1.7.5 对照检查在 mapLocation 处失败，确认该检查能识别缺少本次修复的旧包。
- APK 大小：113007801 bytes。
- SHA-256：d1cad65ce6d6cff086f8787f92e7f534fd653e35ed4b460675a13df2e1d8ac03。
- GitHub 发布为非草稿，附件上传大小与 digest 验证通过。
- 下载：https://github.com/kyirejson/calisthenics-app/releases/download/v1.7.6/uncover-v1.7.6.apk。

发布 APK，不推送 OTA 或混合工作区源码。请覆盖安装，不要卸载或清空数据。尚未进行用户 OPPO 真机验收，不能保证室内精确 GPS。辅助位置仅显示地图、不计里程；系统所有提供者不返回坐标时，App 不能凭空定位。
