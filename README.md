<div align="center">

<img src="assets/app-icon.png" width="112" alt="Uncover App 图标" />

# Uncover

永不言弃，积极向上，奋斗终生。

**v1.5.0 · Android**

[下载安卓安装包](https://github.com/kyirejson/calisthenics-app/releases/download/v1.5.0/uncover-v1.5.0.apk) · [正式版发布页](https://github.com/kyirejson/calisthenics-app/releases/tag/v1.5.0) · [反馈问题](https://github.com/kyirejson/calisthenics-app/issues)

</div>

## 安装

用安卓手机下载 APK 并打开，按系统提示允许安装即可。无需 Expo Go，也无需连接电脑。独立的专属签名用于本版及后续版本；历史测试包不再作为默认下载入口。

## 功能

- 今日课程、周日历与全年日程查看；支持减肥控重、街头健身及器械训练专题。
- 器械动作库细分肌群、增肌推荐等级；三种训练分化提供周训练量及肌群覆盖审计，不按单次时长裁剪课表。
- 动作分类、阶数选择、步骤指导和基于训练记录的进阶辅助。
- 逐组打钩记录、加组、追加动作、重置当天训练和删除历史；没有勾选的力量训练不记入历史。
- 今日饮食、摄入与体重趋势图；食品库、自定义食品与包装营养标签录入。
- 公网营养助手 Harness V2：分专题个人档案、长期对话归档和按需召回；文字／系统语音记餐草案、营养偏好与忌口记录、50 字以内回复。默认先确认，也可选择完全访问；工具执行仍受本机参数和权限校验约束。
- 同一相机入口识别食材、包装标签和商品条码；查库核算营养，份量与用油需核对，照片可保存在本机。
- 前台 GPS 跑步路线、距离与配速，本机数据统计与 JSON 导出。
- GitHub 新版 APK 检查及 Expo 内容更新：发现更新、下载、由用户重启生效；训练中不强制重启。

## 发布说明

本包未包含授权尚未确认的原书全文、原图及照片，部分动作会显示缺图提示；生成的单人动作示范图随包提供，器械写实示范图并非真人拍摄。囚徒原书检索通过后端私密索引提供，施瓦辛格来源已移除。本版不是完整原书资源分发版。

已完成自动化检查、Android 云端构建及 APK 签名核验；公网服务已更新为 1.5.0/Harness V2，实际营养问答和囚徒知识库检索已验证。图片识别、营养标签与商品条码接口曾在 1.4.0 发布时验证，本次未重复全量线上识图测试。实体安卓手机的安装、相机、语音、GPS 与更新全过程仍需验收。详细边界见 [本版说明](RELEASE-NOTES.md)。

营养服务使用免费 Render 实例，闲置后首次请求可能较慢；当前没有多用户账户鉴权、持久化额度和云备份，不代表企业级服务已经完成。

训练进阶是基于用户记录的自评辅助，不是自动动作识别；高风险动作需要专业指导。营养和训练建议不替代个体化医疗建议。

## 在线更新

已关联 [Expo 项目 kyirechou/uncover](https://expo.dev/accounts/kyirechou/projects/uncover)。正式包使用 `production` 渠道；测试包使用 `preview` 渠道。上传 GitHub 代码不会自动向手机推送更新，内容更新需要单独发布；新增原生功能仍需安装新版 APK。

v1.5.0/build 6 新增 SQLite 原生依赖，需要安装新版 APK，不能只向旧安装包推送内容更新。沿用专属签名，更新前建议导出本机数据，并覆盖安装而不卸载旧版。

详细配置、签名说明和验收清单见 [联网更新说明](docs/ONLINE-UPDATES.md)。

## 本地开发

营养服务配置与上线边界见 [Render 部署说明](docs/RENDER-DEPLOY.md)。本机开发使用 `npm run dev:nutrition`，密钥仅放在被忽略的 `server/.env`；前端不得保存 API 密钥。

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
