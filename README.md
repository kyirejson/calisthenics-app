<div align="center">

<img src="assets/app-icon.png" width="112" alt="Uncover App 图标" />

# Uncover

永不言弃，积极向上，奋斗终生。

**v1.3.0 · Android**

[下载安卓安装包](https://github.com/kyirejson/calisthenics-app/releases/download/v1.3.0/uncover-v1.3.0.apk) · [正式版发布页](https://github.com/kyirejson/calisthenics-app/releases/tag/v1.3.0) · [反馈问题](https://github.com/kyirejson/calisthenics-app/issues)

</div>

## 安装

用安卓手机下载 APK 并打开，按系统提示允许安装即可。无需 Expo Go，也无需连接电脑。独立的专属签名用于本版及后续版本；历史测试包不再作为默认下载入口。

## 功能

- 今日课程、周日历与全年日程查看；支持减肥控重及囚徒健身专题。
- 动作分类、阶数选择、步骤指导和基于训练记录的进阶辅助。
- 逐组打钩记录、加组、追加动作、重置当天训练和删除历史；没有勾选的力量训练不记入历史。
- 今日能量、餐食示例、健康与恢复提示。
- 前台 GPS 跑步记录、本机数据统计与 JSON 导出。
- GitHub 新版 APK 检查及 Expo 内容更新：发现更新、下载、由用户重启生效；训练中不强制重启。

## 发布说明

本包未包含授权尚未确认的原书全文、原图及照片，部分动作会显示缺图提示；生成的单人动作示范图随包提供。本版不是完整原书资源版。

发布前已进行自动化检查及云端 Android 构建；实体安卓手机的安装、训练记录与热更新端到端验收尚未完成。详细边界见 [本版说明](RELEASE-NOTES.md)。

训练进阶是基于用户记录的自评辅助，不是自动动作识别；高风险动作需要专业指导。营养和训练建议不替代个体化医疗建议。

## 在线更新

已关联 [Expo 项目 kyirechou/uncover](https://expo.dev/accounts/kyirechou/projects/uncover)。正式包使用 `production` 渠道；测试包使用 `preview` 渠道。上传 GitHub 代码不会自动向手机推送更新，内容更新需要单独发布；新增原生功能仍需安装新版 APK。

详细配置、签名说明和验收清单见 [联网更新说明](docs/ONLINE-UPDATES.md)。

## 本地开发

在现有项目 `calisthenics-app` 中运行：

```bash
npm ci
npm run dev:web
```

电脑打开 `http://localhost:8081/`。局域网手机浏览器可使用电脑 IP 访问对应端口。独立的 `uncover` 脚手架不是本项目，不包含健身功能。

```bash
npm run typecheck
npm run test:domain
npm run test:updates
```

公开源码安装时会生成空的原书资源映射，不覆盖本机已有资料；缺少原书时只跳过对应资源测试。使用 Expo SDK 57、React Native 0.86、TypeScript。

## 数据与版本

个人档案、训练记录默认保存在设备上，不自动同步到云端。当前支持 JSON 导出，尚无导入恢复。位置权限用于前台跑步，尚不支持可靠的后台持续跑步追踪。

[更新记录](CHANGELOG.md) · [历史版本归档](https://github.com/kyirejson/calisthenics-app/releases)
