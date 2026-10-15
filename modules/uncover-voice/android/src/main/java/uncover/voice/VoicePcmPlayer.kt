package uncover.voice

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTimestamp
import android.media.AudioTrack
import java.util.concurrent.atomic.AtomicReference
import java.util.concurrent.atomic.AtomicBoolean

/** The actual production PCM backend, also exercised by Android instrumentation. */
internal class VoicePcmPlayer(private val reference: VoiceRenderReference, private val attributes: AudioAttributes) {
  private val track = AtomicReference<AudioTrack?>(null)
  private val paused = AtomicBoolean(false)
  fun pause() { paused.set(true) }
  fun resume() { paused.set(false) }
  fun stop() { paused.set(false); track.get()?.let { runCatching { it.pause(); it.flush(); it.stop() } } }
  fun play(pcm: ShortArray, active: () -> Boolean, started: () -> Unit): Int {
    if (!active() || pcm.isEmpty()) return 0
    val output = AudioTrack.Builder().setAudioAttributes(attributes).setAudioFormat(AudioFormat.Builder()
      .setSampleRate(16000).setEncoding(AudioFormat.ENCODING_PCM_16BIT).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
      .setTransferMode(AudioTrack.MODE_STATIC).setBufferSizeInBytes(pcm.size * 2).build()
    var referenceId = 0L; var referenceOffset = 0; var referenceStartedNs = 0L; var actualPlayed = 0; var announced = false
    try {
      // Static tracks become ready after write, not after construction.
      check(output.state != AudioTrack.STATE_UNINITIALIZED) { "系统未能创建语音播放器（状态 ${output.state}）。" }
      if (!active()) return 0
      track.set(output)
      val written = output.write(pcm, 0, pcm.size)
      check(written == pcm.size) { "语音音频未完整送入播放缓冲区（$written/${pcm.size}）。" }
      check(output.state == AudioTrack.STATE_INITIALIZED) { "语音音频已写入，但播放器尚未就绪（状态 ${output.state}）。" }
      if (!active()) return 0
      val stamp = AudioTimestamp(); val startNs = System.nanoTime()
      var pauseNs = 0L; var suspendedAt = 0L; var rendering = false
      while (active() && actualPlayed < pcm.size) {
        if (paused.get()) {
          if (rendering) {
            output.pause(); actualPlayed = output.playbackHeadPosition.coerceIn(0, pcm.size)
            reference.end(referenceId, actualPlayed - referenceOffset); referenceId = 0; rendering = false
          }
          if (suspendedAt == 0L) suspendedAt = System.nanoTime()
          Thread.sleep(10); continue
        }
        if (suspendedAt != 0L) { pauseNs += System.nanoTime() - suspendedAt; suspendedAt = 0 }
        if (!rendering) {
          referenceOffset = actualPlayed
          referenceStartedNs = System.nanoTime()
          referenceId = reference.begin(pcm.copyOfRange(referenceOffset, pcm.size), referenceStartedNs)
          output.play(); rendering = true
        }
        if (output.getTimestamp(stamp) && stamp.framePosition >= referenceOffset && stamp.nanoTime >= referenceStartedNs) reference.clock(referenceId, stamp.framePosition - referenceOffset, stamp.nanoTime)
        actualPlayed = output.playbackHeadPosition.coerceIn(0, pcm.size)
        if (!announced && actualPlayed > 0) { announced = true; started() }
        check(System.nanoTime() - startNs - pauseNs < pcm.size * 1_000_000_000L / 16000 + 5_000_000_000L) { "系统语音播放没有进展，请检查音频输出。" }
        Thread.sleep(10)
      }
      return actualPlayed
    } finally {
      // Include frames played since the last poll, but never queued/unplayed PCM.
      actualPlayed = maxOf(actualPlayed, runCatching { output.playbackHeadPosition.coerceIn(0, pcm.size) }.getOrDefault(0))
      if (referenceId != 0L) reference.end(referenceId, actualPlayed - referenceOffset)
      track.compareAndSet(output, null)
      runCatching { output.stop() }; output.release()
    }
  }
}
