<div align="center">

<img src="assets/app-icon.png" width="112" alt="涅槃 App 图标" />

# 涅槃

自重训练、周期计划、动作进阶与目标营养，集成在一个 App 里。

**v1.1.0 开发版 · Android / Web**

### [⬇ 下载 v1.0.0 安卓正式版](https://github.com/kyirejson/calisthenics-app/releases/download/v1.0.0/zizhong-jinjie-v1.0.0.apk)

[所有安装包与版本](https://github.com/kyirejson/calisthenics-app/releases) · [更新记录](CHANGELOG.md) · [反馈问题](https://github.com/kyirejson/calisthenics-app/issues)

</div>

> v1.0.0 是首个正式安装包，安装后显示旧名“自重进阶”。`main` 分支已进入 v1.1.0，App 名正式更改为“涅槃”；新版 APK 完成真机验收后会在 Releases 另行发布。

## v1.1.0 开发版已完成

| 模块 | 功能 |
| --- | --- |
| 今日训练 | 根据当前计划和周期自动生成当日课程 |
| 训练计划 | 每周 2–6 练，包含 A/B、上下肢、PPL、力量+有氧；7 天重启从启用当天起算，第 8 天恢复后自动衔接全身三练 |
| 周期控制 | 3 周递增 + 1 周减载，自动调整组数与目标 RIR |
| 进阶与动作 | 17 条进阶路线与 188 个动作合并，支持搜索、分类和风险提示 |
| 晋级判定 | 按升级标准记录次数/秒数/步数/米数，连续两次稳定、无疼痛达标后才能解锁下一式 |
| 今日能量 | 体重下降、减脂塑形、精益增肌、力量表现、健康维持五种目标 |
| 饮食模式 | 均衡家常、高蛋白、适度低碳和生酮，分别计算宏量营养并生成四餐示例 |
| 户外跑步 | 前台 GPS 距离、用时、配速与消耗估算，暂停期间不再累计移动 |
| Android 返回 | 页面逐级返回；训练中先确认；首页再确认退出，不会一按就关闭 |

## 进阶是怎样判定的

1. 进入“进阶”，打开当前动作。
2. 选择“按升级标准训练此动作”，App 会自动带入目标组数与次数或时长。
3. 训练结束时选择真实的动作质量。“有些勉强”或“出现不适”不计入进阶。
4. 同一动作连续两次完成升级标准，进阶页才会出现“解锁下一式”。

高风险动作会显示单独警示。空翻、高阶倒立和爆发动作应在专业指导、保护者与合适场地下练习。

## 安装 v1.0.0 只需三步

1. 用安卓手机点击顶部“下载安卓正式版”。
2. 在浏览器下载列表或文件管理中打开 APK。
3. 如系统提示，允许该浏览器或文件管理器安装应用。

如直接下载失败，进入 [v1.0.0 发布页](https://github.com/kyirejson/calisthenics-app/releases/tag/v1.0.0)，展开 **Assets** 并选择 `zizhong-jinjie-v1.0.0.apk`。`Source code` 是源码压缩包，不是安装包。

## 数据与安全说明

个人档案和训练记录默认保存在本机，不自动同步云端；可通过系统分享导出 JSON 备份。营养热量、宏量营养和食谱均为估算与示例，不替代医生或注册营养师的个体化建议。生酮页面对孕期、肝肾或胰腺疾病、1 型糖尿病以及 SGLT2 类用药人群提供了专门警示。

<details>
<summary>开发者：电脑和手机实时预览</summary>

技术栈：Expo SDK 57、React Native 0.86、TypeScript。动作数据来自原小程序。

### 电脑浏览器

```bash
npm ci
npm run dev:web
```

打开 `http://127.0.0.1:8081/`。修改并保存 `src/` 中的代码后，页面会自动刷新。

同一 Wi-Fi 下，也可以直接在手机浏览器打开 `http://<电脑局域网 IP>:8081/`，无需安装任何调试工具；电脑 IP 可用 Windows 的 `ipconfig` 查看。浏览器适合实时看界面，GPS、震动和 Android 返回键仍应使用 Expo Go 或 APK 验收。

### Android 手机

手机安装 Expo Go，并与电脑连接同一 Wi-Fi：

```bash
npm run dev:phone
```

用 Expo Go 扫描终端二维码。如局域网连接失败，改用 `npm run dev:tunnel`。Web 使用 8081 端口，Expo Go 使用 8082 端口，可以同时运行。

### 质量检查

```bash
npm run typecheck
npx expo-doctor
npx expo export --platform android
```

GitHub 的 **Actions → Build Android APK** 可手动生成新的独立测试安装包，不会覆盖 v1.0.0 正式发布页。

</details>
