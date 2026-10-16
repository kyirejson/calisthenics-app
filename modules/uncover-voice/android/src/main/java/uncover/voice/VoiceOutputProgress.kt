package uncover.voice

/** Worker-local stage changes are visible to the renderer; playback never times out a healthy sentence. */
internal class VoiceOutputProgress(private val total: Int, private val queuedAt: Long, private val limitMs: Long = 30000) {
  internal enum class Phase { QUEUED, PREPARING, SYNTHESIS, BUFFERED, ENDED }
  internal data class State(val phase: Phase, val since: Long, val segment: Int = 0,
    val start: Int = 0, val end: Int = 0, val attempt: Int = 0, val queueMs: Long = 0)
  init { require(total > 0 && limitMs > 0) }
  @Volatile var state = State(Phase.QUEUED, queuedAt); private set
  fun preparing(now: Long) { state = State(Phase.PREPARING, now, queueMs = now - queuedAt) }
  fun synthesis(index: Int, chunk: VoiceSpeechChunk, attempt: Int, now: Long) {
    val queueMs = if (state.phase == Phase.QUEUED) now - queuedAt else state.queueMs
    state = State(Phase.SYNTHESIS, now, index, chunk.start, chunk.end, attempt, queueMs)
  }
  fun buffered(now: Long) { state = state.copy(phase = Phase.BUFFERED, since = now) }
  fun ended(now: Long) { state = state.copy(phase = Phase.ENDED, since = now) }
  fun timeout(now: Long): String? {
    val value = state
    if (now - value.since < limitMs) return null
    return when (value.phase) {
      Phase.QUEUED -> "语音合成排队超时（synthesis_queue_timeout）。"
      Phase.PREPARING -> "内置语音准备超时（synthesis_prepare_timeout）。"
      Phase.SYNTHESIS -> "第 ${value.segment}/$total 段语音合成超时（synthesis_timeout）。"
      else -> null // Backpressure and actual playback are not inference stalls.
    }
  }
  fun failure(error: Throwable): String {
    val value = state
    val code = (error as? VoiceSynthesisException)?.code ?: if (value.segment == 0) "synthesis_prepare_failed" else "synthesis_failed"
    val retry = if (value.attempt > 1) "，已重试 ${value.attempt - 1} 次" else ""
    val stage = if (value.segment == 0) "内置语音准备失败" else "第 ${value.segment}/$total 段语音合成失败"
    return "$stage（$code$retry）：${error.message ?: error.javaClass.simpleName} 完整文字已保留。"
  }
  fun details(now: Long): String = state.let {
    "phase=${it.phase} segment=${it.segment}/$total range=${it.start}:${it.end} attempt=${it.attempt} queueMs=${it.queueMs} stageMs=${now - it.since}"
  }
}

internal class VoiceSynthesisException(val code: String, message: String) : IllegalStateException(message)
