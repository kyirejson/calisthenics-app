package uncover.voice

internal enum class VoiceSoundSource { NEAR_END, ECHO, UNKNOWN }

/** Observations of AEC3's actual suppressor, not an ASR hypothesis or speaker identity. */
internal data class VoiceAcousticEvidence(
  val blocks: Int = 0, val nearendBlocks: Int = 0, val echoBlocks: Int = 0,
  val reliableBlocks: Int = 0, val saturatedBlocks: Int = 0,
  val nearendPower: Double = 0.0, val echoPower: Double = 0.0, val noisePower: Double = 0.0,
  val delayMs: Double = 0.0, val erleDb: Double = 0.0,
) {
  fun source(renderProtected: Boolean, referenceReliable: Boolean): VoiceSoundSource {
    // No local playback/tail exists: ordinary VAD still decides whether this is speech.
    if (!renderProtected) return VoiceSoundSource.NEAR_END
    if (!referenceReliable || blocks == 0 || saturatedBlocks > 0 || reliableBlocks < blocks ||
      !listOf(nearendPower, echoPower, noisePower, delayMs, erleDb).all { it.isFinite() }) return VoiceSoundSource.UNKNOWN
    return when {
      nearendBlocks >= (blocks * .75) && nearendPower > 4 * echoPower && nearendPower > 4 * noisePower -> VoiceSoundSource.NEAR_END
      echoBlocks >= blocks * .5 -> VoiceSoundSource.ECHO
      else -> VoiceSoundSource.UNKNOWN
    }
  }
  companion object {
    // Layout matches echo.c; the bridge validates the complete array before processing.
    fun from(values: DoubleArray) = VoiceAcousticEvidence(values[0].toInt(), values[1].toInt(), values[2].toInt(),
      values[3].toInt(), values[4].toInt(), values[5], values[6], values[7], values[8], values[9])
  }
}
