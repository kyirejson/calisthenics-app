package uncover.voice

/** Sample-clock fallback remains continuous even if ASR work delays the next read.
 * Hardware monotonic timestamps supersede it when available; loss of a timestamp
 * keeps the last known sample epoch instead of pretending buffered audio is new.
 */
internal class VoiceCaptureClock(startNs: Long) {
  private var epochNs = startNs
  fun frame(totalRead: Long, size: Int, hardwareFrame: Long? = null, hardwareNs: Long? = null): Long {
    if (hardwareFrame != null && hardwareNs != null)
      epochNs = hardwareNs - hardwareFrame * 1_000_000_000L / 16000
    return epochNs + (totalRead - size) * 1_000_000_000L / 16000
  }
}
