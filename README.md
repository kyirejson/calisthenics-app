<div align="center">

![Uncover · 记录每一组，看见每一步](docs/media/banner.svg)

# Uncover · 自重训练 APP

**自重健身 / 街头健身 · 训练计划 · 逐组记录 · 跑步 · 饮食 · MAX AI 助手**

永不言弃，积极向上，奋斗终生。

[![Android](https://img.shields.io/badge/Android-arm64--v8a-E87740?style=flat-square&logo=android&logoColor=white)](https://github.com/kyirejson/calisthenics-app/releases/latest)
[![Release](https://img.shields.io/github/v/release/kyirejson/calisthenics-app?style=flat-square&color=E87740&label=最新版本)](https://github.com/kyirejson/calisthenics-app/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/kyirejson/calisthenics-app/total?style=flat-square&color=576B67&label=下载)](https://github.com/kyirejson/calisthenics-app/releases)
[![React Native](https://img.shields.io/badge/React_Native-Expo-20272C?style=flat-square&logo=react&logoColor=61DAFB)](docs/DEVELOPMENT.md)

[**下载安卓 APK**](https://github.com/kyirejson/calisthenics-app/releases/latest) · [功能介绍](#从训练计划到每一组记录) · [安装使用](#安装使用) · [反馈问题](https://github.com/kyirejson/calisthenics-app/issues)

简体中文 / Chinese · Android · Calisthenics / Bodyweight Workout / Street Workout

</div>

## 从训练计划到每一组记录

**Uncover**（自重训练 APP，早期名称“自重进阶”）是一款将自重训练、健身计划、训练记录与进阶辅助放在一起的安卓应用。你可以安排今日训练、逐组记录完成情况、继续未结束的训练，并回看历史；饮食、体重和跑步记录帮助你整理训练之外的日常数据。

| 模块 | 主要功能 |
| --- | --- |
| **今日训练** | 街头健身、自重训练、减肥控重与器械专题，日期清单、计划配置、固定开始入口 |
| **动作学习** | 动作分类、步骤、原文与配图阅读，训练时查看动作细节 |
| **逐组记录** | 完成组、休息计时、未完成会话续练，基于真实记录的进阶辅助 |
| **历史与进展** | 训练日历、逐日历史、体重趋势，单次或整日记录管理 |
| **饮食记录** | 今日饮食、已有餐食与照片、营养目标估算；可由助手添加、更正或删除记录 |
| **跑步** | 地图轨迹、距离与配速、公里分段、目标与倒计时、专注模式和保存总结 |
| **MAX AI 助手** | 用户配置 DeepSeek API，文本附件、个人记忆、知识检索及获授权的手机操作工具 |

### MAX：围绕你的训练记录协作

- **文本与语音**共用上下文和工具，可通过本地 “Max / Hey Max” 唤醒，支持说话打断。
- **按需读取**个人记忆、训练、体重和饮食记录，调用工具完成已支持的记录操作。
- **知识检索**可读取已收录资料；动作详情保留原文与配图，APP 不提供整库浏览入口。
- **安卓手机工具**在用户单独授权后使用读屏、点击、输入和滚动；音乐另有媒体控制工具，可选 Shizuku 支持。

使用助手需自行配置可用 API Key，模型调用由所配置服务计费。锁屏唤醒、蓝牙音频、系统权限与不同厂商 ROM 的效果以设备实测为准，不能保证所有手机表现相同。

## 安装使用

1. 前往 [最新正式版](https://github.com/kyirejson/calisthenics-app/releases/latest)，在 **Assets** 下载 APK。
2. 在 **ARM64 安卓手机**上打开并安装；独立安装包不依赖 Expo Go。
3. 打开后可直接开始安排训练，也可在“我的”填写档案；使用 MAX 时再配置模型服务和所需授权。

当前正式版本以 [Releases](https://github.com/kyirejson/calisthenics-app/releases/latest) 为准。手机正式包只包含 `arm64-v8a`，不适用于旧 ARM32 手机和 x86 模拟器；目前未提供正式 iOS 安装包。

更新时直接覆盖安装，保留本机记录。应用支持检查 GitHub 安装包及 Expo 内容更新；涉及原生模块或权限的变更需要安装新版 APK。上传源码本身不会自动更新所有手机。

### 常见问题

**只能在健身房使用吗？** 自重与街头健身是主要使用方向，同时包含器械专题；可按自己的条件配置计划。

**训练中途退出怎么办？** 未结束的会话支持从剩余组续练；明确结束后再次训练会新增会话。

**跑步必须联网吗？** 地图底图需要联网加载，GPS 记录不以底图加载成功为前提。浏览器只支持前台定位，安卓使用用户启动的定位前台服务。

**数据会自动同步到云端吗？** 档案、训练、饮食、跑步记录与照片主要保存在本机，不自动云同步，卸载可能丢失。被助手读取的记忆、资料和附件会随请求发送到用户配置的模型服务。

## 本地开发

技术栈为 **Expo、React Native、TypeScript**。在已安装 Node.js 与 npm 的开发环境运行：

```bash
npm ci
npm run dev:web
```

浏览器默认地址为 `http://localhost:8081/`。检查代码与回归测试：

```bash
npm run check
```

安卓原生语音资源、公开资料准备和打包流程见 [开发与功能说明](docs/DEVELOPMENT.md)。浏览器预览不等于安卓原生功能验收；模拟器需显式构建对应架构。

| 文档 | 内容 |
| --- | --- |
| [开发与功能说明](docs/DEVELOPMENT.md) | 本地运行、功能细节、原生语音资源、资料范围与验证边界 |
| [架构说明](docs/ARCHITECTURE.md) | 模块职责、平台边界与数据流 |
| [联网更新说明](docs/ONLINE-UPDATES.md) | 正式与测试渠道、签名和更新流程 |
| [开发工具说明](scripts/README.md) | 检查命令与隔离浏览器脚本 |
| [更新记录](CHANGELOG.md) | 功能变更与历史说明 |

仓库保留现有 [LICENSE](LICENSE)；第三方代码、语音资源、原文与图片的来源和分发范围见开发文档及随包许可。训练与营养估算用于记录和参考。

## English overview

**Uncover** is a Chinese-language **Android calisthenics and bodyweight workout app** built with **React Native, Expo and TypeScript**. It includes workout plans, set-by-set training logs, rest timers, resumable sessions, progress history, running GPS tracking, nutrition records, and **MAX**, an optional AI assistant using a user-configured DeepSeek API key. Download the **ARM64 Android APK** from [GitHub Releases](https://github.com/kyirejson/calisthenics-app/releases/latest). Records are stored locally; there is no automatic cloud sync or official iOS release.

---

同一作者的另一款应用：[造化元钥 · 命理排盘 APP](https://github.com/kyirejson/mingli-paipan) — 八字、紫微斗数、奇门遁甲、六爻与梅花易数。
