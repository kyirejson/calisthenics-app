# Uncover 产品设计与安排依据

## 界面设计

核心顺序是“先做什么，再看为什么”：今日页提供训练目标与今日课程；计划页只展示当前课程的七天安排和可展开的训练依据；进阶页把路线与动作放在同一个列表；训练中随时可打开完整动作指导。墨绿、荧光绿和暖白延续到图标，减少装饰性文案，把动作、组数、休息、风险和下一步放在前面。

图标通过内置图像生成工具制作，成品位于 `assets/app-icon.png`，网页小图标位于 `assets/favicon.png`。最终提示词为：

> Original visual mark for a fitness and self-improvement app named Uncover, conveying never giving up, optimism, and lifelong effort. A single bold geometric ascending path emerges from an open U-shaped negative space, ending in a subtle upward breakthrough. Minimal flat vector-like logo, crisp edges, strong silhouette, premium contemporary sports-wellness brand. Centered symbol with ample safe margin for Android adaptive icon circular crop. Near-black deep green background (#151712), bright fresh lime symbol (#C6EF56). No text, letters, wordmark, border, mockup, watermark, 3D, gradients, shadows, textures, human, dumbbell, flame, phoenix, mountain, or generic fitness clip art.

## 训练为何这样安排

当前有 **7 套内部课程模板**，不是 7 套同时要求用户执行的计划：每周两练、零基础七天起步、每周三练、减脂四练、力量四练、增肌五练和高阶六练。选择依据是用户在档案中填写的目标、经验和可训练天数。首页改目标后，系统据此匹配一套课程；计划页只显示这套课程的日期、当天动作和恢复安排。

每周至少两次力量训练和逐步增加负荷的方向参考 [CDC 成人活动建议](https://www.cdc.gov/physical-activity-basics/guidelines/adults.html) 与 [ACSM 2026 抗阻训练立场声明概览](https://www.acsm.org/wp-content/uploads/2026/03/Resistance-Training-Position-Stand-infographic.pdf)。A/B 全身课、上下肢分化和 PPL 则是为了在不同训练频率下重复刺激主要肌群，同时留出恢复日。减脂四练额外安排一次可对话强度有氧；这**不等于**整周有氧量已经达到 CDC 的 150 分钟建议。

“三周适应/积累/强化 + 一周减载”的组数和余力安排是 App 的保守训练节奏，并非每个人都必须采用、也不宣称它优于其他周期。疼痛、睡眠不足或恢复欠佳时应降低强度或停止训练。进阶由专项记录辅助：同一动作两次按标准自评完成、相隔至少 24 小时且无疼痛，才可手动解锁；这不是摄像头动作识别或医疗级评估。

## 饮食为何这样安排

成人基础能量用 [Mifflin–St Jeor 预测公式](https://pubmed.ncbi.nlm.nih.gov/2305711/)估算，再根据每周训练频率估算维持消耗。体重下降、减脂、增肌、力量表现和维持分别设置不同的能量方向；训练日与恢复日会重新分配摄入，但保持一周平均目标。蛋白质按目标与参考体重计算，碳水/脂肪再随均衡、高蛋白、适度低碳和生酮模式调整。餐食是按目标缩放的组合示例，标注的每餐 kcal 是预算，**不是食材的实测营养值**。

频率推算活动系数、目标百分比、四餐份量及 20–40 g 生酮碳水都是产品初始估计，不能替代个体评估。未成年人、资料异常或 BMI 偏低者不显示个性化热量目标；[NIDDK 体重规划工具](https://www.niddk.nih.gov/health-information/weight-management/body-weight-planner)同样限定成人使用。孕哺期、特定疾病或用药者不应自行开始生酮。用户应观察至少两周体重趋势、饥饿感与训练表现，再调整摄入。

## 动作资源边界

188 个动作均保留小程序里的来源章节、结构化要点、易错点和进阶标准。App 不把某些只有章节论述、缺独立步骤的书籍全文标成完整指导；远程图片失败时显示清楚的文字占位，复用图片标明“参考图”。未经权利确认，不把原书全文和照片重新复制到公开仓库。

## 联网能力分期

本版 Android App 在打开时检查公开 GitHub Release，发现更高的 Android versionCode 才提示下载；“我的”可手动重试。它需要联网，但不是系统后台推送，也不能静默安装 APK。[GitHub Releases API](https://docs.github.com/en/rest/releases/releases) 提供版本信息。

以后可以接入 [Expo EAS Update](https://docs.expo.dev/eas-update/introduction/) 发布兼容的 JS/资源更新；原生依赖和权限变化仍需重装 APK。真正的系统推送需要 FCM/服务端。开放用户发视频、文字的社区还需要账号、数据库、视频存储、举报、屏蔽、删除与持续审核；上线前须确定预算、隐私规则和治理责任，不能只做一个本地“社区”假页面。
