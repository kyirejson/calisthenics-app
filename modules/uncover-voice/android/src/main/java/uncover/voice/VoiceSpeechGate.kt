package uncover.voice

/** Text is never permission to interrupt. Only sustained, acoustically admitted near-end speech is. */
internal class VoiceSpeechGate {
  enum class Event {
    NONE, CANDIDATE, HEARING;
    // During playback a mere candidate must not open ASR and later bypass the
    // hold gate by submitting its text as a new model turn. Pre-roll preserves onset.
    fun startsRecognition(renderProtected: Boolean) = this == HEARING || (this == CANDIDATE && !renderProtected)
  }
  private var frames = 0
  private var announced = false
  private var confirmed = false
  val candidate get() = frames > 0
  fun observe(probability: Float, source: VoiceSoundSource): Event {
    frames = if (source == VoiceSoundSource.NEAR_END && probability >= .55f) frames + 1 else 0
    if (frames >= 8 && !confirmed) { confirmed = true; return Event.HEARING }
    if (frames >= 5 && !announced) { announced = true; return Event.CANDIDATE }
    return Event.NONE
  }
  fun reset() { frames = 0; announced = false; confirmed = false }
}
