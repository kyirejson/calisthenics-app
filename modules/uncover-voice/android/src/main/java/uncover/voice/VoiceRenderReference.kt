package uncover.voice

/** PCM actually sent to our AudioTrack, aligned to the monotonic render clock. No microphone data is retained. */
internal class VoiceRenderReference {
  private data class Clip(val id: Long, val pcm: ShortArray, var startNs: Long, var limit: Int)
  private val clips = mutableListOf<Clip>()
  private var sequence = 0L
  @Synchronized fun begin(pcm: ShortArray, startNs: Long): Long {
    val id = ++sequence; clips.add(Clip(id, pcm, startNs, pcm.size)); return id
  }
  @Synchronized fun clock(id: Long, frame: Long, timeNs: Long) {
    clips.firstOrNull { it.id == id }?.startNs = timeNs - frame * 1_000_000_000L / 16000
  }
  @Synchronized fun end(id: Long, playedFrames: Int) {
    clips.firstOrNull { it.id == id }?.let { it.limit = playedFrames.coerceIn(0, it.pcm.size) }
  }
  @Synchronized fun frame(startNs: Long, size: Int): ShortArray {
    // Retain the acoustic tail after stop: removing it immediately feeds our echo back into ASR.
    clips.removeAll { startNs > it.startNs + it.limit * 1_000_000_000L / 16000 + 700_000_000L }
    val output = ShortArray(size)
    for (clip in clips) {
      val offset = Math.floorDiv((startNs - clip.startNs) * 16000, 1_000_000_000L).toInt()
      for (index in output.indices) {
        val source = offset + index
        if (source in 0 until clip.limit) output[index] = (output[index].toInt() + clip.pcm[source]).coerceIn(-32768, 32767).toShort()
      }
    }
    return output
  }
  @Synchronized fun clear() { clips.clear() }
}
