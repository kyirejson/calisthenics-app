package uncover.voice

internal sealed interface VoicePlaybackPacket {
  data class Audio(val pcm: ShortArray, val start: Int, val end: Int) : VoicePlaybackPacket {
    init { require(pcm.isNotEmpty() && start >= 0 && end >= start) }
  }
  data class End(val error: String? = null) : VoicePlaybackPacket
}

internal data class VoicePlaybackResult(val playedFrames: Long, val queuedFrames: Long,
  val prefedBoundaries: Int, val underruns: Int, val error: String?)

/** Source offsets follow the audible head, never the producer's write-ahead cursor. */
internal class VoicePlaybackTimeline {
  data class Progress(val start: Int, val end: Int, val spokenEnd: Int)
  private data class Span(val base: Long, val size: Int, val start: Int, val end: Int, var announced: Boolean = false)
  private val spans = ArrayDeque<Span>()
  private var completedFrames = 0L
  private var spokenEnd = 0
  private var lastEnd: Long? = null
  var queuedFrames = 0L; private set
  var playedFrames = 0L; private set
  var prefedBoundaries = 0; private set
  val pending get() = spans.isNotEmpty()
  fun append(packet: VoicePlaybackPacket.Audio, base: Long, head: Long) {
    require(base >= (lastEnd ?: 0L))
    if (lastEnd != null && head < base) prefedBoundaries++
    lastEnd = base + packet.pcm.size
    queuedFrames += packet.pcm.size
    spans.addLast(Span(base, packet.pcm.size, packet.start, packet.end))
  }
  fun advance(head: Long): List<Progress> {
    val changes = mutableListOf<Progress>()
    while (spans.isNotEmpty()) {
      val span = spans.first()
      if (head <= span.base) break
      if (!span.announced) {
        span.announced = true; changes.add(Progress(span.start, span.end, spokenEnd))
      }
      if (head < span.base + span.size) break
      completedFrames += span.size; spokenEnd = span.end
      changes.add(Progress(span.start, span.end, spokenEnd)); spans.removeFirst()
    }
    playedFrames = completedFrames + (spans.firstOrNull()?.let { (head - it.base).coerceIn(0L, it.size.toLong()) } ?: 0L)
    return changes
  }
}
