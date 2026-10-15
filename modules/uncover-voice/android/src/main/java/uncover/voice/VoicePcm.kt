package uncover.voice

/** Owned mono PCM from the local synthesizer; sample rate is explicit until resampling. */
internal data class VoicePcm(val samples: ShortArray, val sampleRate: Int) {
  init {
    require(sampleRate in 8000..192000) { "语音采样率不受支持。" }
    require(samples.isNotEmpty()) { "语音引擎没有返回音频。" }
  }
}
