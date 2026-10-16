package uncover.voice

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTimestamp
import android.media.AudioTrack
import android.os.Build
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference

/** One streaming track per answer. Bounded write-ahead includes the device's startup threshold. */
internal class VoicePcmPlayer(private val reference: VoiceRenderReference, private val attributes: AudioAttributes) {
  private data class Pending(var id: Long, var pcm: ShortArray, var base: Int)
  private val track = AtomicReference<AudioTrack?>(null)
  private val paused = AtomicBoolean(false)
  private var writtenFrames = 0
  private var writeAhead = 1600
  private var startupThreshold = 0
  private var routeId = 0
  fun pause() { paused.set(true) }
  fun resume() { paused.set(false) }
  fun stop() {
    paused.set(false)
    track.getAndSet(null)?.let { output -> synchronized(output) { runCatching { output.pause(); output.flush(); output.stop(); output.release() } } }
  }
  fun play(pcm: ShortArray, active: () -> Boolean, started: () -> Unit): Int {
    if (!active() || pcm.isEmpty()) return 0
    var output = track.get()
    if (output == null) {
      val minimum = AudioTrack.getMinBufferSize(16000, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT)
      check(minimum > 0) { "系统不支持当前播放格式。" }
      output = AudioTrack.Builder().setAudioAttributes(attributes).setAudioFormat(AudioFormat.Builder()
        .setSampleRate(16000).setEncoding(AudioFormat.ENCODING_PCM_16BIT).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
        .setTransferMode(AudioTrack.MODE_STREAM).setBufferSizeInBytes(maxOf(minimum, 8192)).build()
      check(output.state == AudioTrack.STATE_INITIALIZED) { "语音播放器初始化失败。" }
      // A streaming track does not start until its startup threshold is filled.
      // Waiting for its playback head before filling that threshold deadlocks.
      startupThreshold = if (Build.VERSION.SDK_INT >= 31) output.setStartThresholdInFrames(512) else output.bufferSizeInFrames
      writeAhead = maxOf(1600, startupThreshold)
      if (!active()) { output.release(); return 0 }
      writtenFrames = 0; routeId = 0; track.set(output); output.play()
    }
    val target = output; val first = writtenFrames; var offset = 0; var played = 0; var announced = false
    val pending = mutableListOf<Pending>(); val stamp = AudioTimestamp()
    var lastHead = first; var progressedAt = System.nanoTime(); var pausedTrack = false; var resumedAt = 0L
    fun owned() = active() && track.get() === target
    fun update(): Int {
      val routed = target.routedDevice?.id ?: 0
      if (routeId != 0 && routed != 0 && routeId != routed) reference.routeChanged(System.nanoTime())
      if (routed != 0) routeId = routed
      val head = target.playbackHeadPosition
      if (head > lastHead) { lastHead = head; progressedAt = System.nanoTime() }
      played = (head - first).coerceIn(0, pcm.size)
      if (played > 0 && !announced) { announced = true; started() }
      val timestamped = target.getTimestamp(stamp) && stamp.nanoTime >= resumedAt
      for (item in pending) {
        if (timestamped) reference.clock(item.id, stamp.framePosition - item.base, stamp.nanoTime)
        if (head >= item.base + item.pcm.size) reference.end(item.id, item.pcm.size)
      }
      pending.removeAll { head >= it.base + it.pcm.size }
      return head
    }
    try {
      while (owned() && (offset < pcm.size || played < pcm.size)) {
        val head = update()
        if (paused.get()) {
          if (!pausedTrack) {
            target.pause()
            for (item in pending) reference.end(item.id, (head - item.base).coerceIn(0, item.pcm.size))
            pausedTrack = true
          }
          progressedAt = System.nanoTime(); Thread.sleep(10); continue
        }
        if (pausedTrack) {
          resumedAt = System.nanoTime()
          for (item in pending) {
            val consumed = (head - item.base).coerceIn(0, item.pcm.size)
            item.pcm = item.pcm.copyOfRange(consumed, item.pcm.size); item.base += consumed
            item.id = reference.begin(item.pcm, resumedAt + (item.base - head) * 1_000_000_000L / 16000)
          }
          target.play(); pausedTrack = false
        }
        if (offset < pcm.size && writtenFrames - head < writeAhead) {
          val count = minOf(512, pcm.size - offset)
          val base = writtenFrames
          val written = synchronized(target) {
            if (!owned()) return played
            target.write(pcm, offset, count, AudioTrack.WRITE_NON_BLOCKING)
          }
          check(written >= 0) { "语音播放写入失败 ($written)。" }
          if (written > 0) {
            val startNs = if (target.getTimestamp(stamp) && stamp.nanoTime >= resumedAt)
              stamp.nanoTime + (base - stamp.framePosition) * 1_000_000_000L / 16000
            else System.nanoTime() + (base - head) * 1_000_000_000L / 16000
            val block = pcm.copyOfRange(offset, offset + written)
            pending.add(Pending(reference.begin(block, startNs), block, base))
            writtenFrames += written; offset += written
          }
        }
        // Even a sub-threshold utterance must start. Pad only the first startup
        // with silence, never mark padding as speech or report it as played PCM.
        if (offset == pcm.size && head == 0 && writtenFrames < startupThreshold) {
          val padding = ShortArray(minOf(512, startupThreshold - writtenFrames))
          val written = synchronized(target) {
            if (!owned()) return played
            target.write(padding, 0, padding.size, AudioTrack.WRITE_NON_BLOCKING)
          }
          check(written >= 0) { "语音起播填充失败 ($written)。" }
          writtenFrames += written
        }
        check(System.nanoTime() - progressedAt < 3_000_000_000L) { "播放器没有消费音频。" }
        Thread.sleep(2)
      }
    } catch (error: IllegalStateException) {
      if (owned()) throw error
    } finally {
      for (item in pending) reference.end(item.id, (lastHead - item.base).coerceIn(0, item.pcm.size))
    }
    return played
  }
}
