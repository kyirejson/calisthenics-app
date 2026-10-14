package uncover.music

import android.content.ComponentName
import android.content.Intent
import android.provider.Settings
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withContext
import org.json.JSONObject
import android.os.SystemClock
import rikka.shizuku.Shizuku

class UncoverMusicModule : Module() {
  companion object { @Volatile internal var instance: UncoverMusicModule? = null; private set }
  private val permissionsChanged = Shizuku.OnRequestPermissionResultListener { _, _ -> runCatching { sendEvent("statusChanged", emptyMap<String, Any>()) } }
  private val context get() = appContext.reactContext ?: error("App 尚未就绪。")
  private fun safe(block: () -> JSONObject): JSONObject = try { block() } catch (error: Exception) {
    JSONObject().put("ok", false).put("status", if ((error as? MusicFailure)?.details != null) "failed" else "needs_user_action").put("code", (error as? MusicFailure)?.code ?: "platform_error").put("message", error.message ?: "音乐接口执行失败。")
      .put("diagnostics", (error as? MusicFailure)?.details ?: JSONObject.NULL)
  }
  private suspend fun safeRequest(block: suspend () -> JSONObject): JSONObject = try { block() } catch (error: Exception) { safe { throw error } }
  internal fun finishRequest(requestId: String, executionId: String, restoreUi: Boolean = true) {
    val service = MusicAccessibilityService.instance
    try {
      if (restoreUi && !MusicBackground.enabled(context) && MusicLedger.owns(context, requestId) && service?.isMusicForeground() == true) {
        context.packageManager.getLaunchIntentForPackage(context.packageName)?.let { service.startActivity(it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)) }
      }
    } finally { MusicExecutionService.finish(executionId) }
  }
  internal fun clearState() {
    // Notify the running model request before removing consent and receipts.
    MusicExecutionService.cancelActive()
    MusicBackground.close()
    MusicAccessibilityService.instance?.forgetScreens()
    MusicAccessibilityService.instance?.disableSelf()
    MusicLedger.clear(context)
  }
  internal suspend fun executeRequest(requestId: String, raw: String, executionId: String): JSONObject = safeRequest {
      if (MusicLedger.isCancelled(executionId)) throw MusicFailure("cancelled", "音乐请求已取消。")
      val parsed = JSONObject(raw)
      val command = JSONObject().apply { parsed.keys().asSequence().sorted().forEach { put(it, parsed.get(it)) } }
      val provider = command.getString("provider")
      MusicPolicy.packageFor(provider)
      MusicLedger.replay(context, requestId, command)?.let { return@safeRequest it }
      val type = command.getString("type")
      var status = "dispatched"
      val perform: () -> Boolean = when (type) {
        "open" -> {
          val (intent, openedStatus) = MusicController.prepareOpen(context, provider, command)
          status = openedStatus
          if (MusicBackground.enabled(context)) {
            if (MusicAccessibilityService.instance == null) throw MusicFailure("accessibility_required", "后台界面读取仍需你手动开启音乐无障碍控制。")
            MusicBackground.connect(context)
            val openBackground: () -> Boolean = { MusicBackground.open(context, provider, command) }
            openBackground
          } else { { (MusicAccessibilityService.instance ?: context).startActivity(intent); true } }
        }
        "ui" -> {
          status = "acted"
          (MusicAccessibilityService.instance ?: throw MusicFailure("accessibility_required", "无障碍控制尚未开启。")).prepareAction(provider, command)
        }
        "control" -> MusicController.prepareControl(context, provider, command)
        else -> throw MusicFailure("invalid_command", "未知音乐接口操作。")
      }
      MusicLedger.begin(context, requestId, command)
      val result = try {
        if (MusicLedger.isCancelled(executionId)) JSONObject().put("ok", false).put("status", "cancelled")
        else {
          if (type == "open") MusicExecutionService.start(context, executionId)
          if (perform()) JSONObject().put("ok", true).put("status", status).put("provider", provider).put("mode", if (MusicBackground.enabled(context)) "background" else "foreground").put("verifiedPlaying", false).put("message", "操作请求已接受；请回读真实界面及播放状态核实结果。")
          else JSONObject().put("ok", false).put("status", "unsupported").put("code", "action_rejected").put("message", "播放器未接受该控件操作，请读取实际界面后选择其他方法。")
        }
      } catch (error: Exception) { JSONObject().put("ok", false).put("status", "failed").put("code", (error as? MusicFailure)?.code ?: "platform_error").put("message", error.message ?: "系统未接受播放请求。").put("diagnostics", (error as? MusicFailure)?.details ?: JSONObject.NULL) }
      MusicLedger.finish(context, requestId, command, result)
      result

  }
  override fun definition() = ModuleDefinition {
    Name("UncoverMusic")
    Events("cancelled", "statusChanged")
    OnCreate { instance = this@UncoverMusicModule; MusicBackground.initialize(); Shizuku.addRequestPermissionResultListener(permissionsChanged); MusicExecutionService.onCancelled = { id -> MusicBackground.close(); runCatching { sendEvent("cancelled", mapOf("executionId" to id)) } } }
    OnDestroy { if (instance === this@UncoverMusicModule) instance = null; Shizuku.removeRequestPermissionResultListener(permissionsChanged); MusicExecutionService.onCancelled = null; MusicExecutionService.instance?.stopSelf(); MusicBackground.dispose() }
    AsyncFunction("capabilities") { provider: String -> MusicController.capabilities(context, provider).toString() }
    AsyncFunction("playback") { provider: String -> safe { MusicController.playback(context, provider) }.toString() }
    AsyncFunction("screen") Coroutine { provider: String, offset: Int ->
      withContext(Dispatchers.Main) { safeRequest {
        (MusicAccessibilityService.instance ?: throw MusicFailure("accessibility_required", "请在音乐设置中开启无障碍控制；系统授权需你手动完成。")).awaitScreen(provider, offset)
      }.toString() }
    }
    AsyncFunction("execute") Coroutine { requestId: String, raw: String, executionId: String -> withContext(Dispatchers.Main) { executeRequest(requestId, raw, executionId).toString() } }
    AsyncFunction("executeAndObserve") Coroutine { requestId: String, raw: String, executionId: String -> withContext(Dispatchers.Main) { safeRequest {
      val started = SystemClock.elapsedRealtime()
      val provider = JSONObject(raw).getString("provider")
      MusicPolicy.packageFor(provider)
      val revision = MusicAccessibilityService.instance?.revision(provider)
      val playback = MusicPlaybackObservation(context, provider)
      try {
        // Ledger stores only the canonical physical command. Observation is always fresh,
        // including after replay or partial failure, and cannot trigger another action.
        val action = executeRequest(requestId, raw, executionId)
        val observeAfterAction = action.optBoolean("ok") && !action.optBoolean("replayed")
        val cancelled = { MusicLedger.isCancelled(executionId) }
        coroutineScope {
          val screenResult = async { safeRequest {
            if (cancelled()) throw MusicFailure("cancelled", "音乐请求已取消。")
            (MusicAccessibilityService.instance ?: throw MusicFailure("accessibility_required", "音乐无障碍控制尚未连接。")).awaitScreen(provider, 0, if (observeAfterAction) revision ?: 0L else null, cancelled)
          } }
          val playbackResult = async { safeRequest { playback.awaitResult(observeAfterAction, cancelled) } }
          JSONObject().put("ok", action.optBoolean("ok")).put("action", action)
            .put("screen", screenResult.await()).put("playback", playbackResult.await())
            .put("elapsedMs", SystemClock.elapsedRealtime() - started)
        }
      } finally { playback.close() }
    }.toString() } }
    AsyncFunction("receipts") { requestId: String -> MusicLedger.receipts(context, requestId).toString() }
    AsyncFunction("cancel") { executionId: String -> MusicLedger.cancel(executionId); MusicBackground.close() }.runOnQueue(Queues.MAIN)
    AsyncFunction("returnToApp") { requestId: String, executionId: String ->
      finishRequest(requestId, executionId)
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("finishWithoutUi") { requestId: String, executionId: String -> finishRequest(requestId, executionId, false) }.runOnQueue(Queues.MAIN)
    AsyncFunction("consent") { value: Boolean ->
      MusicLedger.setConsent(context, "screen", value)
      if (!value) { MusicExecutionService.cancelActive(); MusicBackground.close(); MusicAccessibilityService.instance?.forgetScreens(); MusicAccessibilityService.instance?.disableSelf() }
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("backgroundConsent") { value: Boolean ->
      if (value && android.os.Build.VERSION.SDK_INT < MusicDisplayPolicy.MIN_API) throw MusicFailure("background_unsupported", "后台点歌需要 Android 14 或以上。")
      MusicExecutionService.cancelActive(); MusicBackground.close(); MusicAccessibilityService.instance?.forgetScreens()
      MusicLedger.setConsent(context, "background", value)
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("playbackConsent") { value: Boolean -> MusicLedger.setConsent(context, "playback", value) }
    AsyncFunction("permission") { kind: String ->
      if (kind == "shizuku") { MusicBackground.requestPermission(context); return@AsyncFunction }
      if (kind == "shizuku_setup") {
        val manager = context.packageManager.getLaunchIntentForPackage("moe.shizuku.privileged.api") ?: throw MusicFailure("shizuku_not_installed", "请从官方渠道安装 Shizuku。")
        (appContext.currentActivity ?: context).startActivity(manager.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); return@AsyncFunction
      }
      val intent = when (kind) {
        "accessibility" -> Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
        "notifications" -> Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS).putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME, ComponentName(context, MusicNotificationListener::class.java).flattenToString())
        "task_notifications" -> Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
        else -> throw MusicFailure("invalid_permission", "未知音乐授权类型。")
      }
      val fallback = when (kind) {
        "accessibility" -> Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
        "notifications" -> Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
        else -> Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, android.net.Uri.parse("package:${context.packageName}"))
      }
      (appContext.currentActivity ?: context).startActivity((if (intent.resolveActivity(context.packageManager) != null) intent else fallback).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("clear") {
      clearState()
    }.runOnQueue(Queues.MAIN)
  }
}
