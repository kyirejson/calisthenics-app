# v1.7.14 · BLACK 自然打断、文字同步与简洁输出

用户要求完成后直接发布正式版，不再制作测试包或等待候选验收。版本号
1.7.14、Android versionCode 23，沿用原 application ID 和正式签名，保留已有本机数据。
本报告记录可重复的软件验证，不把合成音频或模拟器结果当作 ColorOS 真机验收。

## 这次修复

- 单份 `src/agent/conversation.ts` 负责文字和后台语音的上下文、订阅和保存队列。
  用户语音识别中的文字、模型流式回答、播放中的句子及打断状态显示在原 Agent 界面。
  关闭面板不会停止后台语音；重新打开可看到同一份会话。清空上下文同时清除
  文字和语音会话，保留个人记忆、训练、饮食及已经成功执行的业务记录。
- `responseStyle.mjs` 引导文字和语音先结论、短句、不复述操作、不堆砌废话。
  详细请求保留必要内容；没有新增字数/token 上限、工具轮次上限或关键词意图路由。
- 音频阶段区分唤醒确认、听取、处理和回答；同一次唤醒只确认一次。
  已唤醒时的重复系统入口转为听取，而不是再次播放“我在”。
- 由同一个 AudioTrack PCM 播放器负责本地确认音和系统中文 TTS，取消原先的
  MediaPlayer/TTS 直接播放并存链路。系统 TTS 只合成到私有缓存，队列最多提前
  准备两段；每段按句子/传输长度拆分，完整模型回答不会被截断，缓存完成后删除。
- AudioRecord 和 AudioTrack 的单调时间戳对齐播放参考；设备 AEC、SpeexDSP
  回声消除/残余抑制和冷启动的相干播放参考处理共同避免听到自己。
  “我在”没有加入禁词表；无播放参考时用户说同样的词仍可进入识别。
- Silero VAD 本地检测实际人声，不再丢弃回答期间的全部录音帧，也不要求用户
  再次喊 BLACK 才能打断。160 毫秒连续人声证据及约 512 毫秒预录缓冲用于
  抵抗点击噪声并保留开头。麦克风 PCM 始终只在内存；只把有效会话文字发送给已配置的模型。
- 用户插话时先在原生层停止音频并使旧请求失效，再立即通知共用会话中止请求。
  旧生成、旧播放和旧回调不能重新开始。取消与工具成功返回竞态中的回执仍保留，
  后续模型能核实已完成动作，不自动回滚或重复执行。
- 修复 Web 端错误调用 Android `registerHeadlessTask` 的问题。

## 验证证据

- TypeScript 无错误；528 项 Node 回归测试通过（包括共用会话、语音 runner 和音乐取消回执测试）。
- 原生四 ABI 编译及 10 项语音 JVM 单元测试通过；正式打包还会再次执行语音、音乐和跑步测试。
- Chrome 隔离上下文：320/390px 清空会话、错误恢复、业务存储保留；320/390/607px
  手机输入、实际 MD/DOCX/PDF 附件、扫描 PDF 拒绝、错误重试和单一用户消息均通过。
  全程使用合成资料和模拟模型，不接触用户浏览器存储或真实密钥。
- `scripts/check-voice-echo.py` 在自有 Android 模拟器运行与生产相同的 C DSP 核心，
  再用实际 VAD/ASR 模型验证：4 种确认音回声延迟、长回答及带噪回声没有触发新对话；
  两种音色/两种音量的合成人声插话检测约 196–228ms，识别保留请求开头；
  用户真实输入同样的“我在”仍被识别人声。共 11 种合成场景通过。

合成房间回声不是所有手机的真实扬声器、输入法、蓝牙或声音路由；本次没有连接用户手机，
不宣称完成 ColorOS 锁屏、后台强制停止恢复或真实多人嘈杂环境的验收。默认助手和
麦克风服务仍受 Android/OEM 权限与系统策略约束，没有权限绕过。

## 第三方组件

sherpa-onnx 1.13.8、KWS/CTC 模型沿用已有 SHA-256；Silero VAD 与 SpeexDSP 1.2.1
新增官方来源及固定 SHA-256。APK 随附 Apache-2.0、MIT、BSD-3-Clause 许可。
`prepare:voice` 自动准备源/模型，不把生成的二进制或第三方源码缓存提交到 Git。

参考：

- [Android 播报回调](https://developer.android.com/reference/android/speech/tts/UtteranceProgressListener)
- [Android AEC](https://developer.android.com/reference/android/media/audiofx/AcousticEchoCanceler)
- [Speex 回声处理 API](https://www.speex.org/docs/manual/speex-manual/node7.html)
- [Sherpa Kotlin VAD](https://github.com/k2-fsa/sherpa-onnx/blob/v1.13.8/sherpa-onnx/kotlin-api/Vad.kt)
