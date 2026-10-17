package uncover.voice

/** Playback timing describes device audio, not the identity of a microphone speaker. */
internal class VoiceExternalAudioGate {
  data class State(val suppressed: Boolean, val reason: String = "none", val tail: Boolean = false)
  private data class Interval(val start: Long, var end: Long?, val reason: String)
  private val intervals = mutableListOf<Interval>()
  @Synchronized fun update(active: Boolean, timeNs: Long, reason: String = "external_speech") {
    val open = intervals.lastOrNull()?.takeIf { it.end == null }
    if (open != null && (!active || open.reason != reason)) open.end = timeNs + 700_000_000L
    if (active && (open == null || open.reason != reason)) intervals.add(Interval(timeNs - 150_000_000L, null, reason))
    // Retain substantially more than the bounded capture queue, so old frames keep their evidence.
    intervals.removeAll { it.end != null && timeNs - it.end!! > 6_000_000_000L }
  }
  @Synchronized fun state(timeNs: Long): State {
    val interval = intervals.lastOrNull { timeNs >= it.start && (it.end == null || timeNs <= it.end!!) } ?: return State(false)
    return State(true, interval.reason, interval.end != null)
  }
  fun suppressed(timeNs: Long) = state(timeNs).suppressed
}
