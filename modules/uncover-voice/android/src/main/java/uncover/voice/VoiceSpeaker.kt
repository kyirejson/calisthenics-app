package uncover.voice

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.util.Locale
import java.util.UUID

internal class VoiceSpeaker(private val context: Context) {
  private val handler = Handler(Looper.getMainLooper())
  private val manager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
  private val attributes = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANT).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build()
  private val focus = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK).setAudioAttributes(attributes).build()
  private var player: MediaPlayer? = null
  private var tts: TextToSpeech? = null
  private var ready = false
  private var generation = 0
  private var done: ((String?) -> Unit)? = null
  private var waiting: (() -> Unit)? = null
  private var deadline: Runnable? = null
  init {
    tts = TextToSpeech(context) { status -> handler.post {
      ready = status == TextToSpeech.SUCCESS && (tts?.setLanguage(Locale.SIMPLIFIED_CHINESE) ?: -1) >= 0
      waiting?.invoke(); waiting = null
    } }
  }
  private fun finish(error: String? = null) {
    deadline?.let { handler.removeCallbacks(it) }; deadline = null
    if (error != null) tts?.stop()
    player?.release(); player = null; waiting = null
    manager.abandonAudioFocusRequest(focus)
    val callback = done; done = null; callback?.invoke(error)
  }
  private fun begin(callback: (String?) -> Unit): Int {
    stop(); done = callback
    check(manager.requestAudioFocus(focus) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) { "系统未允许播放语音，可能正在通话。" }
    return generation
  }
  fun acknowledge(callback: (String?) -> Unit) {
    val token = begin(callback)
    try {
      val media = MediaPlayer(); player = media
      context.assets.openFd("black-voice/iam.wav").use { media.setDataSource(it.fileDescriptor, it.startOffset, it.length) }
      media.setAudioAttributes(attributes)
      media.setOnCompletionListener { if (generation == token) finish() }
      media.setOnErrorListener { _, what, extra -> if (generation == token) finish("本地唤醒声音播放失败 ($what/$extra)。"); true }
      media.prepare(); media.start()
    } catch (error: Exception) { finish(error.message ?: "无法播放“我在”。") }
  }
  fun speak(text: String, callback: (String?) -> Unit) {
    val token = begin(callback)
    val run = fun() {
      if (generation == token) {
        if (!ready) finish("当前手机没有可用的中文语音引擎；请在系统语音设置中安装中文声音。")
        else {
          val id = UUID.randomUUID().toString()
          tts?.setAudioAttributes(attributes)
          tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {}
            override fun onDone(utteranceId: String?) { if (utteranceId == id) handler.post { if (generation == token) finish() } }
            override fun onError(utteranceId: String?) { handler.post { if (generation == token) finish("系统语音合成失败。") } }
          })
          // Respect the engine's transport size, not a semantic limit on the model's answer.
          val size = minOf(TextToSpeech.getMaxSpeechInputLength() - 1, 3000).coerceAtLeast(1)
          val blocks = VoiceSpeechChunks.split(text, size)
          if (blocks.isEmpty()) { finish(); return }
          blocks.forEachIndexed { index, block ->
            if (tts?.speak(block, if (index == 0) TextToSpeech.QUEUE_FLUSH else TextToSpeech.QUEUE_ADD, null,
                if (index == blocks.lastIndex) id else "$id-$index") != TextToSpeech.SUCCESS) {
              finish("系统未接受语音合成请求。"); return
            }
          }
        }
      }
    }
    if (ready) run() else {
      waiting = run
      deadline = Runnable { if (generation == token && waiting != null) { waiting = null; finish("中文语音引擎尚未就绪，请重试。") } }.also { handler.postDelayed(it, 5000) }
    }
  }
  fun stop() { generation++; player?.release(); player = null; tts?.stop(); finish() }
  fun close() { stop(); tts?.shutdown(); tts = null }
}
