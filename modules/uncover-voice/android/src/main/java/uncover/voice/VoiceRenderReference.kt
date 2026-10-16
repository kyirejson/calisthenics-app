package uncover.voice

/** PCM actually sent to our AudioTrack, aligned to the monotonic render clock. No microphone data is retained. */
internal class VoiceRenderReference {
  private data class Clip(val id: Long, val pcm: ShortArray, var startNs: Long, var limit: Int, var clocked: Boolean = false)
  data class Frame(val samples: ShortArray, val renderProtected: Boolean, val reliable: Boolean, val epoch: Long)
  private val clips = mutableListOf<Clip>()
  private var sequence = 0L
  private var epoch = 0L
  private var guardUntilNs = 0L
  private val tailNs = 700_000_000L
  // Capture can be queued for up to 32 * 32 ms. Producer-side pruning must not
  // erase a reference before that older microphone frame reaches the worker.
  private val retentionNs = 3_000_000_000L
  @Synchronized fun begin(pcm: ShortArray, startNs: Long): Long {
    clips.removeAll { startNs > it.startNs + it.limit * 1_000_000_000L / 16000 + retentionNs }
    val id = ++sequence; clips.add(Clip(id, pcm, startNs, pcm.size)); return id
  }
  @Synchronized fun clock(id: Long, frame: Long, timeNs: Long) {
    clips.firstOrNull { it.id == id }?.let {
      val actual = timeNs - frame * 1_000_000_000L / 16000
      if (it.clocked && kotlin.math.abs(actual - it.startNs) > 64_000_000L) routeChanged(timeNs)
      it.startNs = actual; it.clocked = true
    }
  }
  @Synchronized fun end(id: Long, playedFrames: Int) {
    clips.firstOrNull { it.id == id }?.let { it.limit = playedFrames.coerceIn(0, it.pcm.size) }
  }
  @Synchronized fun read(startNs: Long, size: Int): Frame {
    // Retain the acoustic tail after stop: removing it immediately feeds our echo back into ASR.
    clips.removeAll { startNs > it.startNs + it.limit * 1_000_000_000L / 16000 + tailNs }
    val output = ShortArray(size)
    for (clip in clips) {
      val offset = Math.floorDiv((startNs - clip.startNs) * 16000, 1_000_000_000L).toInt()
      for (index in output.indices) {
        val source = offset + index
        if (source in 0 until clip.limit) output[index] = (output[index].toInt() + clip.pcm[source]).coerceIn(-32768, 32767).toShort()
      }
    }
    // Pending write-ahead and the tail are protected too, including silent gaps.
    // A fallback estimate is useful to AEC, but is not evidence to interrupt.
    val relevant = clips.filter { it.limit > 0 && it.startNs <= startNs + 300_000_000L &&
      startNs < it.startNs + it.limit * 1_000_000_000L / 16000 + tailNs }
    val renderProtected = relevant.isNotEmpty() || startNs < guardUntilNs
    return Frame(output, renderProtected, !renderProtected || (startNs >= guardUntilNs && relevant.isNotEmpty() && relevant.all { it.clocked }), epoch)
  }
  @Synchronized fun routeChanged(timeNs: Long) {
    epoch++; guardUntilNs = maxOf(guardUntilNs, timeNs + tailNs)
    clips.forEach { it.clocked = false }
  }
  @Synchronized fun isCurrent(observedEpoch: Long) = observedEpoch == epoch
  @Synchronized fun clear() { clips.clear(); guardUntilNs = 0; epoch++ }
}
