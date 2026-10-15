package uncover.voice

import java.util.ArrayDeque

internal data class VoiceWakeClip(val frames: List<VoiceAudioFrame>, val tail: List<VoiceAudioFrame>)

/** Uses the neural keyword token timestamps, not the last arbitrary 1.5 seconds of mixed voices. */
internal class VoiceWakeWindow {
  private val frames = ArrayDeque<Pair<Long, VoiceAudioFrame>>()
  private var samples = 0L
  fun append(frame: VoiceAudioFrame) {
    frames.addLast(samples to frame); samples += frame.samples.size
    while (frames.size > 100) frames.removeFirst()
  }
  fun clip(timestamps: FloatArray): VoiceWakeClip? {
    if (timestamps.isEmpty() || timestamps.any { !it.isFinite() }) return null
    val begin = ((timestamps.first() - .10f).coerceAtLeast(0f) * 16000).toLong()
    val end = ((timestamps.last() + .16f) * 16000).toLong().coerceAtMost(samples)
    if (end <= begin || end - begin > 28800 || frames.firstOrNull()?.first?.let { it > begin } == true) return null
    val selected = frames.filter { (start, frame) -> start < end && start + frame.samples.size > begin }.map { it.second }
    if (selected.isEmpty()) return null
    val tail = frames.filter { (start, _) -> start >= end }.map { it.second }
    return VoiceWakeClip(selected, tail)
  }
  fun clear() { frames.clear(); samples = 0 }
}
