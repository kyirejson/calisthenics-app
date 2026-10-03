package expo.modules.uncovercopilot

import android.content.Intent
import android.content.pm.ShortcutInfo
import android.content.pm.ShortcutManager
import android.net.Uri
import android.os.Build
import android.Manifest
import android.content.pm.PackageManager
import android.provider.Settings
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.functions.Queues

class UncoverCopilotModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("UncoverCopilot")
    // Android receives system commands via the app's already registered URL scheme.
    AsyncFunction("consumeSystemCommand") { null as String? }
    AsyncFunction("wakeStatus") {
      val context = appContext.reactContext ?: throw IllegalStateException("App context unavailable")
      val assets = try {
        context.assets.open("uncover-wake.ppn").use { }
        context.assets.open("porcupine_params_zh.pv").use { }
        true
      } catch (_: Exception) { false }
      mapOf("available" to assets, "running" to CopilotWakeService.running, "overlay" to Settings.canDrawOverlays(context), "error" to CopilotWakeService.lastError)
    }
    AsyncFunction("requestOverlayPermission") {
      val activity = appContext.currentActivity ?: throw IllegalStateException("Open the App first")
      activity.startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + activity.packageName)))
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("startWake") { accessKey: String ->
      val activity = appContext.currentActivity ?: throw IllegalStateException("Open the App first")
      if (!activity.hasWindowFocus()) throw IllegalStateException("请从 App 前台开启唤醒监听")
      if (ContextCompat.checkSelfPermission(activity, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) throw IllegalStateException("尚未授权麦克风")
      if (!Settings.canDrawOverlays(activity)) throw IllegalStateException("请先授予悬浮窗权限，保证后台检测后有可见入口")
      require(accessKey.isNotBlank() && accessKey.length <= 512) { "Picovoice AccessKey 无效" }
      activity.assets.open("uncover-wake.ppn").use { }
      activity.assets.open("porcupine_params_zh.pv").use { }
      CopilotWakeService.lastError = ""
      ContextCompat.startForegroundService(activity, Intent(activity, CopilotWakeService::class.java).putExtra("accessKey", accessKey))
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("stopWake") {
      val context = appContext.reactContext ?: throw IllegalStateException("App context unavailable")
      CopilotWakeService.stopListening()
      context.stopService(Intent(context, CopilotWakeService::class.java))
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("requestAssistantShortcut") {
      val context = appContext.reactContext ?: throw IllegalStateException("App context unavailable")
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return@AsyncFunction false
      val manager = context.getSystemService(ShortcutManager::class.java)
      if (!manager.isRequestPinShortcutSupported) return@AsyncFunction false
      val launcher = context.packageManager.getLaunchIntentForPackage(context.packageName)
        ?: return@AsyncFunction false
      launcher.action = Intent.ACTION_VIEW
      launcher.data = Uri.parse("uncover://assistant")
      val shortcut = ShortcutInfo.Builder(context, "personal-agent")
        .setShortLabel("个人助手")
        .setLongLabel("打开 Uncover 个人助手")
        .setIntent(launcher)
        .build()
      // The OS may still ask the user. A request being accepted is not proof of installation.
      manager.requestPinShortcut(shortcut, null)
    }
  }
}
