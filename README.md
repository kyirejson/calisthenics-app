# 自重进阶 App

由 `miniprogram-calisthenics` 迁移而来的 Android / iOS 原生跨平台项目，技术栈为 Expo SDK 57、React Native 0.86 和 TypeScript。

## 已迁移功能

- 首次建档：身体数据、目标、每周训练频率
- 今日训练：按星期自动排课、休息日与临时加练
- 完整训练流程：逐组次数、完成打卡、组间倒计时、震动提示
- 进阶统计：累计训练、动作总量、近七天趋势、六艺等级
- 188 个动作：分类、搜索、详情、动作要点、常见问题、进阶标准
- 户外跑步：手机 GPS 测距、计时、平均配速和热量估算
- 营养概览：根据个人资料、训练频率和目标估算热量与三大营养素
- 本地数据：训练记录、用户档案、偏好设置和 JSON 系统分享备份
- Android / iOS 权限、App 图标和应用标识配置

原小程序目录没有被修改。动作库数据从原项目复制至 `src/data/legacy`，保持同一份动作名称、分级和训练说明。

## 本地运行

```bash
npm install
npm start
```

终端出现二维码后：

- Android：使用 Expo Go 扫码，或按 `a` 启动已配置的模拟器。
- iOS：使用 Expo Go 扫码；iOS 本机构建需要 macOS / Xcode。
- GPS 跑步请在实体手机上测试，模拟器通常不会持续产生真实位移。

## 检查与构建

```bash
npm run typecheck
npx expo-doctor
npx expo export --platform android
```

生成可安装包需登录 Expo 账号并使用 EAS：

```bash
npx eas-cli build --platform android
npx eas-cli build --platform ios
```

## 数据说明

App 采用 AsyncStorage 离线保存数据，默认不上传云端。微信小程序与手机 App 属于不同系统沙箱，因此无法自动读取微信里的历史数据；需要从小程序导出 JSON 后，再为 App 接入文件导入流程。当前版本支持从“我的 → 导出 JSON 备份”分享手机端数据。
