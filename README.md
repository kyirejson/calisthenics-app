<div align="center">

<img src="assets/app-icon.png" width="112" alt="自重进阶 App 图标" />

# 自重进阶

从第一次训练开始，记录你的每一步进阶。

**v1.0.0 · 首个正式发布版 · Android**

### [⬇ 下载安卓安装包（约 66 MB）](https://github.com/kyirejson/calisthenics-app/releases/download/v1.0.0/zizhong-jinjie-v1.0.0.apk)

[版本发布页](https://github.com/kyirejson/calisthenics-app/releases/tag/v1.0.0) · [更新记录](CHANGELOG.md) · [反馈问题](https://github.com/kyirejson/calisthenics-app/issues)

手机直接下载安装，安装后无需电脑或 Expo Go。

</div>

## 安装只需三步

1. 用安卓手机点击上方「下载安卓安装包」。
2. 在浏览器下载列表或文件管理中打开下载的 APK。
3. 如系统提示，允许该浏览器或文件管理器安装应用，然后完成安装。

首次打开后填写个人资料、选择训练目标与每周频率，即可开始使用。

如果下载按钮无法打开，可进入[版本发布页](https://github.com/kyirejson/calisthenics-app/releases/tag/v1.0.0)，展开 **Assets**，选择 `zizhong-jinjie-v1.0.0.apk`。Source code 是源码压缩包，不是安装包。

## v1.0.0 可以做什么

| 模块 | 功能 |
| --- | --- |
| 今日训练 | 个人建档、按每周频率安排训练、休息日临时加练 |
| 训练记录 | 逐组填写次数、完成打卡、组间倒计时与震动反馈 |
| 动作库 | 188 个动作，分类搜索、动作要点、常见问题和进阶标准 |
| 训练统计 | 累计次数、时长、近七天记录与当前六艺等级展示 |
| 户外跑步 | 前台 GPS 测距、计时、平均配速与热量估算 |
| 能量概览 | 按个人资料与目标估算热量和三大营养素 |
| 本地数据 | 保存档案和训练记录，通过系统分享导出 JSON 备份 |

## 数据与版本说明

个人资料和训练记录默认保存在本机，不自动同步到云端。动作图片需要联网加载。微信小程序历史记录暂不支持直接导入。

这是本项目首次正式发布。当前 APK 沿用首次构建的默认测试签名，已通过类型检查与云端 APK 构建，尚未完成真机验收。发布名称不代表已完成专属签名配置或应用商店审核。

跑步当前仅支持前台定位，暂停计距仍有已知问题，暂不建议用于精确运动记录。原小程序的周期计划引擎、自定义计划、完整食谱、报告、备份导入和训练中断恢复尚未迁移。iOS 暂未提供安装包。

详细信息见[版本说明](RELEASE-NOTES.md)。遇到问题可在 [Issues](https://github.com/kyirejson/calisthenics-app/issues) 中提供手机型号、系统版本和复现步骤。

<details>
<summary>开发者：本地运行与构建</summary>

技术栈：Expo SDK 57、React Native 0.86、TypeScript。动作数据来自原小程序。

### 电脑浏览器实时预览

```bash
npm run dev:web
```

浏览器打开后，修改并保存 `src/screens` 中的页面，界面会自动刷新。浏览器适合调布局；GPS、震动和系统权限需要在安卓手机上检查。

### 安卓手机实时预览

手机安装 Expo Go，并与电脑连接同一 Wi-Fi，然后运行：

```bash
npm run dev:phone
```

用 Expo Go 扫描终端二维码。修改代码并保存后，手机会自动刷新。如果局域网连接失败，改用：

```bash
npm run dev:tunnel
```

Web 预览使用 8081 端口，Expo Go 使用 8082 端口，两种预览可以同时运行。

主要页面源码位于 `src/screens/`，公共组件位于 `src/components/`，配色位于 `src/theme.ts`。

### 安装与检查

```bash
npm ci
```

```bash
npm run typecheck
npx expo-doctor
npx expo export --platform android
```

Actions → Build Android APK 可手动生成后续测试包，该流程不会覆盖 v1.0.0 正式发布页。

</details>
