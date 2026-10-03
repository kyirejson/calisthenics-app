<div align="center">

<img src="assets/app-icon.png" width="112" alt="Uncover App 图标" />

# Uncover

永不言弃，积极向上，奋斗终生。

**v1.6.0 · Android**

[下载安卓安装包](https://github.com/kyirejson/calisthenics-app/releases/download/v1.6.0/uncover-v1.6.0.apk) · [正式版发布页](https://github.com/kyirejson/calisthenics-app/releases/tag/v1.6.0) · [反馈问题](https://github.com/kyirejson/calisthenics-app/issues)

</div>

## 安装

用安卓手机下载 APK 并打开，按系统提示允许安装即可。无需 Expo Go，也无需连接电脑。独立的专属签名用于本版及后续版本；历史测试包不再作为默认下载入口。

## 功能

- 今日课程、周日历与全年日程查看；支持减肥控重、街头健身及器械训练专题。
- 器械动作库细分肌群、增肌推荐等级；三种训练分化提供周训练量及肌群覆盖审计，不按单次时长裁剪课表。
- 动作分类、阶数选择、步骤指导和基于训练记录的进阶辅助。
- 逐组打钩记录、加组、追加动作、重置当天训练和删除历史；没有勾选的力量训练不记入历史。
- 今日饮食、摄入与体重趋势图；食品库、自定义食品与包装营养标签录入。
- 个人助手 Harness V2：可拖动贴边入口、分专题档案、长期对话归档和按需召回；长按系统语音、记餐草案、训练顺延／交换、营养偏好与忌口记录。支持餐次选填与“没吃”状态，回复不设 50 字限制。默认先确认，也可选择完全访问；工具执行仍受本机参数和权限校验约束。
- 同一相机入口识别食材、包装标签和商品条码；查库核算营养，份量与用油需核对，照片可保存在本机。
- 前台 GPS 跑步路线、距离与配速，本机数据统计与 JSON 导出。
- GitHub 新版 APK 检查及 Expo 内容更新：发现更新、下载、由用户重启生效；训练中不强制重启。

## 发布说明

本包未包含授权尚未确认的原书全文、原图及照片，部分动作会显示缺图提示；生成的单人动作示范图随包提供，器械写实示范图并非真人拍摄。施瓦辛格来源已移除，囚徒私有全文索引不进入本包。本版不是完整原书资源分发版，公开知识库仍在准备中。

已通过 TypeScript、585 项测试、公开资源过滤后的 Android JS 导出、原生 EAS 构建及 APK 专属签名核验。公开下载文件完整性已校验。实体手机安装、语音、输入法、相机、GPS 与更新全过程仍需验收；自动化模拟服务不代表用户真实 Key 可用。详细边界见 [本版说明](RELEASE-NOTES.md) 与 [发布核验](docs/release-v1.6.0-2026-10-03.md)。

本版不依赖开发者的 Render 后端。请在个人助手的连接设置中填写自己的 DeepSeek＋Tavily 或智谱 Key，在线聊天和搜索费用由服务商向用户计收；未配置时保留本地功能。当前智谱接入仅为文本聊天和搜索，不能据此宣称支持照片识别。申请步骤见 [自带 API Key 指南](docs/user-api-key-guide-2026-10-03.md)。

训练进阶是基于用户记录的自评辅助，不是自动动作识别；高风险动作需要专业指导。营养和训练建议不替代个体化医疗建议。

## 在线更新

已关联 [Expo 项目 kyirechou/uncover](https://expo.dev/accounts/kyirechou/projects/uncover)。正式包使用 `production` 渠道；测试包使用 `preview` 渠道。上传 GitHub 代码不会自动向手机推送更新，内容更新需要单独发布；新增原生功能仍需安装新版 APK。

v1.6.0/build 8 新增 SecureStore 与个人助手原生入口，需要覆盖安装新版 APK，不能只向旧包推送内容更新。沿用专属签名，更新前建议导出本机数据，并覆盖安装而不卸载旧版。

详细配置、签名说明和验收清单见 [联网更新说明](docs/ONLINE-UPDATES.md)。

## 本地开发

本机开发使用 `npm run dev:nutrition`，当前服务密钥仅放在被忽略的 `server/.env`／`server/.env.local`；不得内置共享 API 密钥。当前开发方向不要求 Render，既有发布版本的部署说明仅作为历史配置参考。

2026-10-03 的个人助手及卡点优化已编入 v1.6.0 安装包，Android 系统入口已完成原生云编译；真机验收仍待完成。详细能力与限制见 [个人 Agent 实现说明](docs/personal-agent-implementation-2026-10-03.md)。iOS 尚未编译或发布。

用户模型／搜索密钥由个人助手的连接设置管理，手机默认官方直连；密钥采用系统安全存储，不进入聊天和数据导出。Web 只在页面内存保留密钥，支持本地开发网关。默认“保存并验证”提前披露一次模型请求与费用，同时保留仅保存。真实账户能力和费用须由用户核验；不公开版权原书全文、私密索引、私有唤醒模型或个人记忆。

本版的长按语音、键盘适配、未知菜品确认、顺延／交换分离、可拖动吸附入口、设置返回恢复、搜索及多食品离线解析见 [最新验收说明](docs/personal-agent-implementation-2026-10-03.md)。直连搜索使用所选服务商的用户密钥，自托管 Tavily 服务使用 `TAVILY_API_KEY`；接口存在不代表用户的真实搜索账户已配置或通过测试。

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

个人档案、训练／饮食记录、助手记忆及照片保存在本机，不自动云同步，卸载可能丢失。当前支持 JSON 导出，尚无导入恢复。联网识图和问答须取得用户同意，可撤销授权。位置权限用于前台跑步，尚不支持可靠的后台持续跑步追踪。

[更新记录](CHANGELOG.md) · [历史版本归档](https://github.com/kyirejson/calisthenics-app/releases)
