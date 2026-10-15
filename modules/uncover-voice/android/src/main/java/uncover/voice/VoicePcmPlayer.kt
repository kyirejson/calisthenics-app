package uncover.voice

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTimestamp
import android.media.AudioTrack
import java.util.concurrent.atomic.AtomicReference

/** The actual production PCM backend, also exercised by Android instrumentation. */
internal class VoicePcmPlayer(private val reference: VoiceRenderReference, private val attributes: AudioAttributes) {
  private val track = AtomicReference<AudioTrack?>(null)
  fun stop() { track.get()?.let { runCatching { it.pause(); it.flush(); it.stop() } } }
  fun play(pcm: ShortArray, active: () -> Boolean, started: () -> Unit): Int {
    if (!active() || pcm.isEmpty()) return 0
    val output = AudioTrack.Builder().setAudioAttributes(attributes).setAudioFormat(AudioFormat.Builder()
      .setSampleRate(16000).setEncoding(AudioFormat.ENCODING_PCM_16BIT).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
      .setTransferMode(AudioTrack.MODE_STATIC).setBufferSizeInBytes(pcm.size * 2).build()
    var referenceId = 0L; var actualPlayed = 0; var announced = false
    try {
      // Static tracks become ready after write, not after construction.
      check(output.state != AudioTrack.STATE_UNINITIALIZED) { "系统未能创建语音播放器（状态 ${output.state}）。" }
      if (!active()) return 0
      track.set(output)
      val written = output.write(pcm, 0, pcm.size)
      check(written == pcm.size) { "语音音频未完整送入播放缓冲区（$written/${pcm.size}）。" }
      check(output.state == AudioTrack.STATE_INITIALIZED) { "语音音频已写入，但播放器尚未就绪（状态 ${output.state}）。" }
      if (!active()) return 0
      referenceId = reference.begin(pcm, System.nanoTime())
      output.play()
      val stamp = AudioTimestamp(); val startNs = System.nanoTime()
      while (active() && actualPlayed < pcm.size) {
        if (output.getTimestamp(stamp)) reference.clock(referenceId, stamp.framePosition, stamp.nanoTime)
        actualPlayed = output.playbackHeadPosition.coerceIn(0, pcm.size)
        if (!announced && actualPlayed > 0) { announced = true; started() }
        check(System.nanoTime() - startNs < pcm.size * 1_000_000_000L / 16000 + 5_000_000_000L) { "系统语音播放没有进展，请检查音频输出。" }
        Thread.sleep(10)
      }
      return actualPlayed
    } finally {
      // Include frames played since the last poll, but never queued/unplayed PCM.
      actualPlayed = maxOf(actualPlayed, runCatching { output.playbackHeadPosition.coerceIn(0, pcm.size) }.getOrDefault(0))
      if (referenceId != 0L) reference.end(referenceId, actualPlayed)
      track.compareAndSet(output, null)
      runCatching { output.stop() }; output.release()
    }
  }
}
