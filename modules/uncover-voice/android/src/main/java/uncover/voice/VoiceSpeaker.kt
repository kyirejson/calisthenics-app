package uncover.voice

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTimestamp
import android.media.AudioTrack
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.io.File
import java.util.Locale
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicReference

/** The same controllable PCM renderer handles the local cue and system TTS. Never plays twice via TTS.speak(). */
internal class VoiceSpeaker(private val context: Context, private val reference: VoiceRenderReference,
  private val progress: (start: Int, end: Int, spokenEnd: Int) -> Unit) {
  private data class Chunk(val id: String, val start: Int, val end: Int, val text: String, var file: File? = null, var ready: Boolean = false)
  private val handler = Handler(Looper.getMainLooper())
  private val worker = Executors.newSingleThreadExecutor { runnable -> Thread(runnable, "BLACK-speech-render") }
  private val track = AtomicReference<AudioTrack?>(null)
  private val manager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
  private val attributes = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANT).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build()
  private val focus = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK).setAudioAttributes(attributes)
    .setOnAudioFocusChangeListener({ value -> if (value == AudioManager.AUDIOFOCUS_LOSS || value == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) finish("声音播放被系统打断。") }, handler).build()
  private var tts: TextToSpeech? = null
  private var ready = false
  @Volatile private var generation = 0
  private var done: ((String?) -> Unit)? = null
  private var waiting: (() -> Unit)? = null
  private var deadline: Runnable? = null
  private var chunks = emptyList<Chunk>()
  private var requested = 0; private var played = 0; private var playing = false
  init {
    // Only orphaned generated responses, never microphone audio or user files.
    context.cacheDir.listFiles()?.filter { it.isFile && it.name.startsWith("black-tts-") && it.name.endsWith(".wav") }?.forEach { it.delete() }
    tts = TextToSpeech(context) { status -> handler.post {
      ready = status == TextToSpeech.SUCCESS && (tts?.setLanguage(Locale.SIMPLIFIED_CHINESE) ?: -1) >= 0
      val pending = waiting; waiting = null; pending?.invoke()
    } }
  }
  private fun clean() {
    deadline?.let { handler.removeCallbacks(it) }; deadline = null; waiting = null
    tts?.stop()
    track.get()?.let { runCatching { it.pause(); it.flush(); it.stop() } }
    chunks.forEach { it.file?.delete() }; chunks = emptyList(); requested = 0; played = 0; playing = false
    manager.abandonAudioFocusRequest(focus)
  }
  private fun finish(error: String? = null) {
    val callback = done; done = null; ++generation; clean(); callback?.invoke(error)
  }
  private fun begin(callback: (String?) -> Unit): Int {
    stop(); done = callback
    check(manager.requestAudioFocus(focus) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) { "系统未允许播放语音，可能正在通话。" }
    return generation
  }
  fun acknowledge(callback: (String?) -> Unit) {
    val token = begin(callback)
    worker.execute {
      runCatching { render(VoicePcm.read(context.assets.open("black-voice/iam.wav").use { it.readBytes() }), token, null) }
        .also { result -> handler.post { if (generation == token) finish(result.exceptionOrNull()?.message) } }
    }
  }
  fun speak(text: String, callback: (String?) -> Unit) {
    val token = begin(callback)
    val run = fun() {
      if (generation != token) return
      deadline?.let { handler.removeCallbacks(it) }; deadline = null
      if (!ready) { finish("当前手机没有可用的中文语音引擎；请在系统语音设置中安装中文声音。"); return }
      var offset = 0
      // Per-chunk transport bound, not a cap on the model's full answer. Queue only two chunks ahead.
      chunks = VoiceSpeechChunks.split(text, minOf(TextToSpeech.getMaxSpeechInputLength() - 1, 160).coerceAtLeast(2)).map { block ->
        val start = offset; offset += block.length
        Chunk(UUID.randomUUID().toString(), start, offset, block)
      }
      if (chunks.isEmpty()) { finish(); return }
      tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
        override fun onStart(utteranceId: String?) {}
        override fun onDone(utteranceId: String?) { handler.post {
          if (generation == token) {
            chunks.firstOrNull { it.id == utteranceId }?.ready = true
            maybePlay(token)
          }
        } }
        override fun onError(utteranceId: String?) { handler.post { if (generation == token) finish("系统语音合成失败。") } }
        override fun onError(utteranceId: String?, errorCode: Int) { handler.post { if (generation == token) finish("系统语音合成失败 ($errorCode)。") } }
      })
      synthesizeAhead(token)
    }
    if (ready) run() else {
      waiting = run
      deadline = Runnable { if (generation == token && waiting != null) finish("中文语音引擎尚未就绪，请重试。") }.also { handler.postDelayed(it, 5000) }
    }
  }
  private fun synthesizeAhead(token: Int) {
    while (generation == token && requested < chunks.size && requested - played < 2) {
      val chunk = chunks[requested++]
      val file = runCatching { File.createTempFile("black-tts-", ".wav", context.cacheDir) }.getOrElse { finish("语音缓存未能创建：${it.message}"); return }
      chunk.file = file
      if (tts?.synthesizeToFile(chunk.text, null, file, chunk.id) != TextToSpeech.SUCCESS) {
        finish("系统未接受语音合成请求。"); return
      }
    }
    if (!playing && played < chunks.size && !chunks[played].ready) {
      deadline?.let { handler.removeCallbacks(it) }
      deadline = Runnable { if (generation == token && !playing && played < chunks.size && !chunks[played].ready) finish("系统语音合成超时，请检查中文语音引擎。"); }.also { handler.postDelayed(it, 20000) }
    }
  }
  private fun maybePlay(token: Int) {
    if (generation != token || playing || played >= chunks.size || !chunks[played].ready) return
    deadline?.let { handler.removeCallbacks(it) }; deadline = null
    val chunk = chunks[played]; playing = true
    worker.execute {
      val result = runCatching { render(VoicePcm.read((chunk.file ?: error("语音缓存不存在。")).readBytes()), token, chunk) }
      chunk.file?.delete()
      handler.post {
        if (generation != token) return@post
        playing = false
        if (result.isFailure) { finish(result.exceptionOrNull()?.message ?: "语音播放失败。"); return@post }
        played++
        if (played == chunks.size) finish()
        else { synthesizeAhead(token); maybePlay(token) }
      }
    }
  }
  private fun render(audio: VoicePcm, token: Int, chunk: Chunk?) {
    if (generation != token) return
    val pcm = VoiceEcho(512).use { it.resample(audio.samples, audio.sampleRate) }
    if (generation != token) return
    val output = AudioTrack.Builder().setAudioAttributes(attributes).setAudioFormat(AudioFormat.Builder()
      .setSampleRate(16000).setEncoding(AudioFormat.ENCODING_PCM_16BIT).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
      .setTransferMode(AudioTrack.MODE_STATIC).setBufferSizeInBytes(pcm.size * 2).build()
    var referenceId = 0L; var actualPlayed = 0; var announced = false
    try {
      // MODE_STATIC starts in STATE_NO_STATIC_DATA even when creation succeeded.
      // It becomes STATE_INITIALIZED only after the first successful write.
      check(output.state != AudioTrack.STATE_UNINITIALIZED) { "系统未能创建语音播放器（状态 ${output.state}）。" }
      if (generation != token) return
      track.set(output)
      val written = output.write(pcm, 0, pcm.size)
      check(written == pcm.size) { "语音音频未完整送入播放缓冲区（$written/${pcm.size}）。" }
      check(output.state == AudioTrack.STATE_INITIALIZED) { "语音音频已写入，但播放器尚未就绪（状态 ${output.state}）。" }
      if (generation != token) return
      referenceId = reference.begin(pcm, System.nanoTime())
      output.play()
      val stamp = AudioTimestamp(); val startNs = System.nanoTime()
      while (generation == token && actualPlayed < pcm.size) {
        if (output.getTimestamp(stamp)) reference.clock(referenceId, stamp.framePosition, stamp.nanoTime)
        actualPlayed = output.playbackHeadPosition.coerceIn(0, pcm.size)
        if (!announced && actualPlayed > 0 && chunk != null) {
          announced = true; handler.post { if (generation == token) progress(chunk.start, chunk.end, chunk.start) }
        }
        check(System.nanoTime() - startNs < pcm.size * 1_000_000_000L / 16000 + 5_000_000_000L) { "系统语音播放没有进展，请检查音频输出。" }
        Thread.sleep(10)
      }
      if (generation == token && chunk != null) handler.post { if (generation == token) progress(chunk.start, chunk.end, chunk.end) }
    } finally {
      if (referenceId != 0L) reference.end(referenceId, actualPlayed)
      track.compareAndSet(output, null)
      runCatching { output.stop() }; output.release()
    }
  }
  fun stop() { ++generation; done = null; clean() }
  fun close() { stop(); tts?.shutdown(); tts = null; worker.shutdownNow() }
}
