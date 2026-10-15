package uncover.voice

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Handler
import android.os.Looper
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
    check(result.samples.isNotEmpty()) { "内置合成引擎没有返回音频。" }
    return VoicePcm(ShortArray(result.samples.size) { (result.samples[it].coerceIn(-1f, 1f) * 32767).toInt().toShort() }, result.sampleRate)
  }
  override fun close() { engine?.release(); engine = null }
}

/** Synthesis and rendering have independent bounded queues. Retries never invoke the business Agent. */
internal class VoiceSpeaker(private val context: Context, private val reference: VoiceRenderReference,
  private val synthesizer: VoiceSynthesizer = LocalVoiceSynthesizer(context),
  private val progress: (start: Int, end: Int, spokenEnd: Int) -> Unit) {
  private data class Packet(val pcm: ShortArray, val start: Int, val end: Int, val last: Boolean = false)
  private val handler = Handler(Looper.getMainLooper())
  private val synthWorker = Executors.newSingleThreadExecutor { Thread(it, "BLACK-local-synthesis") }
  private val renderWorker = Executors.newSingleThreadExecutor { Thread(it, "BLACK-stream-render") }
  private val manager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
  private val attributes = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANT).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build()
  private val player = VoicePcmPlayer(reference, attributes)
  private val focus = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK).setAudioAttributes(attributes)
    .setOnAudioFocusChangeListener({ value -> if (value == AudioManager.AUDIOFOCUS_LOSS || value == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) finish("音频焦点被占用，文字回答已保留。") }, handler).build()
  @Volatile private var generation = 0
  @Volatile private var closed = false
  private var done: ((String?) -> Unit)? = null
  private var deadline: Runnable? = null
  fun prepare(complete: (String?) -> Unit) {
    synthWorker.execute {
      val result = runCatching { synthesizer.prepare() }
      handler.post { if (!closed) complete(result.exceptionOrNull()?.let { "内置语音初始化失败：" + (it.message ?: it.javaClass.simpleName) }) }
    }
  }
  private fun watch(token: Int) {
    deadline?.let(handler::removeCallbacks)
    deadline = Runnable { if (generation == token && done != null) finish("内置语音处理无进展超时（local_output_timeout），文字回答已保留。") }
      .also { handler.postDelayed(it, 30000) }
  }
  private fun finish(error: String? = null) {
    val callback = done; done = null; generation++
    deadline?.let(handler::removeCallbacks); deadline = null
    player.stop(); manager.abandonAudioFocusRequest(focus); callback?.invoke(error)
  }
  fun speak(text: String, callback: (String?) -> Unit) {
    stop(); check(!closed) { "语音输出已关闭。" }; done = callback
    if (manager.requestAudioFocus(focus) != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) { finish("系统未允许播放语音，文字回答已保留。"); return }
    val token = generation; val queue = ArrayBlockingQueue<Packet>(2)
    val blocks = VoiceSpeechChunks.split(text, 40)
    if (blocks.isEmpty()) { finish(); return }
    watch(token)
    fun active() = generation == token && !closed
    fun put(packet: Packet) { while (active()) if (queue.offer(packet, 100, TimeUnit.MILLISECONDS)) return }
    synthWorker.execute {
      try {
        VoiceEcho(512).use { resampler ->
          var start = 0
          for (block in blocks) {
            if (!active()) break
            val audio = synthesizer.generate(block)
            if (!active()) break
            val pcm = resampler.resample(audio.samples, audio.sampleRate)
            put(Packet(pcm, start, start + block.length)); start += block.length
            handler.post { if (active()) watch(token) }
          }
          if (active()) put(Packet(ShortArray(0), 0, 0, true))
        }
      } catch (error: Throwable) { handler.post { if (active()) finish("内置语音合成失败：" + (error.message ?: error.javaClass.simpleName)) } }
    }
    renderWorker.execute {
      try {
        while (active()) {
          val packet = queue.poll(200, TimeUnit.MILLISECONDS) ?: continue
          if (packet.last) { handler.post { if (active()) finish() }; break }
          val played = player.play(packet.pcm, ::active) { handler.post { if (active()) { progress(packet.start, packet.end, packet.start); watch(token) } } }
          if (active() && played != packet.pcm.size) error("音频未完整播放。")
          handler.post { if (active()) { progress(packet.start, packet.end, packet.end); watch(token) } }
        }
      } catch (error: Throwable) { handler.post { if (active()) finish("语音播放失败：" + (error.message ?: error.javaClass.simpleName)) } }
    }
  }
  fun duck(value: Boolean) { player.duck(value) }
  fun stop() {
    generation++; done = null; deadline?.let(handler::removeCallbacks); deadline = null
    player.stop(); manager.abandonAudioFocusRequest(focus)
  }
  fun close() {
    stop(); closed = true
    synthWorker.execute { synthesizer.close() }; synthWorker.shutdown(); renderWorker.shutdownNow()
  }
}
