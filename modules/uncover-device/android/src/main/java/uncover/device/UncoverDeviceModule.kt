package uncover.device

import android.content.Intent
import android.provider.Settings
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject

class UncoverDeviceModule : Module() {
  companion object {
    @Volatile private var instance: UncoverDeviceModule? = null
    fun changed() { instance?.let { runCatching { it.sendEvent("statusChanged", emptyMap<String, Any>()) } } }
  }
  private val context get() = appContext.reactContext ?: error("App 尚未就绪。")
  override fun definition() = ModuleDefinition {
    Name("UncoverDevice"); Events("cancelled", "statusChanged")
    OnCreate { instance = this@UncoverDeviceModule; PhoneExecutionService.onCancelled = { id -> runCatching { sendEvent("cancelled", mapOf("executionId" to id)) } } }
    OnDestroy { if (instance === this@UncoverDeviceModule) { instance = null; PhoneExecutionService.cancelActive(); PhoneExecutionService.onCancelled = null } }
    AsyncFunction("status") { PhoneController.safe { PhoneController.status(context) }.toString() }
    AsyncFunction("findApps") { query: String, offset: Int -> PhoneController.safe { PhoneApps.find(context, query, offset) }.toString() }
    AsyncFunction("screen") Coroutine { request: String, execution: String, offset: Int, expected: String?, visualText: Boolean -> withContext(Dispatchers.Main) {
      PhoneController.safeRequest { PhoneController.screen(context, request, execution, offset, expected, visualText) }.toString()
    } }
    AsyncFunction("executeAndObserve") Coroutine { request: String, execution: String, raw: String -> withContext(Dispatchers.Main) {
      PhoneController.safeRequest { PhoneController.executeAndObserve(context, request, execution, JSONObject(raw)) }.toString()
    } }
    AsyncFunction("receipts") { request: String -> PhoneLedger.receipts(context, request).toString() }
    AsyncFunction("cancel") { execution: String -> PhoneLedger.cancel(execution); PhoneAccessibilityService.instance?.phoneUi?.clear() }.runOnQueue(Queues.MAIN)
    AsyncFunction("finish") { execution: String -> PhoneExecutionService.finish(execution) }.runOnQueue(Queues.MAIN)
    // Permission changes are UI-only APIs, not model tools. Existing music consent never opts in.
    AsyncFunction("consent") { enabled: Boolean ->
      check(appContext.currentActivity != null) { "请从 MAX 服务设置中主动更改手机控制授权。" }
      if (!enabled) PhoneExecutionService.cancelActive()
      PhoneLedger.consent(context, enabled); PhoneAccessibilityService.instance?.refreshAccess(); changed()
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("permission") {
      val activity = appContext.currentActivity ?: error("请从 App 设置中手动打开系统授权页面。")
      activity.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("clear") {
      check(appContext.currentActivity != null) { "请从 App 设置中清理手机控制记录。" }
      PhoneExecutionService.cancelActive(); PhoneLedger.clear(context); PhoneAccessibilityService.instance?.refreshAccess(); changed()
    }.runOnQueue(Queues.MAIN)
  }
}
