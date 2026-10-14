package uncover.voice

/** Acoustic speech detection, not a command/intent filter. Five 32 ms frames reject clicks while keeping a pre-roll. */
internal class VoiceSpeechGate {
  private var frames = 0
  fun observe(probability: Float): Boolean {
    frames = if (probability >= .55f) frames + 1 else 0
    return frames >= 5
  }
  fun reset() { frames = 0 }
}
