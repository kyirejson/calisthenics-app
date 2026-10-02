# 营养服务部署

已部署 `https://uncover-nutrition-api.onrender.com`。2026-09-30 已验证真实问答记餐草案、食材识别、标签抄录与条码查询；不等同于多用户生产安全和真机验收完成。

2026-10-02 已更新至服务 1.5.0/Harness V2，实际营养模型问答通过。囚徒知识库已通过 Secret File 配置并验证加载 1,368 个检索片段，原书问答返回书名及行号出处。施瓦辛格来源已移除。

1. 登录 [Render](https://dashboard.render.com)，选择 **New → Blueprint**，连接 `kyirejson/calisthenics-app`，分支选择 `main`。仓库根目录已提供 `render.yaml`。
2. 在创建页面填写 `DEEPSEEK_API_KEY`：先在 DeepSeek 控制台撤销曾发到聊天中的旧密钥，再创建新密钥。仅在 Render 填写，不写入仓库、APK 或聊天。
3. 确认实例为 **Free**，点击 **Deploy Blueprint**。服务显示 Live 后复制其 `https://….onrender.com` 地址。
4. 打开该地址的 `/health`，应返回 `configured: true`。这只验证服务启动和密钥配置，仍需实际验证问答、拍照与条码接口。
5. EAS production 的 `EXPO_PUBLIC_NUTRITION_API_URL` 已设置为上述服务地址。后续更换地址时需同步修改该环境变量，并重新构建或发布兼容内容更新。该变量只有公开 URL，不能包含密钥。

本机网页访问公网服务时，在 Render 增加 `NUTRITION_ALLOWED_ORIGINS=http://127.0.0.1:8081,http://localhost:8081`，并在本机开发环境设置同一服务 URL、重启 Expo。正式原生 APK 不需要这两个网页来源。

## 私密囚徒知识库

在服务的 Environment → Secret Files 新增 `prisoner-index.json.gz.b64`，内容来自被 Git 忽略的本机 `server/private/prisoner-index.json.gz.b64`。设置 `NUTRITION_PRISONER_INDEX=/etc/secrets/prisoner-index.json.gz.b64`，保存并重新部署。不要将文件内容提交公开仓库或打入客户端安装包；Render Secret Files 合计上限为 1 MB。

部署后 `/health` 应返回 `readiness: "ready"`、`knowledge.prisoner.available: true` 及预期片段数；仍须实际提问并检查 `references` 的书名和行号。当前 Render 集成支持环境变量和部署，不支持直接上传 Secret File，文件上传需在 Dashboard 完成。环境变量更新接口会自动触发部署，避免紧接着重复部署。

## 发布边界

- 免费实例闲置会休眠，首次请求可能等待约一分钟；不是常驻生产级保证。AI 调用费用独立于服务器费用。
- 请求体、并发和调用频率均受限；限额在内存中，重启会重置。目前没有账户鉴权、持久额度与付费风控，不应视作企业级开放服务。
- 图片和个人档案不会在该服务落盘；设备端记录也不会因此获得云备份。
- 私有原书索引不在公开仓库中。全新服务默认仅包含公开营养知识规则，需要单独配置 Secret File；本服务已验证囚徒索引加载，不等于公开分发原书资源或完成内容专业审核。
- 自动代码部署已关闭；后续服务代码更新需在 Render 手动部署，避免上传源码即改变线上行为。
