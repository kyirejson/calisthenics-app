# BLACK 本地中文 TTS 选型复核

日期：2026-10-16。目标：OPPO Find X8 Pro / ColorOS 16.0.10。

结论：不能把现有 MeloTTS 称为当下最优。它是已集成、许可清晰的本地基线，不是已经胜出同机对比的最终引擎。本轮调研不更换模型、不接入付费云服务；用户随后要求发布 ARM64 精简版 v1.7.19，该发布不包含新的 TTS 选型或替换。

## 已查到的证据

| 候选 | 已有依据 | 对本项目的判断 |
| --- | --- | --- |
| MeloTTS 中英 | 官方支持 CPU 推理；项目已集成单音色 ONNX。官方项目 MIT 许可 | 有现成 Android 运行路径；缺乏对目标手机的首包延迟、耗电和主观质量验收，不能因此称最佳 |
| Matcha 中文 Baker | Sherpa 提供 Android/ONNX 路径，CPU 基准较快；文档明确警告训练数据仅限非商用 | 有速度潜力，但不能把训练代码许可证当成全部模型与数据授权，未解决发布用途前不直接替换 |
| Kokoro v1.1-zh | 官方模型卡列中英文、103 个音色及 Apache-2.0；Sherpa 有 Android 集成 | 值得做自然度/多音色对照；项目之前一次桌面 int8 测量较慢，不能据此推定目标手机，也不能因较新便认定更好 |
| ZipVoice / Distill | 官方支持中英文、CPU/ONNX及蒸馏降步数；Sherpa 有集成路径 | 候选。速度、参考音频许可、自然度和短句首声需同机评测；不能把整句快速生成等同于原生文本增量流式 |
| Qwen3-TTS 0.6B / 1.7B | 官方公布中文、流式生成与表达控制，宣称最低 97 ms 首包；部署示例为 Python/CUDA | 功能更丰富，不证明在此手机 CPU 上更快；不能用该数字替代 Android 实测，当前应用也没有现成等价运行时 |
| CosyVoice 3 0.5B | 官方支持双向流式和韵律/情感指令，宣称最低 150 ms | 适合作为表达能力与流式设计对照；官方指标不是本项目真机结果，换成它仍需完整端侧适配或另行批准服务端方案 |

## 可以明确推翻“最快”的数据

Sherpa 官方在 Raspberry Pi 4 Model B Rev 1.5 的参考表（两线程）列：

- MeloTTS 中英：RTF 3.877。
- Matcha 中文 Baker：RTF 0.536。

RTF 是合成耗时除以声音时长，越低越快；这张表显示存在更快的中文 CPU 路线。它不是 Find X8 Pro 测试，也不是相同音色、相同采样率、完整相同输入下的质量排名，不能推出 Matcha 在所有维度胜出。

本项目历史桌面测量见 `voice-refactor-progress-2026-10-15.md`；没有新增实测冒充调研，也没有完成目标手机 A/B。本次研究没有更换现有 Melo 模型。

## 推荐决策

1. 立即删除正式包里多余架构，与模型选型分开处理；保留当前模型的完整能力。
2. 当前 Melo 保留为对照基线，不宣布选型完成。Kokoro 中文与 ZipVoice-Distill 优先做同设备、同文本对照；Matcha 要先确认适合发布用途的模型授权。
3. 以实际首声 P50/P95、稳态 RTF、长回答断流/吞字、数字/多音字/中英混读、自然度、常驻内存、发热和同时收音时的负载选择。不用单一参数量、采样率、CPU 厂商宣传或下载体积定胜负。
4. Qwen3/CosyVoice 的服务器性能与手机能力分开。没有新服务授权，不自动上传用户语音或新增费用；没有目标机数据，不声称已选出“目前最优”。
5. 现有 Agent 仍等最终文字回答后再开始语音；更换 TTS 本身不能补齐模型边生成边朗读协议，也不能单独解决 AEC/轮次判断。

## 原始来源

- [MeloTTS 官方仓库](https://github.com/myshell-ai/MeloTTS)
- [Sherpa 官方 CPU RTF 对照](https://k2-fsa.github.io/sherpa/onnx/tts/pretrained_models/rtf.html)
- [Matcha 中文模型与非商用数据警告](https://k2-fsa.github.io/sherpa/onnx/tts/pretrained_models/matcha.html)
- [Kokoro 中文官方模型卡](https://huggingface.co/hexgrad/Kokoro-82M-v1.1-zh)
- [ZipVoice 官方仓库](https://github.com/k2-fsa/ZipVoice)
- [Sherpa ZipVoice 集成](https://k2-fsa.github.io/sherpa/onnx/tts/zipvoice.html)
- [Qwen3-TTS 官方仓库](https://github.com/QwenLM/Qwen3-TTS)
- [CosyVoice 官方仓库](https://github.com/QwenAudio/CosyVoice)

以上为截至查阅日的官方资料，不声称穷尽所有商业闭源引擎或所有社区端侧优化实现。
