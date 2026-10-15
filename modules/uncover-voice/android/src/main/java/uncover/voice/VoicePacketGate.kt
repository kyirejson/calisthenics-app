package uncover.voice

internal data class VoiceAudioFrame(val samples: FloatArray, val speech: Boolean, val timeMs: Long = 0)
internal data class VoicePacketResult(val accepted: Boolean, val frames: List<VoiceAudioFrame>, val voicedMs: Long)

/** Unverified audio never inherits the preceding packet's identity or enters ASR. */
internal class VoicePacketGate(private val verify: (List<VoiceAudioFrame>, Long) -> Boolean) {
  private val fresh = mutableListOf<VoiceAudioFrame>()
  private var checkedVoiced = 0L
  val pending get() = fresh.any { it.speech }
  fun append(frame: VoiceAudioFrame) { fresh.add(frame) }
  fun resolve(final: Boolean): VoicePacketResult? {
    val voiced = fresh.count { it.speech } * 32L
    if (voiced == 0L || final && voiced < 160) { if (final) { fresh.clear(); checkedVoiced = 0 }; return null }
    if (!final && (voiced < 640 || voiced - checkedVoiced < 320)) return null
    checkedVoiced = voiced
    // Never pad a short new voice with a previously verified speaker: a mixed
    // embedding could be dominated by the old owner. Uncertain audio stays out.
    val accepted = voiced >= 320 && verify(fresh.toList(), voiced)
    if (!accepted && !final && voiced < 1280 && fresh.size < 64) return null
    val result = VoicePacketResult(accepted, fresh.toList(), voiced)
    fresh.clear(); checkedVoiced = 0
    return result
  }
  fun clear() { fresh.clear(); checkedVoiced = 0 }
}
