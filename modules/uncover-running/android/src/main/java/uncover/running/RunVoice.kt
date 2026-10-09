package uncover.running

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.util.Locale

/** Native speech survives page changes and screen lock. Failure never stops recording. */
internal class RunVoice(private val context: Context) {
  private val main = Handler(Looper.getMainLooper())
  private val audio = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
  private val attributes = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build()
  private val focusChange = AudioManager.OnAudioFocusChangeListener { change -> if (change < 0) { try { engine?.stop() } catch (_: Exception) {} } }
  private var request: AudioFocusRequest? = null
  private var engine: TextToSpeech? = null
  @Volatile private var ready = false
  @Volatile private var closed = false
  private var pending: String? = null
  fun isReady() = ready && !closed
  fun start() { main.post {
    if (closed) return@post
    try {
      engine = TextToSpeech(context) { status -> main.post {
        if (closed) return@post
        val tts = engine
        if (status != TextToSpeech.SUCCESS || tts == null) { RunStore.speechIssue = "手机语音引擎不可用；记录继续。可在系统设置安装中文语音。"; return@post }
        try {
          val language = tts.setLanguage(Locale.SIMPLIFIED_CHINESE)
          if (language < 0) { RunStore.speechIssue = "手机缺少中文语音包；记录继续。请安装中文语音或关闭播报。"; return@post }
          tts.setAudioAttributes(attributes)
          tts.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
          override fun onStart(id: String?) {}
          override fun onDone(id: String?) { main.post { releaseFocus() } }
          @Deprecated("Deprecated in Android") override fun onError(id: String?) { RunStore.speechIssue = "语音播报失败，跑步记录不受影响。"; main.post { releaseFocus() } }
          })
          ready = true; RunStore.speechIssue = ""
          pending?.let { pending = null; say(it) }
        } catch (_: Exception) { RunStore.speechIssue = "中文语音初始化失败，跑步记录不受影响。" }
      } }
    } catch (_: Exception) { RunStore.speechIssue = "手机语音引擎启动失败，跑步记录不受影响。" }
  } }
  fun say(text: String): Boolean {
    if (closed) return false
    if (!ready) { pending = text; return false }
    main.post {
      if (!ready || closed) return@post
      try {
      val granted = if (Build.VERSION.SDK_INT >= 26) {
        request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK).setAudioAttributes(attributes).setOnAudioFocusChangeListener(focusChange).build()
        audio.requestAudioFocus(request!!)
      } else audio.requestAudioFocus(focusChange, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
      if (granted != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) { RunStore.speechIssue = "当前音频被其他应用占用，本次播报跳过。"; return@post }
      if (engine?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "run_" + System.nanoTime()) != TextToSpeech.SUCCESS) {
        RunStore.speechIssue = "语音播报失败，跑步记录不受影响。"; releaseFocus()
      }
      } catch (_: Exception) { RunStore.speechIssue = "语音播报失败，跑步记录不受影响。"; releaseFocus() }
    }
    return true
  }
  private fun releaseFocus() {
    try {
    if (Build.VERSION.SDK_INT >= 26) request?.let { audio.abandonAudioFocusRequest(it) }
    else audio.abandonAudioFocus(focusChange)
    request = null
    } catch (_: Exception) { request = null }
  }
  fun stop() { closed = true; ready = false; pending = null; main.post { try { engine?.stop(); engine?.shutdown() } catch (_: Exception) {} finally { engine = null; releaseFocus() } } }
}
