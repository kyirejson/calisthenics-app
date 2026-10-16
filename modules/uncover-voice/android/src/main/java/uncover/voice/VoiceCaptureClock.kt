package uncover.voice

/** Sample-clock fallback remains continuous even if ASR work delays the next read.
 * Hardware monotonic timestamps supersede it when available; loss of a timestamp
 * keeps the last known sample epoch instead of pretending buffered audio is new.
 */
internal class VoiceCaptureClock(startNs: Long) {
  private var epochNs = startNs
  var revision = 0L; private set
  fun frame(totalRead: Long, size: Int, hardwareFrame: Long? = null, hardwareNs: Long? = null): Long {
    if (hardwareFrame != null && hardwareNs != null) {
      val calibrated = hardwareNs - hardwareFrame * 1_000_000_000L / 16000
      if (kotlin.math.abs(calibrated - epochNs) > 64_000_000L) revision++
      epochNs = calibrated
    }
    return epochNs + (totalRead - size) * 1_000_000_000L / 16000
  }
}
