package uncover.voice

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTimestamp
import android.media.AudioTrack
import android.os.Build
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference

/** One continuous queue/track per answer. A ready segment is written before its predecessor drains. */
internal class VoicePcmPlayer(private val reference: VoiceRenderReference, private val attributes: AudioAttributes) {
  private data class Pending(var id: Long, var pcm: ShortArray, var base: Long)
  private val track = AtomicReference<AudioTrack?>(null)
  private val paused = AtomicBoolean(false)
  fun pause() { paused.set(true) }
  fun resume() { paused.set(false) }
  fun stop() {
    paused.set(false)
    track.getAndSet(null)?.let { output -> synchronized(output) { runCatching { output.pause(); output.flush(); output.stop(); output.release() } } }
  }
  fun play(next: () -> VoicePlaybackPacket?, active: () -> Boolean, waiting: () -> Unit = {},
    playback: (Boolean) -> Unit = {}, progress: (Int, Int, Int) -> Unit = { _, _, _ -> }): VoicePlaybackResult {
    var output: AudioTrack? = null
    var writtenFrames = 0L; var writeAhead = 3200; var startupThreshold = 0; var routeId = 0
    var current: VoicePlaybackPacket.Audio? = null; var offset = 0
    var terminal: VoicePlaybackPacket.End? = null
    val timeline = VoicePlaybackTimeline()
    val pending = mutableListOf<Pending>(); val stamp = AudioTimestamp()
    var lastHead = 0L; var progressedAt = System.nanoTime(); var pausedTrack = false; var resumedAt = 0L
    var playing = false; var underruns = 0
    fun owned() = active() && (output == null || track.get() === output)
    fun createTrack(): AudioTrack {
      val minimum = AudioTrack.getMinBufferSize(16000, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT)
      check(minimum > 0) { "系统不支持当前播放格式。" }
      val created = AudioTrack.Builder().setAudioAttributes(attributes).setAudioFormat(AudioFormat.Builder()
        .setSampleRate(16000).setEncoding(AudioFormat.ENCODING_PCM_16BIT).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
        .setTransferMode(AudioTrack.MODE_STREAM).setBufferSizeInBytes(maxOf(minimum, 8192)).build()
      check(created.state == AudioTrack.STATE_INITIALIZED) { "语音播放器初始化失败。" }
      // A streaming track does not start until its startup threshold is filled.
      // Waiting for its playback head before filling that threshold deadlocks.
      startupThreshold = if (Build.VERSION.SDK_INT >= 31) created.setStartThresholdInFrames(512) else created.bufferSizeInFrames
      // At most ~200 ms ahead (or the device's required startup minimum), not a whole answer.
      writeAhead = maxOf(3200, startupThreshold)
      output = created; track.set(created); created.play(); return created
    }
    fun update(target: AudioTrack): Long {
      val routed = target.routedDevice?.id ?: 0
      if (routeId != 0 && routed != 0 && routeId != routed) reference.routeChanged(System.nanoTime())
      if (routed != 0) routeId = routed
      val head = target.playbackHeadPosition.toLong() and 0xffffffffL
      if (head > lastHead) { lastHead = head; progressedAt = System.nanoTime() }
      val changes = timeline.advance(head)
      if (changes.isNotEmpty() && !playing) { playing = true; playback(true) }
      for (change in changes) progress(change.start, change.end, change.spokenEnd)
      val timestamped = target.getTimestamp(stamp) && stamp.nanoTime >= resumedAt
      for (item in pending) {
        if (timestamped) reference.clock(item.id, stamp.framePosition - item.base, stamp.nanoTime)
        if (head >= item.base + item.pcm.size) reference.end(item.id, item.pcm.size)
      }
      pending.removeAll { head >= it.base + it.pcm.size }; underruns = target.underrunCount
      return head
    }
    try {
      while (owned()) {
        var target = output
        val head = if (target == null) 0L else update(target)
        if (terminal != null && current == null && !timeline.pending) break
        if (paused.get()) {
          if (target != null && !pausedTrack) {
            target.pause()
            for (item in pending) reference.end(item.id, (head - item.base).coerceIn(0L, item.pcm.size.toLong()).toInt())
            pausedTrack = true
          }
          progressedAt = System.nanoTime(); Thread.sleep(10); continue
        }
        if (target != null && pausedTrack) {
          resumedAt = System.nanoTime()
          for (item in pending) {
            val consumed = (head - item.base).coerceIn(0L, item.pcm.size.toLong()).toInt()
            item.pcm = item.pcm.copyOfRange(consumed, item.pcm.size); item.base += consumed
            item.id = reference.begin(item.pcm, resumedAt + (item.base - head) * 1_000_000_000L / 16000)
          }
          target.play(); pausedTrack = false
        }
        // Poll without blocking the render loop. In particular, do not wait for
        // the previous segment's playback head before admitting its successor.
        if (current == null && terminal == null) {
          when (val packet = next()) {
            is VoicePlaybackPacket.Audio -> {
              if (!owned()) break
              if (target == null) { target = createTrack(); progressedAt = System.nanoTime() }
              timeline.append(packet, writtenFrames, head); current = packet; offset = 0
            }
            is VoicePlaybackPacket.End -> terminal = packet
            null -> Unit
          }
        }
        val audio = current
        if (target != null && audio != null && writtenFrames - head < writeAhead) {
          val count = minOf(512, audio.pcm.size - offset, (writeAhead - (writtenFrames - head)).toInt())
          val base = writtenFrames
          val written = synchronized(target) {
            if (!owned()) 0 else target.write(audio.pcm, offset, count, AudioTrack.WRITE_NON_BLOCKING)
          }
          check(written >= 0) { "语音播放写入失败 ($written)。" }
          if (written > 0) {
            val startNs = if (target.getTimestamp(stamp) && stamp.nanoTime >= resumedAt)
              stamp.nanoTime + (base - stamp.framePosition) * 1_000_000_000L / 16000
            else System.nanoTime() + (base - head) * 1_000_000_000L / 16000
            val block = audio.pcm.copyOfRange(offset, offset + written)
            pending.add(Pending(reference.begin(block, startNs), block, base))
            writtenFrames += written; offset += written
            if (offset == audio.pcm.size) current = null
          }
        }
        // Tiny audio must start even after a real producer underrun. Padding
        // satisfies the device threshold, never subtitle progress or speech PCM.
        if (target != null && current == null && head < writtenFrames && writtenFrames - head < startupThreshold &&
          (head == 0L || System.nanoTime() - progressedAt >= 40_000_000L)) {
          val padding = ShortArray(minOf(512, (startupThreshold - (writtenFrames - head)).toInt()))
          val written = synchronized(target) {
            if (!owned()) 0 else target.write(padding, 0, padding.size, AudioTrack.WRITE_NON_BLOCKING)
          }
          check(written >= 0) { "语音起播填充失败 ($written)。" }
          writtenFrames += written
        }
        if (current == null && !timeline.pending && terminal == null) {
          if (playing) { playing = false; playback(false) }
          waiting(); progressedAt = System.nanoTime()
        } else if (target != null) check(System.nanoTime() - progressedAt < 3_000_000_000L) { "播放器没有消费音频。" }
        Thread.sleep(2)
      }
    } catch (error: IllegalStateException) {
      if (owned()) throw error
    } finally {
      for (item in pending) reference.end(item.id, (lastHead - item.base).coerceIn(0L, item.pcm.size.toLong()).toInt())
      // Release this answer's track, including allocation/cancellation races.
      output?.let { old -> if (track.compareAndSet(old, null)) synchronized(old) { runCatching { old.pause(); old.flush(); old.stop(); old.release() } } }
    }
    return VoicePlaybackResult(timeline.playedFrames, timeline.queuedFrames, timeline.prefedBoundaries, underruns, terminal?.error)
  }
}
