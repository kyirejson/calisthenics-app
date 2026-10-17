package uncover.voice

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.AudioPlaybackConfiguration
import android.os.Handler
import android.os.Looper
import android.util.Log

/** Public playback metadata only. Never claims access to another app's PCM or speaker identity. */
internal class VoiceExternalPlayback(context: Context) {
  private val manager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
  private val gate = VoiceExternalAudioGate()
  @Volatile var available = false; private set
  @Volatile private var closed = false
  private var registered = false
  private var refreshedAt = 0L
  private var metadataAt = 0L
  private val callback = object : AudioManager.AudioPlaybackCallback() {
    override fun onPlaybackConfigChanged(configs: MutableList<AudioPlaybackConfiguration>) { update(configs, System.nanoTime()) }
  }
  @Synchronized private fun update(configs: List<AudioPlaybackConfiguration>, nowNs: Long) {
    if (closed || nowNs < metadataAt) return
    metadataAt = nowNs
    val navigation = configs.any { it.audioAttributes.usage == AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE }
    val speech = configs.any { it.audioAttributes.contentType == AudioAttributes.CONTENT_TYPE_SPEECH &&
      it.audioAttributes.usage != AudioAttributes.USAGE_ASSISTANT }
    gate.update(navigation || speech, nowNs, if (navigation) "navigation" else "external_speech")
    available = true
  }
  fun start() {
    if (closed || registered) return
    runCatching { manager.registerAudioPlaybackCallback(callback, Handler(Looper.getMainLooper())); registered = true }
      .onFailure { Log.w("MAX-VoiceInput", "Playback callback unavailable; using periodic public metadata refresh") }
    refresh(System.nanoTime())
  }
  fun refresh(nowNs: Long) {
    synchronized(this) {
      if (closed || refreshedAt != 0L && nowNs - refreshedAt < 1_000_000_000L) return
      refreshedAt = nowNs
    }
    runCatching { update(manager.activePlaybackConfigurations, nowNs) }.onFailure {
      synchronized(this) {
        if (closed || nowNs < metadataAt) return@onFailure
        metadataAt = nowNs
        available = false
        // A failed/missed callback must not leave an old open interval muting input forever.
        gate.update(false, nowNs)
      }
    }
  }
  fun state(captureTimeNs: Long) = gate.state(captureTimeNs)
  @Synchronized fun close() {
    closed = true; available = false
    if (registered) runCatching { manager.unregisterAudioPlaybackCallback(callback) }
    registered = false
  }
}
