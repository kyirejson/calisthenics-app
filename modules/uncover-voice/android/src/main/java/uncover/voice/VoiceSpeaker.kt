package uncover.voice

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import com.k2fsa.sherpa.onnx.*

internal interface VoiceSynthesizer : AutoCloseable {
  fun prepare()
  fun generate(text: String): VoicePcm
}

/** Bundled MIT MeloTTS model. No Android TTS engine, account, network or automatic fallback. */
internal class LocalVoiceSynthesizer(private val context: Context) : VoiceSynthesizer {
  private var engine: OfflineTts? = null
  override fun prepare() {
    if (engine != null) return
    val p = "black-voice/tts"
    engine = OfflineTts(context.assets, OfflineTtsConfig(model = OfflineTtsModelConfig(vits = OfflineTtsVitsModelConfig(
      model = "$p/model.onnx", lexicon = "$p/lexicon.txt", tokens = "$p/tokens.txt"), numThreads = 2),
      ruleFsts = listOf("phone", "date", "number").joinToString(",") { "$p/$it.fst" }))
  }
  override fun generate(text: String): VoicePcm {
    prepare()
    val result = engine!!.generate(text, 0, 1f)
    if (result.samples.isEmpty()) throw VoiceSynthesisException("synthesis_empty", "内置合成引擎没有返回音频。")
    return VoicePcm(ShortArray(result.samples.size) { (result.samples[it].coerceIn(-1f, 1f) * 32767).toInt().toShort() }, result.sampleRate)
  }
  override fun close() { engine?.release(); engine = null }
}

