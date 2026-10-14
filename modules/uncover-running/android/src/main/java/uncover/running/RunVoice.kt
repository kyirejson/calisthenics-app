package uncover.running

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import org.json.JSONObject
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger

/** Two bundled speakers; no device TTS dependency, network, or pitch substitution. */
internal class RunVoice(private val context: Context) {
  private val main = Handler(Looper.getMainLooper())
  private val worker = Executors.newSingleThreadExecutor()
  private val audio = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
  private val attributes = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build()
  private val generation = AtomicInteger()
  private val loadGeneration = AtomicInteger()
  private val focusChange = AudioManager.OnAudioFocusChangeListener { change -> if (change < 0) main.post { generation.incrementAndGet(); releasePlayback() } }
  private var request: AudioFocusRequest? = null
  private var track: AudioTrack? = null
  private var checkCompletion: Runnable? = null
  private var style = ""
  private var pack: Pack? = null
  @Volatile private var ready = false
  @Volatile private var closed = false
  @Volatile private var pending: String? = null
  private data class Pack(val clips: JSONObject, val pcm: ShortArray, val rate: Int) {
    fun compose(keys: List<String>): ShortArray {
      val frames = keys.sumOf { clips.getJSONObject(it).getInt("length") }
      require(frames in 1..rate * 60)
      val result = ShortArray(frames)
      var cursor = 0
      for (key in keys) {
        val clip = clips.getJSONObject(key); val start = clip.getInt("start"); val length = clip.getInt("length")
        require(start >= 0 && length > 0 && start + length <= pcm.size)
        pcm.copyInto(result, cursor, start, start + length); cursor += length
      }
      return result
    }
  }
  fun isReady() = ready && !closed
  fun start() { selectStyle(RunStore.options(context).optString("voiceStyle", "female")) }
  fun selectStyle(value: String) {
    RunVoiceClips.cleanStyle(value)
    main.post {
      if (closed || style == value) return@post
      style = value; ready = false; pack = null
      generation.incrementAndGet(); val token = loadGeneration.incrementAndGet(); releasePlayback()
      worker.execute {
        try {
          val manifest = context.assets.open("run-voices/manifest.json").bufferedReader().use { JSONObject(it.readText()) }
          val metadata = manifest.getJSONObject("voices").getJSONObject(value)
          val bytes = context.assets.open("run-voices/$value.wav").use { it.readBytes() }
          require(bytes.size == 44 + metadata.getInt("frames") * 2 && String(bytes, 0, 4) == "RIFF" && String(bytes, 36, 4) == "data")
          val samples = ShortArray(metadata.getInt("frames"))
          ByteBuffer.wrap(bytes, 44, bytes.size - 44).order(ByteOrder.LITTLE_ENDIAN).asShortBuffer().get(samples)
          val loaded = Pack(metadata.getJSONObject("clips"), samples, manifest.getInt("sampleRate"))
          main.post loaded@{
            if (closed || loadGeneration.get() != token) return@loaded
            pack = loaded; ready = true; RunStore.speechIssue = ""
            pending?.let { pending = null; say(it) }
          }
        } catch (_: Exception) { main.post { if (!closed && loadGeneration.get() == token) { RunStore.speechIssue = "内置语音加载失败，跑步记录不受影响。"; pending = null } } }
      }
    }
  }
  fun say(text: String): Boolean {
    if (closed) return false
    if (!ready) { pending = text; return false }
    val keys = try { RunVoiceClips.forText(text) } catch (_: Exception) { RunStore.speechIssue = "语音内容无效，跑步记录不受影响。"; return false }
    val selected = pack ?: return false
    val token = generation.incrementAndGet()
    try { worker.execute {
      try { val frames = selected.compose(keys); main.post { if (!closed && generation.get() == token) play(frames, selected.rate, token) } }
      catch (_: Exception) { main.post { if (!closed && generation.get() == token) { RunStore.speechIssue = "语音播报失败，跑步记录不受影响。"; releasePlayback() } } }
    } } catch (_: Exception) { return false }
    return true
  }
  private fun play(frames: ShortArray, rate: Int, token: Int) {
    releasePlayback()
    try {
      val granted = if (Build.VERSION.SDK_INT >= 26) {
        request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK).setAudioAttributes(attributes).setOnAudioFocusChangeListener(focusChange).build()
        audio.requestAudioFocus(request!!)
      } else audio.requestAudioFocus(focusChange, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
      if (granted != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) { RunStore.speechIssue = "当前音频被其他应用占用，本次播报跳过。"; releasePlayback(); return }
      val output = AudioTrack.Builder().setAudioAttributes(attributes).setAudioFormat(AudioFormat.Builder().setSampleRate(rate).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).setEncoding(AudioFormat.ENCODING_PCM_16BIT).build()).setTransferMode(AudioTrack.MODE_STATIC).setBufferSizeInBytes(frames.size * 2).build()
      track = output
      // MODE_STATIC starts as STATE_NO_STATIC_DATA. A successful first write
      // transitions it to STATE_INITIALIZED; checking beforehand rejects it.
      check(output.write(frames, 0, frames.size) == frames.size && output.state == AudioTrack.STATE_INITIALIZED)
      output.play(); RunStore.speechIssue = ""
      val deadline = SystemClock.uptimeMillis() + frames.size * 2000L / rate + 3000
      val checker = object : Runnable { override fun run() {
        if (generation.get() != token || closed) return
        if (output.playbackHeadPosition >= frames.size) releasePlayback()
        else if (SystemClock.uptimeMillis() >= deadline) { RunStore.speechIssue = "音频播放超时，跑步记录不受影响。"; releasePlayback() }
        else main.postDelayed(this, 100)
      } }
      checkCompletion = checker; main.postDelayed(checker, (frames.size * 1000L / rate).coerceAtLeast(100))
    } catch (_: Exception) { RunStore.speechIssue = "语音播报失败，跑步记录不受影响。"; releasePlayback() }
  }
  private fun releasePlayback() {
    checkCompletion?.let { main.removeCallbacks(it) }; checkCompletion = null
    try { track?.stop() } catch (_: Exception) {}
    try { track?.release() } catch (_: Exception) {} finally { track = null }
    try {
      if (Build.VERSION.SDK_INT >= 26) request?.let { audio.abandonAudioFocusRequest(it) }
      else audio.abandonAudioFocus(focusChange)
    } catch (_: Exception) {} finally { request = null }
  }
  fun stop() { closed = true; ready = false; generation.incrementAndGet(); loadGeneration.incrementAndGet(); pending = null; worker.shutdownNow(); main.post { pack = null; releasePlayback() } }
}
