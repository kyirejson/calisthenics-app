package uncover.music

import android.content.ComponentName
import android.content.Context
import android.media.MediaMetadata
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import kotlinx.coroutines.delay
import org.json.JSONObject

/** Observe real state changes while one model-selected operation executes. Main-thread confined. */
internal class MusicPlaybackObservation(private val context: Context, private val provider: String) : AutoCloseable {
  private val controllers = mutableListOf<MediaController>()
  private var changed = false
  private var lastEvent = 0L
  private var error: Exception? = null
  private val manager = context.getSystemService(Context.MEDIA_SESSION_SERVICE) as MediaSessionManager
  private val callback = object : MediaController.Callback() {
    override fun onPlaybackStateChanged(state: PlaybackState?) { mark() }
    override fun onMetadataChanged(metadata: MediaMetadata?) { mark() }
    override fun onSessionDestroyed() { mark() }
  }
  private val listener = MediaSessionManager.OnActiveSessionsChangedListener { sessions -> if (attach(sessions.orEmpty())) mark() }
  private var listening = false
  private fun mark() { changed = true; lastEvent = SystemClock.elapsedRealtime() }
  private fun attach(sessions: List<MediaController>): Boolean {
    val selected = sessions.filter { it.packageName == MusicPolicy.packageFor(provider) }
    val tokensChanged = selected.map { it.sessionToken }.toSet() != controllers.map { it.sessionToken }.toSet()
    controllers.filter { old -> selected.none { it.sessionToken == old.sessionToken } }.toList().forEach { it.unregisterCallback(callback); controllers.remove(it) }
    selected.filter { next -> controllers.none { it.sessionToken == next.sessionToken } }.forEach { it.registerCallback(callback, Handler(Looper.getMainLooper())); controllers.add(it) }
    return tokensChanged
  }
  init {
    try {
      MusicController.playback(context, provider) // Explicit consent and notification access required before callbacks.
      val component = ComponentName(context, MusicNotificationListener::class.java)
      manager.addOnActiveSessionsChangedListener(listener, component, Handler(Looper.getMainLooper()))
      listening = true
      attach(manager.getActiveSessions(component))
    } catch (failure: Exception) { error = failure; close() }
  }
  suspend fun awaitResult(afterAction: Boolean, cancelled: () -> Boolean): JSONObject {
    error?.let { throw it }
    val started = SystemClock.elapsedRealtime()
    while (true) {
      if (cancelled()) throw MusicFailure("cancelled", "音乐请求已取消。")
      val now = SystemClock.elapsedRealtime()
      val expired = now - started >= MusicObservationPolicy.DEADLINE_MS
      val current = MusicController.playback(context, provider)
      // Buffering is a real transitional state, not a reason to declare successful playback.
      val ready = MusicObservationPolicy.ready(now, started, lastEvent, changed, afterAction)
      if ((ready && current.optString("status") != "buffering") || expired) return current.put("observation", JSONObject()
        .put("changed", changed).put("timedOut", expired).put("waitMs", now - started)
        .put("reason", if (expired) "deadline" else if (changed) "event_settled" else if (afterAction) "no_event_fallback" else "current_state"))
      delay(40)
    }
  }
  override fun close() {
    controllers.forEach { runCatching { it.unregisterCallback(callback) } }; controllers.clear()
    if (listening) { runCatching { manager.removeOnActiveSessionsChangedListener(listener) }; listening = false }
  }
}
