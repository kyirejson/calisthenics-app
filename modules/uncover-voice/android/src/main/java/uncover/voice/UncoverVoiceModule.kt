package uncover.voice

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class UncoverVoiceModule : Module() {
  companion object { @Volatile internal var instance: UncoverVoiceModule? = null; private set }
  private val context get() = appContext.reactContext ?: error("App 尚未就绪。")
  internal fun status() { runCatching { sendEvent("status", emptyMap<String, Any>()) } }
  internal fun dialogue(data: Map<String, Any>) { runCatching { sendEvent("dialogue", data) } }
  private fun restoreListening() {
    if (appContext.currentActivity == null || !VoiceState.enabled(context) || BlackVoiceService.instance != null) return
    if (context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
      VoiceState.error(context, "microphone_permission_revoked", "语音开关已保存，但系统麦克风权限已撤销；请恢复麦克风授权。")
      return
    }
    try { BlackVoiceService.start(context) }
    catch (error: Exception) { VoiceState.error(context, "voice_restore_failed", error.message ?: "系统暂未允许恢复语音监听。") }
  }
  override fun definition() = ModuleDefinition {
    Name("UncoverVoice"); Events("status", "dialogue")
    OnCreate { instance = this@UncoverVoiceModule; Handler(Looper.getMainLooper()).post { restoreListening() } }
    OnActivityEntersForeground { restoreListening() }
    OnDestroy { if (instance === this@UncoverVoiceModule) instance = null }
    AsyncFunction("state") { VoiceState.snapshot(context).toString() }
    AsyncFunction("enable") { enabled: Boolean ->
      if (enabled && Build.VERSION.SDK_INT < 29) error("${VoiceBrand.NAME} 语音唤醒需要 Android 10 或以上。")
      if (enabled && context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) error("请先授权麦克风。")
      if (enabled && appContext.currentActivity == null) error("请从 App 中主动开启语音监听。")
      VoiceState.setEnabled(context, enabled)
      if (enabled) try { BlackVoiceService.start(context) } catch (error: Exception) { VoiceState.error(context, "voice_start_failed", error.message ?: "语音服务未启动。"); throw error }
      else BlackVoiceService.stop(context)
      status()
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("forgetLegacyVoiceData") {
      check(appContext.currentActivity != null) { "请从 App 中清理旧版资料。" }
      VoiceLegacyData.clear(context); status()
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("assistant") {
      if (Build.VERSION.SDK_INT < 29) error("${VoiceBrand.NAME} 默认语音助手需要 Android 10 或以上。")
      val activity = appContext.currentActivity ?: error("请从 App 中设置默认语音助手。")
      try { activity.startActivity(Intent(Settings.ACTION_VOICE_INPUT_SETTINGS)) }
      catch (_: ActivityNotFoundException) {
        try { activity.startActivity(Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS)) }
        catch (_: ActivityNotFoundException) { error("请在系统默认应用中选择 Uncover 为数字助手。") }
      }
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("active") { id: String -> BlackVoiceService.instance?.active(id) == true }
    AsyncFunction("decisionActive") { id: String -> BlackVoiceService.instance?.decisionActive(id) == true }
    AsyncFunction("decide") { id: String, action: String, error: String? -> BlackVoiceService.instance?.decide(id, action, error) }.runOnQueue(Queues.MAIN)
    AsyncFunction("dialogue") { BlackVoiceService.instance?.dialogue() ?: "{\"kind\":\"status\",\"sequence\":0,\"phase\":\"stopped\"}" }
    AsyncFunction("cancel") { id: String? -> BlackVoiceService.instance?.cancel(id) }.runOnQueue(Queues.MAIN)
    AsyncFunction("standby") { id: String -> BlackVoiceService.instance?.standby(id) == true }.runOnQueue(Queues.MAIN)
    AsyncFunction("reply") { id: String, text: String -> BlackVoiceService.instance?.reply(id, text) }.runOnQueue(Queues.MAIN)
    AsyncFunction("replyThenStandby") { id: String, text: String -> BlackVoiceService.instance?.reply(id, text, true) }.runOnQueue(Queues.MAIN)
    AsyncFunction("clear") { VoiceState.setEnabled(context, false); BlackVoiceService.stop(context); VoiceLegacyData.clear(context); VoiceState.clearError(context); status() }.runOnQueue(Queues.MAIN)
  }
}