/** Synthesis and rendering have independent bounded queues. Retries never invoke the business Agent. */
internal class VoiceSpeaker(private val context: Context, private val reference: VoiceRenderReference,
  private val synthesizer: VoiceSynthesizer = LocalVoiceSynthesizer(context),
  private val outputTimeoutMs: Long = 30000,
  private val progress: (start: Int, end: Int, spokenEnd: Int) -> Unit) {
  private sealed interface Packet {
    data class Audio(val pcm: ShortArray, val start: Int, val end: Int) : Packet
    data class End(val error: String? = null) : Packet
  }
  private val handler = Handler(Looper.getMainLooper())
  private val synthWorker = Executors.newSingleThreadExecutor { Thread(it, "BLACK-local-synthesis") }
  private val renderWorker = Executors.newSingleThreadExecutor { Thread(it, "BLACK-stream-render") }
  private val manager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
  private val attributes = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANT).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build()
  private val player = VoicePcmPlayer(reference, attributes)
  private var focus: AudioFocusRequest? = null
  @Volatile private var generation = 0
  @Volatile private var closed = false
  private var done: ((String?) -> Unit)? = null
  fun prepare(complete: (String?) -> Unit) {
    synthWorker.execute {
      val result = runCatching { synthesizer.prepare() }
      handler.post { if (!closed) complete(result.exceptionOrNull()?.let { "内置语音初始化失败：" + (it.message ?: it.javaClass.simpleName) }) }
    }
  }
  private fun releaseFocus() {
    val previous = focus; focus = null
    previous?.let(manager::abandonAudioFocusRequest)
  }
  private fun finish(token: Int, error: String? = null) {
    if (generation != token || done == null) return
    val callback = done; done = null; generation++
    Log.i("BLACK-VoiceOutput", "request=$token outcome=${if (error == null) "completed" else "failed"}")
    player.stop(); releaseFocus(); callback?.invoke(error)
  }
  fun speak(text: String, callback: (String?) -> Unit) {
    stop(); check(!closed) { "语音输出已关闭。" }; done = callback
    val token = generation; val queue = ArrayBlockingQueue<Packet>(2)
    val blocks = VoiceSpeechChunks.split(text, 40)
    if (blocks.isEmpty()) { finish(token); return }
    // A late focus event from a cancelled answer cannot stop its replacement.
    val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK).setAudioAttributes(attributes)
      .setOnAudioFocusChangeListener({ value ->
        if (value == AudioManager.AUDIOFOCUS_LOSS || value == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) {
          Log.i("BLACK-VoiceOutput", "request=$token event=focus_loss value=$value")
          finish(token, "音频焦点被占用（audio_focus_lost），完整文字已保留。")
        }
      }, handler).build()
    focus = request
    if (manager.requestAudioFocus(request) != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
      finish(token, "系统未允许播放语音（audio_focus_denied），完整文字已保留。"); return
    }
    val work = VoiceOutputProgress(blocks.size, SystemClock.elapsedRealtime(), outputTimeoutMs)
    Log.i("BLACK-VoiceOutput", "request=$token event=queued segments=${blocks.size} sourceChars=${text.length}")
    fun active() = generation == token && !closed
    fun put(packet: Packet): Boolean { while (active()) if (queue.offer(packet, 100, TimeUnit.MILLISECONDS)) return true; return false }
    fun synthesize(index: Int, block: VoiceSpeechChunk): VoicePcm? {
      for (attempt in 1..2) {
        if (!active()) return null
        work.synthesis(index, block, attempt, SystemClock.elapsedRealtime())
        Log.i("BLACK-VoiceOutput", "request=$token event=synthesis_start ${work.details(SystemClock.elapsedRealtime())}")
        try {
          val audio = synthesizer.generate(block.text)
          if (!active()) return null // Native inference may return after a real cancellation/timeout.
          if (audio.samples.none { it != 0.toShort() })
            throw VoiceSynthesisException("synthesis_invalid_audio", "内置合成引擎返回了无效或全静音音频。")
          Log.i("BLACK-VoiceOutput", "request=$token event=synthesis_ready samples=${audio.samples.size} rate=${audio.sampleRate} ${work.details(SystemClock.elapsedRealtime())}")
          return audio
        } catch (error: VoiceSynthesisException) {
          if (!active()) return null
          if (error.code != "synthesis_empty" || attempt == 2) throw error
          Log.w("BLACK-VoiceOutput", "request=$token event=retry_empty_audio ${work.details(SystemClock.elapsedRealtime())}")
        }
      }
      return null
    }
    synthWorker.execute {
      if (!active()) return@execute
      try {
        work.preparing(SystemClock.elapsedRealtime())
        synthesizer.prepare()
        if (!active()) return@execute
        VoiceEcho(512).use { resampler ->
          for ((index, block) in blocks.withIndex()) {
            if (!active()) break
            val audio = synthesize(index + 1, block) ?: break
            if (!active()) break
            val pcm = resampler.resample(audio.samples, audio.sampleRate)
            if (pcm.isEmpty()) throw VoiceSynthesisException("synthesis_invalid_audio", "重采样后没有可播放的音频。")
            work.buffered(SystemClock.elapsedRealtime())
            if (!put(Packet.Audio(pcm, block.start, block.end))) break
          }
        }
        if (active()) { work.ended(SystemClock.elapsedRealtime()); put(Packet.End()) }
      } catch (error: Throwable) {
        if (active()) {
          Log.e("BLACK-VoiceOutput", "request=$token event=synthesis_failed type=${error.javaClass.simpleName} ${work.details(SystemClock.elapsedRealtime())}")
          // FIFO terminal events drain all earlier audio; synthesis failure must not cut off a healthy sentence.
          val message = work.failure(error); work.ended(SystemClock.elapsedRealtime()); put(Packet.End(message))
        }
      }
    }
    renderWorker.execute {
      try {
        while (active()) {
          val packet = queue.poll(100, TimeUnit.MILLISECONDS)
          if (packet == null) {
            // Only waiting for missing audio is timed. Player consumption has its own watchdog.
            work.timeout(SystemClock.elapsedRealtime())?.let { error(it) }
            continue
          }
          if (packet is Packet.End) { handler.post { finish(token, packet.error) }; break }
          packet as Packet.Audio
          Log.i("BLACK-VoiceOutput", "request=$token event=playback_start range=${packet.start}:${packet.end}")
          val played = player.play(packet.pcm, ::active) { handler.post { if (active()) progress(packet.start, packet.end, packet.start) } }
          if (active() && played != packet.pcm.size) error("音频未完整播放。")
          handler.post { if (active()) progress(packet.start, packet.end, packet.end) }
          Log.i("BLACK-VoiceOutput", "request=$token event=playback_end range=${packet.start}:${packet.end} played=$played/${packet.pcm.size}")
        }
      } catch (error: Throwable) {
        if (active()) {
          Log.e("BLACK-VoiceOutput", "request=$token event=output_failed type=${error.javaClass.simpleName} ${work.details(SystemClock.elapsedRealtime())}")
          handler.post { finish(token, "语音输出失败：${error.message ?: error.javaClass.simpleName} 完整文字已保留。") }
        }
      }
    }
  }
  fun duck(value: Boolean) { player.duck(value) }
  fun stop() {
    if (done != null) Log.i("BLACK-VoiceOutput", "request=$generation event=cancelled")
    generation++; done = null
    player.stop(); releaseFocus()
  }
  fun close() {
    stop(); closed = true
    synthWorker.execute { synthesizer.close() }; synthWorker.shutdown(); renderWorker.shutdownNow()
  }
}
