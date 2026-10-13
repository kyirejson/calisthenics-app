package uncover.music

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import android.content.Intent
import android.app.NotificationManager
import android.media.MediaMetadata
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.net.Uri
import android.provider.MediaStore
import android.provider.Settings
import android.os.Build
import android.os.Bundle
import org.json.JSONArray
import org.json.JSONObject

internal object MusicController {
  fun notificationAccess(context: Context): Boolean {
    val component = ComponentName(context, MusicNotificationListener::class.java)
    if (Build.VERSION.SDK_INT >= 27) return (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).isNotificationListenerAccessGranted(component)
    return Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners").orEmpty().split(':').any { ComponentName.unflattenFromString(it) == component }
  }
  fun accessibilityAccess(context: Context): Boolean {
    val component = ComponentName(context, MusicAccessibilityService::class.java)
    return Settings.Secure.getString(context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES).orEmpty().split(':').any { ComponentName.unflattenFromString(it) == component }
  }
  private fun searchIntent(provider: String): Intent = Intent(MediaStore.INTENT_ACTION_MEDIA_PLAY_FROM_SEARCH).setPackage(MusicPolicy.packageFor(provider))
  fun capabilities(context: Context, provider: String): JSONObject {
    val info = try { context.packageManager.getPackageInfo(MusicPolicy.packageFor(provider), 0) } catch (_: Exception) { null }
    val result = JSONObject().put("provider", provider).put("native", true).put("installed", info != null).put("version", info?.versionName ?: JSONObject.NULL)
      .put("searchIntent", searchIntent(provider).resolveActivity(context.packageManager) != null)
      .put("accessibilityGranted", accessibilityAccess(context)).put("accessibilityConnected", MusicAccessibilityService.instance != null)
      .put("screenConsent", MusicLedger.consent(context, "screen")).put("playbackConsent", MusicLedger.consent(context, "playback"))
      .put("notificationAccess", notificationAccess(context))
      .put("taskNotificationsEnabled", (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).areNotificationsEnabled())
    val background = MusicBackground.capability(context)
    background.keys().forEach { key -> result.put(key, background.get(key)) }
    return result
  }
  private fun session(context: Context, provider: String): MediaController? {
    if (!notificationAccess(context) || !MusicLedger.consent(context, "playback")) throw MusicFailure("playback_permission_required", "请在音乐设置中授权读取播放状态，并在系统中开启通知使用权。")
    val manager = context.getSystemService(Context.MEDIA_SESSION_SERVICE) as MediaSessionManager
    return try { manager.getActiveSessions(ComponentName(context, MusicNotificationListener::class.java)).firstOrNull { it.packageName == MusicPolicy.packageFor(provider) } }
    catch (_: SecurityException) { throw MusicFailure("playback_access_unavailable", "系统尚未连接播放状态接口；请确认通知使用权已开启，返回应用后重试。") }
  }
  private val controls = mapOf("play" to PlaybackState.ACTION_PLAY, "pause" to PlaybackState.ACTION_PAUSE, "next" to PlaybackState.ACTION_SKIP_TO_NEXT, "previous" to PlaybackState.ACTION_SKIP_TO_PREVIOUS, "stop" to PlaybackState.ACTION_STOP, "seek" to PlaybackState.ACTION_SEEK_TO,
    "play_from_search" to PlaybackState.ACTION_PLAY_FROM_SEARCH, "play_from_media_id" to PlaybackState.ACTION_PLAY_FROM_MEDIA_ID)
  fun playback(context: Context, provider: String): JSONObject {
    val session = session(context, provider) ?: return JSONObject().put("ok", true).put("provider", provider).put("status", "no_session").put("verifiedPlaying", false)
    val state = session.playbackState
    val metadata = session.metadata
    val status = when (state?.state) {
      PlaybackState.STATE_PLAYING -> "playing"
      PlaybackState.STATE_PAUSED -> "paused"
      PlaybackState.STATE_BUFFERING, PlaybackState.STATE_CONNECTING -> "buffering"
      PlaybackState.STATE_ERROR -> "error"
      PlaybackState.STATE_STOPPED, PlaybackState.STATE_NONE -> "stopped"
      else -> "unknown"
    }
    return JSONObject().put("ok", true).put("provider", provider).put("source", "media_session").put("status", status)
      .put("verifiedPlaying", state?.state == PlaybackState.STATE_PLAYING).put("observedAt", System.currentTimeMillis())
      .put("title", metadata?.getString(MediaMetadata.METADATA_KEY_TITLE) ?: JSONObject.NULL)
      .put("artist", metadata?.getString(MediaMetadata.METADATA_KEY_ARTIST) ?: JSONObject.NULL)
      .put("album", metadata?.getString(MediaMetadata.METADATA_KEY_ALBUM) ?: JSONObject.NULL)
      .put("durationMs", metadata?.getLong(MediaMetadata.METADATA_KEY_DURATION) ?: JSONObject.NULL)
      .put("mediaId", metadata?.getString(MediaMetadata.METADATA_KEY_MEDIA_ID) ?: JSONObject.NULL)
      .put("positionMs", state?.position ?: JSONObject.NULL).put("error", state?.errorMessage?.toString() ?: JSONObject.NULL)
      .put("actions", JSONArray(controls.filter { (_, flag) -> (state?.actions ?: 0L) and flag != 0L }.keys.toList()))
      .put("rawActions", state?.actions ?: 0L)
      .put("playlistVerified", false).put("audibleVerified", false)
  }
  fun prepareControl(context: Context, provider: String, command: JSONObject): () -> Boolean {
    val controller = session(context, provider) ?: throw MusicFailure("no_session", "选定的音乐软件没有有效播放会话，请先打开并选择音乐。")
    val action = command.getString("action")
    val flag = controls[action] ?: throw MusicFailure("unsupported_action", "播放器不支持此控制。")
    if ((controller.playbackState?.actions ?: 0L) and flag == 0L) throw MusicFailure("unsupported_action", "选定播放器未提供此控制，请从真实音乐界面操作。")
    val position = if (action == "seek") command.optDouble("positionMs", -1.0) else 0.0
    if (!position.isFinite() || position < 0) throw MusicFailure("invalid_position", "播放位置应为非负毫秒数。")
    if (action == "play_from_media_id" && command.optString("mediaId").isBlank()) throw MusicFailure("missing_media_id", "请使用真实音乐结果或播放队列提供的音乐编号。")
    val extras = Bundle().apply {
      if (command.has("title")) putString(MediaStore.EXTRA_MEDIA_TITLE, command.getString("title"))
      if (command.has("artist")) putString(MediaStore.EXTRA_MEDIA_ARTIST, command.getString("artist"))
    }
    return {
      controller.transportControls.apply {
        when (action) { "play" -> play(); "pause" -> pause(); "next" -> skipToNext(); "previous" -> skipToPrevious(); "stop" -> stop(); "seek" -> seekTo(position.toLong()); "play_from_search" -> playFromSearch(command.optString("query"), extras); "play_from_media_id" -> playFromMediaId(command.getString("mediaId"), extras) }
      }
      true
    }
  }
  fun prepareOpen(context: Context, provider: String, command: JSONObject): Pair<Intent, String> {
    try { context.packageManager.getPackageInfo(MusicPolicy.packageFor(provider), 0) } catch (_: PackageManager.NameNotFoundException) { throw MusicFailure("not_installed", "未安装选定的音乐软件，请先安装后重试。") }
    val packageName = MusicPolicy.packageFor(provider)
    val uri = command.optString("uri")
    val query = command.optString("query")
    val intent: Intent
    val status: String
    if (uri.isNotBlank()) {
      if (!MusicPolicy.acceptsUri(provider, uri)) throw MusicFailure("invalid_music_uri", "链接不属于选定音乐软件，请从音乐软件分享或通过界面搜索。")
      intent = Intent(Intent.ACTION_VIEW, Uri.parse(uri)).setPackage(packageName).putExtra("android.intent.extra.START_PLAYBACK", true)
      status = "dispatched"
    } else if (query.isNotBlank()) {
      intent = searchIntent(provider).putExtra("query", query)
        .putExtra(MediaStore.EXTRA_MEDIA_FOCUS, when (command.optString("focus")) { "track" -> "vnd.android.cursor.item/audio"; "playlist" -> "vnd.android.cursor.item/playlist"; "artist" -> MediaStore.Audio.Artists.ENTRY_CONTENT_TYPE; else -> "vnd.android.cursor.item/*" })
      if (command.has("title")) intent.putExtra(MediaStore.EXTRA_MEDIA_TITLE, command.getString("title"))
      if (command.has("artist")) intent.putExtra(MediaStore.EXTRA_MEDIA_ARTIST, command.getString("artist"))
      status = "dispatched"
    } else {
      intent = context.packageManager.getLaunchIntentForPackage(packageName) ?: throw MusicFailure("not_installed", "未安装选定的音乐软件。")
      status = "opened"
    }
    if (intent.resolveActivity(context.packageManager) == null) throw MusicFailure("unsupported_entry", "该音乐版本不支持此入口，请用 open_music 不带链接/搜索词打开，再让模型从真实界面操作。")
    return intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) to status
  }
}
