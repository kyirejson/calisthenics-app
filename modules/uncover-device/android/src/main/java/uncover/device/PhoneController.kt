package uncover.device

import android.app.KeyguardManager
import android.content.Context
import android.os.Build
import android.os.SystemClock
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONArray
import org.json.JSONObject

object PhoneController {
  private val mutations = Mutex()
  fun failure(error: Throwable): JSONObject = JSONObject().put("ok", false).put("status", "needs_user_action")
    .put("code", (error as? PhoneFailure)?.code ?: "platform_error").put("message", error.message ?: "手机控制接口不可用。")
  fun safe(block: () -> JSONObject): JSONObject = try { block() } catch (error: Exception) { failure(error) }
  suspend fun safeRequest(block: suspend () -> JSONObject): JSONObject = try { block() } catch (error: CancellationException) { throw error } catch (error: Exception) { failure(error) }
  fun status(context: Context): JSONObject {
    val service = PhoneAccessibilityService.instance
    val actions = JSONArray()
    if (Build.VERSION.SDK_INT >= 30) service?.systemActions?.forEach { actions.put(JSONObject().put("id", it.id).put("label", it.label?.toString() ?: JSONObject.NULL)) }
    else for ((id, label) in listOf(1 to "返回", 2 to "主页", 3 to "最近应用", 4 to "通知", 5 to "快捷设置")) actions.put(JSONObject().put("id", id).put("label", label))
    return JSONObject().put("ok", true).put("native", true).put("enabled", PhoneLedger.enabled(context)).put("accessibilityGranted", PhoneAccess.granted(context))
      .put("connected", service != null).put("locked", (context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager).isKeyguardLocked)
      .put("mode", "foreground").put("androidApi", Build.VERSION.SDK_INT).put("appScope", "all_launchable_apps")
      .put("systemActions", actions).put("message", "通用控制操作真实主屏幕；不继承音乐的后台专用屏幕模式。系统授权和身份验证由本人处理。")
  }
  private fun check(context: Context, execution: String) {
    require(execution.isNotBlank())
    PhoneAccess.requireConsent(context); PhoneAccess.requireUnlocked(context)
    if (PhoneLedger.isCancelled(execution)) throw PhoneFailure("cancelled", "本次手机操作已取消。")
  }
  private fun target(context: Context, service: PhoneAccessibilityService, request: String, execution: String, expected: String? = null) =
    PhoneUiTarget(scope = "phone:$request:$execution", packageName = expected, validate = {
      check(context, execution)
      if (PhoneAccessibilityService.instance !== service) throw PhoneFailure("service_changed", "手机控制服务已重连，请重新观察。")
    })
  suspend fun screen(context: Context, request: String, execution: String, offset: Int, expected: String? = null, visualText: Boolean = false): JSONObject {
    check(context, execution)
    require(request.isNotBlank()); val service = PhoneAccess.requireUi(context)
    val selected = target(context, service, request, execution, expected)
    val frame = service.phoneUi.awaitScreen(selected, offset, cancelled = { PhoneLedger.isCancelled(execution) })
      .put("systemActions", status(context).getJSONArray("systemActions"))
    if (visualText) frame.put("visualText", safeRequest { service.phoneUi.visualText(selected, frame.getString("snapshotId")) })
    return frame
  }
  private suspend fun execute(context: Context, request: String, execution: String, command: JSONObject): JSONObject = mutations.withLock {
    check(context, execution)
    require(request.isNotBlank() && command.getString("operationKey").isNotBlank())
    PhoneLedger.replay(context, request, command)?.let { return@withLock it }
    val service = PhoneAccess.requireUi(context); val ui = service.phoneUi
    val type = command.getString("type")
    val selected = target(context, service, request, execution)
    val perform: suspend () -> Boolean = when (type) {
      "open" -> {
        val intent = PhoneApps.prepare(context, command)
        val launch: suspend () -> Boolean = { service.startActivity(intent); true }
        launch
      }
      "ui" -> { val prepared = ui.prepareAction(selected, command); { prepared() } }
      "global" -> { val prepared = ui.prepareGlobal(selected, command); { prepared() } }
      "gesture" -> ui.prepareGesture(selected, command)
      else -> throw PhoneFailure("invalid_command", "未知手机操作类型。")
    }
    // Start while the initiating activity/service is still eligible; not a claim that FGS bypasses BAL.
    PhoneExecutionService.start(context, execution)
    PhoneLedger.begin(context, request, execution, command)
    val result = try {
      check(context, execution)
      if (perform()) JSONObject().put("ok", true).put("status", if (type == "open") "launch_dispatched" else "action_accepted")
        .put("mayHaveExecuted", true).put("verifiedTaskCompleted", false).put("message", "系统已接受操作；须根据随后真实界面核对结果，不等于消息已发送或导航已完成。")
      else JSONObject().put("ok", false).put("status", "not_accepted").put("code", "action_not_accepted").put("mayHaveExecuted", type == "gesture")
        .put("message", "系统未报告完整执行，请先核对实际界面，不盲目重复。")
    } catch (error: CancellationException) { throw error }
      catch (error: Exception) { failure(error).put("status", "uncertain").put("mayHaveExecuted", true) }
    PhoneLedger.finish(context, request, command, result)
    result
  }
  suspend fun executeAndObserve(context: Context, request: String, execution: String, command: JSONObject): JSONObject {
    check(context, execution)
    val started = SystemClock.elapsedRealtime()
    val prior = PhoneAccessibilityService.instance?.phoneUi?.foregroundRoot()?.packageName?.toString()
    val before = prior?.let { PhoneAccessibilityService.instance?.phoneUi?.revision(it) }
    val action = safeRequest { execute(context, request, execution, command) }
    val screen = safeRequest {
      val service = PhoneAccess.requireUi(context)
      val expected = if (command.optString("type") == "open" && action.optBoolean("ok") && !action.optBoolean("replayed")) command.optString("packageName").takeIf { it.isNotBlank() } else null
      service.phoneUi.awaitScreen(target(context, service, request, execution, expected), before = if (action.optBoolean("ok") && !action.optBoolean("replayed")) before ?: 0L else null,
        cancelled = { PhoneLedger.isCancelled(execution) }).put("systemActions", status(context).getJSONArray("systemActions"))
    }
    return JSONObject().put("ok", action.optBoolean("ok")).put("action", action).put("screen", screen).put("elapsedMs", SystemClock.elapsedRealtime() - started)
      .put("observedRequestedApp", command.optString("type") == "open" && screen.optBoolean("ok") && screen.optString("packageName") == command.optString("packageName"))
  }
}
