# MAX 手机跨应用控制：调研与可实施方案

调研日期：2026-10-16。范围：Android / OPPO Find X8 Pro，ColorOS 16.0.10。
本文保留实施前的调研状态，不代表现行功能规格。后续源码已接入独立授权的通用执行层与本机 OCR；当前实现和真实验收状态见 [实现记录](max-phone-control-implementation-2026-10-16.md)。

## 结论

可以从“只控制音乐”扩展为“通过 MAX 打开手机中已安装、可启动的 App”，再逐步实现这些 App 内的操作。两者不是同一级能力：启动应用通常使用系统 Intent；应用内任务优先使用目标 App 的公开接口，缺少接口才考虑用户授权的界面自动化。Android 明确支持通过 Intent 启动其他 App 的 Activity。[Android 跨应用交互](https://developer.android.com/training/basics/intents)

不能承诺所有 App、任何系统状态下都能无感后台操作。锁屏、登录、系统确认、受保护窗口、目标应用实现及系统后台策略都是实际约束。Android 的后台 Activity 启动存在限制和特定例外，不能把“有前台服务”视作任意弹出第三方 App 的许可。[Android Activity 安全与后台启动](https://developer.android.com/guide/components/activities/secure-bal)

浏览器预览不能直接操作手机中的其他 App；这部分应由 Android 原生模块执行。

## 当前项目实际能力

代码检查，而非仅根据聊天回复推断：

- `MusicPolicy.kt` 的包名映射只有网易云音乐和 QQ 音乐；链接校验也属于这两家。
- `uncover_music_accessibility.xml` 的 `packageNames` 只声明这两个包。
- `MusicAccessibilityService.kt` 同时检查独立的音乐界面授权、目标包、真实窗口、显示器和节点快照；密码节点不返回给模型。
- `MusicActivityLauncher.kt` 的后台启动也限定音乐目标及已授权虚拟显示器。后台窗口不可用时，不会悄悄切到用户主屏幕操作。

因此，当前还没有“通用手机控制”。不能简单删除音乐白名单就宣称做完：原授权说明、工具参数、窗口归属、失败回执和测试范围都必须同步设计。

## 建议实现：同一个模型，新增通用执行工具

沿用 MAX 当前的对话模型和工具循环，不增加关键词意图分类器，不把每个 App 的工作流写死。模型负责理解用户、选 App、规划步骤和判断任务完成；代码负责提供真实能力、授权检查、执行与回执。

| 层次 | 建议工具 | 执行依据 |
| --- | --- | --- |
| 找 App | `find_apps(query)` | 本机已安装的可启动应用、名称和实际包名；重名时提供候选 |
| 打开 App | `open_app(packageName, operationKey)` | 真实可启动 Activity；区别“系统已接受启动”与“已观察到目标应用” |
| 直接办事 | `invoke_app_action(...)` | 已发现的系统 Intent、验证过的 App Link / 官方接口，不虚构私有 URL |
| 观察界面 | `read_app_screen(sessionId)` | 用户授权任务中的实际包、显示器、窗口和节点快照 |
| 操作并复核 | `app_ui_action_and_observe(...)` | 当前快照节点 / 手势及新状态；不把一次点击当作任务成功 |

App 查找在本机进行，只向模型返回当前查找所需的候选，避免把整份安装列表默认上传。Android 11 起软件包可见性受过滤，应按用途声明 `<queries>`；不要因为做启动器就默认索取 `QUERY_ALL_PACKAGES`。[软件包可见性](https://developer.android.com/training/package-visibility)

### 接口优先，界面兜底

打开浏览器、地图、拨号界面或目标应用公开页面，优先使用系统或官方协议，减少模型读取和点击的步骤。没有对应接口时，才在用户授权的应用任务范围内读取真实界面，执行点击、滚动、文本填写等。Android 无障碍 API 支持窗口读取、节点操作及经声明的手势派发，但不等于获得第三方 App 的私有数据库、密码或无限系统权限。[AccessibilityService API](https://developer.android.com/reference/android/accessibilityservice/AccessibilityService)

节点不足的页面可后续补截图/视觉工具，但必须另行明确截图会发送到哪家模型服务，并验证实际使用的模型支持图像。当前不能把文本节点读取包装成已具备通用视觉控制。

Android 16 的 AppFunctions 也是可研究的直接调用路径，但目标 App 必须暴露功能，调用端还需相应权限和设备支持；不能假设把 MAX 设成默认助手就能调用所有 App。它适合作为可用时的增强，不作为首版唯一依赖。[AppFunctions 官方说明](https://developer.android.com/ai/appfunctions)

### 复用已有可靠机制，不复制一套音乐代码

复用现有工具循环、取消代次、操作回执、窗口节点快照和事件驱动等待；抽取不依赖音乐提供方的执行基础层，音乐专用 MediaSession 和歌单能力保留在音乐模块。

每次任务绑定用户授权的目标 App / 显示器 / 有效会话。应用切换、授权撤销、节点过期或任务取消后，旧动作不能继续执行。已经成功的发送、创建等副作用凭操作标识返回原回执，不能因重试重复执行；状态查询和必要的新观察仍可继续。

页面、搜索结果和第三方消息都只是观察数据，不是用户给予的新操作指令。支付、删除、对外发送等高影响动作需核对用户明确意图；不绕过锁屏、验证码、密码、系统授权或生物认证。这里检查的是实际权限和执行事实，不用本地关键词替代模型理解。

## 前台、后台与授权

首版先验收可见的前台任务，并提供随时停止。后台虚拟屏幕是可选增强，需要逐 App 验证；不能把网易云已通过的路径外推为所有 App 均可用。

Shizuku 可帮助通过用户主动启用的 ADB / root 服务使用部分系统接口，但普通无线调试启动对应 shell 身份，并不自动变成 root，也不提供无限权限。UserService 的上下文和系统 API 能力同样存在限制。[Shizuku API 官方说明](https://github.com/RikkaApps/Shizuku-API)、[Shizuku 项目说明](https://github.com/RikkaApps/Shizuku)

从音乐扩展到其他应用属于授权用途变化，应新增独立说明、应用范围选择和撤销入口，不能把此前“仅网易云 / QQ 音乐”的同意视为全机读取许可。

## 分发约束，不能回避

目前 Google Play 的无障碍政策明确限制普通应用通过 Accessibility API 自主发起、规划和执行操作；普通语音助手也不能仅因对部分用户有帮助就自称残障辅助工具取得豁免。因此，基于模型自主界面操作的通用 Agent 路线不能直接宣称满足 Play 上架要求；现有音乐自主界面控制也需要按同一规则审查。自主分发 APK 与 Play 审核是不同问题；自主分发仍须遵守 Android 权限与隐私保护，不可借此绕过系统安全。[Google Play 无障碍自动化政策](https://support.google.com/googleplay/android-developer/answer/10964491?hl=en-EN)

## 开发与验收顺序（尚未实施）

1. 通用 App 查找与启动：重名、未安装、被停用、不可见、不可启动、用户取消；确认观察到的应用，避免假成功。
2. 标准接口任务：浏览器、地图、时钟等独立任务；验证公开协议、真实结果和用户确认界面。
3. 可选通用界面控制：逐一验收搜索、滚动、填写、返回、取消；覆盖页面变化、弹窗、登录和超时。
4. 后台增强：只对真实通过的应用开放；不支持的目标清楚告知，不自动抢占前台。

每一层分别报告已验证的 App、版本、系统与失败原因；不以“支持打开”冒充“支持完整操作”，也不以模拟器成功冒充 OPPO 真机全覆盖。
