package uncover.voice

import android.Manifest
import android.app.role.RoleManager
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class UncoverVoiceModule : Module() {
  companion object { @Volatile internal var instance: UncoverVoiceModule? = null; private set }
  private val context get() = appContext.reactContext ?: error("App 尚未就绪。")
  internal fun status() { runCatching { sendEvent("status", emptyMap<String, Any>()) } }
  override fun definition() = ModuleDefinition {
    Name("UncoverVoice"); Events("status")
    OnCreate { instance = this@UncoverVoiceModule }
    OnDestroy { if (instance === this@UncoverVoiceModule) instance = null }
    AsyncFunction("state") { VoiceState.snapshot(context).toString() }
    AsyncFunction("enable") { enabled: Boolean ->
      if (enabled && Build.VERSION.SDK_INT < 29) error("BLACK 语音唤醒需要 Android 10 或以上。")
      if (enabled && context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) error("请先授权麦克风。")
      if (enabled && appContext.currentActivity == null) error("请从 App 中主动开启语音监听。")
      VoiceState.setEnabled(context, enabled)
      if (enabled) try { BlackVoiceService.start(context) } catch (error: Exception) { VoiceState.setEnabled(context, false); throw error }
      else BlackVoiceService.stop(context)
      status()
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("assistant") {
      if (Build.VERSION.SDK_INT < 29) error("BLACK 默认语音助手需要 Android 10 或以上。")
      val roles = context.getSystemService(RoleManager::class.java)
      val intent = if (roles.isRoleAvailable(RoleManager.ROLE_ASSISTANT) && !roles.isRoleHeld(RoleManager.ROLE_ASSISTANT)) roles.createRequestRoleIntent(RoleManager.ROLE_ASSISTANT)
        else Intent(Settings.ACTION_VOICE_INPUT_SETTINGS)
      (appContext.currentActivity ?: error("请从 App 中设置默认语音助手。")).startActivity(intent)
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("active") { id: String -> BlackVoiceService.instance?.active(id) == true }
    AsyncFunction("reply") { id: String, text: String -> BlackVoiceService.instance?.reply(id, text) }.runOnQueue(Queues.MAIN)
    AsyncFunction("clear") { VoiceState.setEnabled(context, false); BlackVoiceService.stop(context); VoiceState.clearError(context); status() }.runOnQueue(Queues.MAIN)
  }
}
