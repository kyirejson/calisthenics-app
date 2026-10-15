# v1.7.15 · BLACK 语音播放初始化修复

## 根因

用户在开启 BLACK 后看到“系统未能初始化语音播放”。该文案唯一来自
`VoiceSpeaker.render()`；不是麦克风权限或中文 TTS 引擎的错误。

播放器使用 `AudioTrack.MODE_STATIC`，创建成功时的初始状态是
`STATE_NO_STATIC_DATA`。v1.7.14 在写入音频之前要求 `STATE_INITIALIZED`，
把尚未装入音频的正常状态误判成失败，连内置“我在”也无法播放。

Android [AudioTrack 官方文档](https://developer.android.com/reference/android/media/AudioTrack#STATE_NO_STATIC_DATA)
和 [AOSP 实现](https://android.googlesource.com/platform/frameworks/base/+/refs/heads/main/media/java/android/media/AudioTrack.java)
明确区分此状态与创建失败的 `STATE_UNINITIALIZED`。

## 修改范围

- 创建后只拦截 `STATE_UNINITIALIZED`；完整写入 PCM 后才验证 `STATE_INITIALIZED`，随后播放。
- 记录实际写入数量和状态，真正的创建、写入、就绪失败不再混为同一错误。
- 写入后再次确认取消标记，已被用户打断的旧音频不能继续启动。
- 共用播放器同时修复确认音和模型回答；保留回声参考、自然打断、文本同步与现有模型工具。
- 没有新增权限，不改训练、跑步、音乐或模型判断策略。

## 回归方式及边界

新增模块内 Android instrumentation 测试，使用真实 Android AudioTrack 和生产
`VoiceSpeaker`，不是模拟播放器。先在修复前的源码上复现与用户完全相同的错误，
再以相同测试检查修复；两次确认音都必须实际播完且回调错误为 null。
另有静态播放器从“无数据”经写入转为“就绪”的平台状态测试。

自有 Android 15 模拟器结果：修复前 2 项中 1 项失败，错误为
“系统未能初始化语音播放”；修复后 2 项全部通过，0 失败、0 错误。
真实调用的是生产播放方法，测试 Activity 仅用于满足 Android 的前台音频焦点规则，
没有录音或调用外部模型。

旧平台 smoke 只断言服务重新进入“正在听”，但失败回调也会进入该状态，
因此旧测试的通过不能证明确认音成功。历史 v1.7.14 报告已补充此遗漏，
本次改用实际播放成功断言。测试包只供自有模拟器内部执行，不向用户分发独立测试包。

529 项 Node 回归和 TypeScript 检查通过。正式交付仍需要完整签名 APK，
沿用应用 ID 和签名、递增 Android versionCode 24，可覆盖安装并保留数据。
模拟器测试不等于 ColorOS 实体扬声器、蓝牙或复杂环境的声学验收。
