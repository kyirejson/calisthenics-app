package uncover.voice

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import android.app.KeyguardManager
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class UncoverVoiceModule : Module() {
  companion object { @Volatile internal var instance: UncoverVoiceModule? = null; private set }
  private val context get() = appContext.reactContext ?: error("App 尚未就绪。")
  internal fun status() { runCatching { sendEvent("status", emptyMap<String, Any>()) } }
  internal fun dialogue(data: Map<String, Any>) { runCatching { sendEvent("dialogue", data) } }
  override fun definition() = ModuleDefinition {
    Name("UncoverVoice"); Events("status", "dialogue")
    OnCreate { instance = this@UncoverVoiceModule }
    OnDestroy { if (instance === this@UncoverVoiceModule) instance = null }
    AsyncFunction("state") { VoiceState.snapshot(context).toString() }
    AsyncFunction("enable") { enabled: Boolean ->
      if (enabled && Build.VERSION.SDK_INT < 29) error("BLACK 语音唤醒需要 Android 10 或以上。")
      if (enabled && context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) error("请先授权麦克风。")
      if (enabled && appContext.currentActivity == null) error("请从 App 中主动开启语音监听。")
      if (enabled && BlackVoiceService.instance?.enrolling == true) error("声音正在登记，请完成或取消登记后再开启监听。")
      if (enabled && VoiceOwnerStore(context).read() == null) error("请先登记主人声音；未登记时不会允许任何人通过语音操作 Agent。")
      VoiceState.setEnabled(context, enabled)
      if (enabled) try { BlackVoiceService.start(context) } catch (error: Exception) { VoiceState.setEnabled(context, false); throw error }
      else BlackVoiceService.stop(context)
      status()
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("enrollOwner") {
      check(Build.VERSION.SDK_INT >= 29) { "BLACK 主人声音登记需要 Android 10 或以上。" }
      check(appContext.currentActivity != null && !(context.getSystemService(android.content.Context.KEYGUARD_SERVICE) as KeyguardManager).isDeviceLocked) { "请在手机解锁后，从 App 中登记声音。" }
      check(context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) { "请先授权麦克风。" }
      check(!VoiceState.enabled(context) && BlackVoiceService.instance == null) { "请先关闭语音监听，稍后再登记声音。" }
      VoiceState.enrollmentProgress = 0; VoiceState.enrollmentStage = "voice_1"; VoiceState.clearError(context)
      val store = VoiceOwnerStore(context); val ticket = store.beginEnrollment()
      try { context.startForegroundService(Intent(context, BlackVoiceService::class.java).setAction("enroll").putExtra("enrollmentTicket", ticket)) }
      catch (error: Exception) { store.cancelEnrollment(); throw error }; status()
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("cancelEnrollment") { VoiceOwnerStore(context).cancelEnrollment(); if (BlackVoiceService.instance?.enrolling == true) BlackVoiceService.stop(context); status() }.runOnQueue(Queues.MAIN)
    AsyncFunction("forgetOwner") {
      check(appContext.currentActivity != null && !(context.getSystemService(android.content.Context.KEYGUARD_SERVICE) as KeyguardManager).isDeviceLocked) { "请解锁后从 App 中删除主人声音。" }
      VoiceState.setEnabled(context, false); BlackVoiceService.stop(context); VoiceOwnerStore(context).clear(); VoiceState.enrollmentProgress = 0; status()
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("assistant") {
      if (Build.VERSION.SDK_INT < 29) error("BLACK 默认语音助手需要 Android 10 或以上。")
      val activity = appContext.currentActivity ?: error("请从 App 中设置默认语音助手。")
      // AOSP marks ASSISTANT requestable=false. The user must choose it in system Settings.
      try { activity.startActivity(Intent(Settings.ACTION_VOICE_INPUT_SETTINGS)) }
      catch (_: ActivityNotFoundException) {
        try { activity.startActivity(Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS)) }
        catch (_: ActivityNotFoundException) { error("请在系统设置的默认应用中，手动将数字助手选择为 Uncover。") }
      }
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("active") { id: String -> BlackVoiceService.instance?.active(id) == true }
    AsyncFunction("decisionActive") { id: String -> BlackVoiceService.instance?.decisionActive(id) == true }
    AsyncFunction("decide") { id: String, action: String, error: String? -> BlackVoiceService.instance?.decide(id, action, error) }.runOnQueue(Queues.MAIN)
    AsyncFunction("dialogue") { BlackVoiceService.instance?.dialogue() ?: "{\"kind\":\"status\",\"sequence\":0,\"phase\":\"stopped\"}" }
    AsyncFunction("cancel") { id: String? -> BlackVoiceService.instance?.cancel(id) }.runOnQueue(Queues.MAIN)
    AsyncFunction("reply") { id: String, text: String -> BlackVoiceService.instance?.reply(id, text) }.runOnQueue(Queues.MAIN)
    AsyncFunction("clear") { VoiceState.setEnabled(context, false); BlackVoiceService.stop(context); VoiceOwnerStore(context).clear(); VoiceState.clearError(context); status() }.runOnQueue(Queues.MAIN)
  }
}
