# 营养服务部署

当前配置用于 Render 免费实例的联网验收，不代表已经完成正式上线。

1. 登录 [Render](https://dashboard.render.com)，选择 **New → Blueprint**，连接 `kyirejson/calisthenics-app`，分支选择 `main`。仓库根目录已提供 `render.yaml`。
2. 在创建页面填写 `DEEPSEEK_API_KEY`：先在 DeepSeek 控制台撤销曾发到聊天中的旧密钥，再创建新密钥。仅在 Render 填写，不写入仓库、APK 或聊天。
3. 确认实例为 **Free**，点击 **Deploy Blueprint**。服务显示 Live 后复制其 `https://….onrender.com` 地址。
4. 打开该地址的 `/health`，应返回 `configured: true`。这只验证服务启动和密钥配置，仍需实际验证问答、拍照与条码接口。
5. 将服务地址配置为 EAS production 环境的 `EXPO_PUBLIC_NUTRITION_API_URL`，然后构建新版 Android APK。该变量只有公开 URL，不能包含密钥。

本机网页访问公网服务时，在 Render 增加 `NUTRITION_ALLOWED_ORIGINS=http://127.0.0.1:8081,http://localhost:8081`，并在本机开发环境设置同一服务 URL、重启 Expo。正式原生 APK 不需要这两个网页来源。

## 发布边界

- 免费实例闲置会休眠，首次请求可能等待约一分钟；不是常驻生产级保证。AI 调用费用独立于服务器费用。
- 请求体、并发和调用频率均受限；限额在内存中，重启会重置。目前没有账户鉴权、持久额度与付费风控，不应视作企业级开放服务。
- 图片和个人档案不会在该服务落盘；设备端记录也不会因此获得云备份。
- 私有原书索引不在公开仓库中。云端默认仅包含公开营养知识规则，不能宣称已部署完整囚徒健身原文知识库。
- 自动代码部署已关闭；后续服务代码更新需在 Render 手动部署，避免上传源码即改变线上行为。
