package uncover.voice

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.io.File
import java.util.Locale
import java.util.UUID
import java.util.concurrent.Executors

/** One answer renderer, one in-flight synthesis. Recovery never re-runs the Agent or its tools. */
internal class VoiceSpeaker(private val context: Context, private val reference: VoiceRenderReference, private val enginePackage: String? = null,
  private val progress: (start: Int, end: Int, spokenEnd: Int) -> Unit) {
  private data class Chunk(val start: Int, val end: Int, val text: String, var id: String = "", var file: File? = null, var ready: Boolean = false, var attempts: Int = 0)
  private val handler = Handler(Looper.getMainLooper())
  private val worker = Executors.newSingleThreadExecutor { runnable -> Thread(runnable, "BLACK-speech-render") }
  private val manager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
  private val attributes = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANT).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build()
  private val player = VoicePcmPlayer(reference, attributes)
  private val focus = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK).setAudioAttributes(attributes)
    .setOnAudioFocusChangeListener({ value -> if (value == AudioManager.AUDIOFOCUS_LOSS || value == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) finish("系统音频焦点被占用，语音播放已停止。") }, handler).build()
  private var tts: TextToSpeech? = null
  private var ready = false; private var closed = false; private var engineEpoch = 0
  private var engineName = "系统默认"; private var voiceName = "未选择"
  @Volatile private var generation = 0
  private var done: ((String?) -> Unit)? = null
  private var deadline: Runnable? = null; private var engineDeadline: Runnable? = null
  private var chunks = emptyList<Chunk>(); private var played = 0; private var playing = false; private var inFlight: Chunk? = null
  init {
    context.cacheDir.listFiles()?.filter { it.isFile && it.name.startsWith("black-tts-") && it.name.endsWith(".wav") }?.forEach { it.delete() }
    initialize()
  }
  private fun initialize() {
    if (closed) return
    ready = false; val epoch = ++engineEpoch
    engineDeadline?.let { handler.removeCallbacks(it) }
    runCatching { tts?.shutdown() }; tts = null
    engineDeadline = Runnable { if (engineEpoch == epoch && !ready) engineFailed("初始化超时") }.also { handler.postDelayed(it, 8000) }
    try { tts = TextToSpeech(context, { status -> handler.post {
      if (closed || epoch != engineEpoch) return@post
      engineDeadline?.let { handler.removeCallbacks(it) }; engineDeadline = null
      val engine = tts ?: return@post engineFailed("引擎连接不存在")
      engineName = enginePackage ?: engine.defaultEngine ?: "系统默认"
      if (status != TextToSpeech.SUCCESS) return@post engineFailed("初始化返回 $status")
      try {
        val voices = engine.voices?.filter { it.locale.language == "zh" && !it.features.orEmpty().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED) }
          ?.sortedWith(compareBy<android.speech.tts.Voice> { it.isNetworkConnectionRequired }.thenByDescending { it.quality }).orEmpty()
        val voice = voices.firstOrNull { runCatching { engine.setVoice(it) == TextToSpeech.SUCCESS }.getOrDefault(false) }
        // Some installed engines enumerate usable voices but expose no default for setLanguage.
        // Prefer the explicit installed voice; only use the legacy language API as a fallback.
        if (voice == null) {
          val language = engine.setLanguage(Locale.SIMPLIFIED_CHINESE)
          check(language >= 0) { if (language == TextToSpeech.LANG_MISSING_DATA) "中文音色尚未安装" else "引擎不支持中文（$language）" }
        }
        voiceName = (voice ?: engine.voice)?.name ?: "默认中文"
        engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
          override fun onStart(id: String?) {}
          override fun onDone(id: String?) { handler.post {
            if (epoch != engineEpoch || inFlight?.id != id) return@post
            inFlight?.ready = true; inFlight = null; clearDeadline(); maybePlay(); synthesizeNext()
          } }
          override fun onError(id: String?) { failed(id, TextToSpeech.ERROR_SYNTHESIS) }
          override fun onError(id: String?, code: Int) { failed(id, code) }
          private fun failed(id: String?, code: Int) { handler.post { if (epoch == engineEpoch && inFlight?.id == id) synthesisFailed("合成回调", code) } }
        })
        ready = true; synthesizeNext()
      } catch (error: Exception) { engineFailed(error.message ?: "中文音色不可用") }
    } }, enginePackage) } catch (error: Exception) { engineFailed(error.message ?: "无法连接语音服务") }
  }
  private fun engineFailed(reason: String) {
    ready = false
    engineDeadline?.let { handler.removeCallbacks(it) }; engineDeadline = null
    if (done != null) finish("语音引擎 $engineName：$reason。")
  }
  private fun clearDeadline() { deadline?.let { handler.removeCallbacks(it) }; deadline = null }
  private fun clean() {
    clearDeadline(); inFlight = null; tts?.stop(); player.stop()
    chunks.forEach { it.file?.delete() }; chunks = emptyList(); played = 0; playing = false
    manager.abandonAudioFocusRequest(focus)
  }
  private fun finish(error: String? = null) { val callback = done; done = null; ++generation; clean(); callback?.invoke(error) }
  fun speak(text: String, callback: (String?) -> Unit) {
    stop(); done = callback
    if (manager.requestAudioFocus(focus) != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) { finish("系统未允许播放语音，可能正在通话。"); return }
    var offset = 0
    chunks = VoiceSpeechChunks.split(text, minOf(TextToSpeech.getMaxSpeechInputLength() - 1, 160).coerceAtLeast(2)).map { block -> val start = offset; offset += block.length; Chunk(start, offset, block) }
    if (chunks.isEmpty()) { finish(); return }
    if (!ready && engineDeadline == null) initialize() else synthesizeNext()
  }
  private fun synthesizeNext() {
    if (done == null || !ready || inFlight != null || closed) return
    val chunk = chunks.drop(played).take(2).firstOrNull { !it.ready } ?: return
    chunk.id = UUID.randomUUID().toString(); chunk.attempts++
    val file = runCatching { File.createTempFile("black-tts-", ".wav", context.cacheDir) }.getOrElse { finish("语音缓存创建失败：${it.message}"); return }
    chunk.file?.delete(); chunk.file = file; inFlight = chunk
    val result = runCatching { tts?.synthesizeToFile(chunk.text, Bundle(), file, chunk.id) ?: TextToSpeech.ERROR }
    if (result.getOrDefault(TextToSpeech.ERROR) != TextToSpeech.SUCCESS) { synthesisFailed("请求入队", result.getOrDefault(TextToSpeech.ERROR)); return }
    val epoch = engineEpoch; val id = chunk.id
    clearDeadline()
    deadline = Runnable { if (epoch == engineEpoch && inFlight?.id == id) synthesisFailed("合成超时", TextToSpeech.ERROR_SERVICE) }.also { handler.postDelayed(it, 20000) }
  }
  private fun synthesisFailed(stage: String, code: Int) {
    val failed = inFlight ?: return
    clearDeadline(); inFlight = null; failed.file?.delete(); failed.file = null
    if (failed.attempts < 2) { initialize(); return }
    finish("语音合成失败：$stage，返回 $code；引擎 $engineName，音色 $voiceName。已重连一次，文字回答仍保留。")
  }
  private fun maybePlay() {
    if (playing || played >= chunks.size || !chunks[played].ready || done == null) return
    val token = generation; val chunk = chunks[played]; playing = true
    worker.execute {
      val result = runCatching {
        val audio = VoicePcm.read((chunk.file ?: error("语音缓存不存在。")).readBytes())
        val pcm = VoiceEcho(512).use { it.resample(audio.samples, audio.sampleRate) }
        if (generation != token) return@runCatching
        val count = player.play(pcm, { generation == token }) { handler.post { if (generation == token) progress(chunk.start, chunk.end, chunk.start) } }
        if (generation == token && count == pcm.size) handler.post { if (generation == token) progress(chunk.start, chunk.end, chunk.end) }
      }
      chunk.file?.delete()
      handler.post {
        if (generation != token) return@post
        playing = false
        if (result.isFailure) { finish(result.exceptionOrNull()?.message ?: "语音播放失败。"); return@post }
        played++; if (played == chunks.size) finish() else { maybePlay(); synthesizeNext() }
      }
    }
  }
  fun pause() { player.pause() }
  fun resume() { player.resume() }
  fun stop() { ++generation; done = null; clean() }
  fun close() { stop(); closed = true; ++engineEpoch; engineDeadline?.let { handler.removeCallbacks(it) }; tts?.shutdown(); tts = null; worker.shutdownNow() }
}
