package uncover.voice

/** AEC-cleaned speech is only a candidate; a reversible hold also requires sustained speech and ASR text. */
internal class VoiceSpeechGate {
  private var frames = 0
  private var announced = false
  private var confirmed = false
  val candidate get() = frames > 0
  fun observe(probability: Float): Boolean {
    frames = if (probability >= .55f) frames + 1 else 0
    if (frames < 5 || announced) return false
    announced = true; return true
  }
  fun confirm(text: String): Boolean {
    if (confirmed || frames < 8 || text.none { it.isLetterOrDigit() }) return false
    confirmed = true; return true
  }
  fun reset() { frames = 0; announced = false; confirmed = false }
}
