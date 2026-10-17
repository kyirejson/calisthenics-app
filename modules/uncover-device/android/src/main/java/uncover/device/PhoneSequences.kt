package uncover.device

import android.content.Context
import android.os.SystemClock
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import org.json.JSONArray
import org.json.JSONObject

/** Model-authored sequences. Selectors always bind to the frame that actually supplied them. */
object PhoneSequences {
  private val fields = setOf("resourceId", "text", "description", "label", "className", "editable", "clickable")
  private val actions = setOf("click", "tap", "long_click", "set_text", "submit", "scroll_forward", "scroll_backward")
  private val visualActions = setOf("click", "tap", "long_click")
  private data class Match(val frame: JSONObject, val node: JSONObject? = null, val visual: JSONObject? = null)
  private fun matches(node: JSONObject, selector: JSONObject): Boolean = selector.keys().asSequence().all { key ->
    key in fields && node.opt(key) == selector.opt(key)
  }
  private fun timeout(step: JSONObject): Long {
    if (!step.has("timeoutMs")) return 8000L
    val value = step.getDouble("timeoutMs")
    if (!value.isFinite() || value < 1 || value != value.toLong().toDouble()) throw PhoneFailure("invalid_workflow", "页面等待时间应为正整数毫秒。")
    return value.toLong()
  }
  private suspend fun observe(context: Context, request: String, execution: String, step: JSONObject, initial: JSONObject?): Match {
    val started = SystemClock.elapsedRealtime(); val budget = timeout(step)
    val packageName = step.getString("packageName"); val source = step.optString("source", "auto")
    var reusable = initial?.takeIf { it.optBoolean("ok") && it.optString("packageName") == packageName &&
      it.has("revision") && it.optLong("revision") == PhoneAccessibilityService.instance?.phoneUi?.revision(packageName) }
    while (true) {
      if (PhoneLedger.isCancelled(execution)) throw PhoneFailure("cancelled", "本次流程已取消。")
      if (SystemClock.elapsedRealtime() - started >= budget)
        throw PhoneFailure("workflow_page_changed", "等待目标页面超时，流程已停止，请由模型根据实际画面接管。")
      try {
        val first = reusable ?: PhoneController.screen(context, request, execution, 0, packageName, source == "ocr")
        reusable = null
        val pages = mutableListOf(first); var next = first.opt("nextOffset")
        while (next is Number) {
          val page = PhoneController.screen(context, request, execution, next.toInt(), packageName)
          pages.add(page); next = page.opt("nextOffset")
        }
        if (pages.any { it.optLong("revision") != first.optLong("revision") || it.optInt("windowId") != first.optInt("windowId") }) continue
        val nodes = pages.flatMap { page -> val rows = page.getJSONArray("nodes"); (0 until rows.length()).map { Match(page, node = rows.getJSONObject(it)) } }
        val selector = step.optJSONObject("selector")
        val supportsVisual = step.getString("type") == "observe" || step.optString("action") in visualActions
        var found = if (selector == null || source == "ocr") emptyList() else nodes.filter { matches(it.node!!, selector) }
        val required = step.optJSONArray("expectedText") ?: JSONArray()
        fun knownText(value: String): Boolean = nodes.any { row -> listOf("text", "label", "description").any { row.node!!.optString(it) == value } }
        val needVisual = source == "ocr" || source == "auto" && (first.optBoolean("emptyTree") ||
          selector != null && found.isEmpty() && supportsVisual ||
          (0 until required.length()).any { !knownText(required.getString(it)) })
        var visualFrame = first
        var lines = emptyList<Match>()
        if (needVisual) {
          if (first.optJSONObject("visualText") == null)
            visualFrame = PhoneController.screen(context, request, execution, 0, packageName, true)
          if (visualFrame.optLong("revision") != first.optLong("revision")) { reusable = visualFrame; continue }
          val result = visualFrame.optJSONObject("visualText")
          if (result?.optBoolean("ok") == true) {
            val data = result.optJSONArray("lines") ?: JSONArray()
            lines = (0 until data.length()).map { Match(visualFrame, visual = data.getJSONObject(it)) }
          } else if (source == "ocr" || first.optBoolean("emptyTree")) {
            throw PhoneFailure(result?.optString("code")?.takeIf { it.isNotBlank() } ?: "workflow_ocr_unavailable",
              result?.optString("message")?.takeIf { it.isNotBlank() } ?: "控件不可用且本机识字未返回画面，请由模型查看实际失败原因。")
          }
          if (selector != null && found.isEmpty() && supportsVisual && selector.length() == 1 && selector.has("text"))
            found = lines.filter { it.visual!!.optString("text") == selector.getString("text") }
        }
        val expected = (0 until required.length()).all { index -> knownText(required.getString(index)) || lines.any { it.visual!!.optString("text") == required.getString(index) } }
        if (found.size > 1) throw PhoneFailure("workflow_ambiguous_target", "流程定位到多个同名目标，已停止；需要模型根据当前页面选择。")
        if (expected && (selector == null || found.size == 1)) return found.singleOrNull() ?: Match(visualFrame)
      } catch (error: PhoneFailure) {
        if (error.code !in setOf("screen_unavailable", "wrong_app", "stale_visual_text") || SystemClock.elapsedRealtime() - started >= budget) throw error
      }
      if (SystemClock.elapsedRealtime() - started >= budget)
        throw PhoneFailure("workflow_page_changed", "等待目标页面超时，当前画面不符合保存的流程；保留已执行步骤，由模型重新观察接管。")
      delay(120)
    }
  }
  suspend fun run(context: Context, request: String, execution: String, command: JSONObject): JSONObject {
    PhoneAccess.requireUi(context)
    if (PhoneLedger.isCancelled(execution)) throw PhoneFailure("cancelled", "本次流程已取消。")
    PhoneLedger.replay(context, request, command)?.let { prior ->
      return prior.put("screen", PhoneController.safeRequest { PhoneController.screen(context, request, execution, 0) })
    }
    val steps = command.getJSONArray("steps")
    if (steps.length() == 0) throw PhoneFailure("invalid_workflow", "流程至少需要一步操作。")
    for (index in 0 until steps.length()) {
      val step = steps.getJSONObject(index); val type = step.getString("type")
      if (type !in setOf("open", "ui", "observe")) throw PhoneFailure("invalid_workflow", "流程接受公开应用入口、界面操作和页面观察，不执行脚本。")
      PhonePolicy.packageName(step.getString("packageName")); timeout(step)
      if (step.optString("source", "auto") !in setOf("auto", "accessibility", "ocr")) throw PhoneFailure("invalid_workflow", "未知页面定位来源。")
      val required = step.optJSONArray("expectedText")
      if (required != null && (0 until required.length()).any { required.opt(it) !is String }) throw PhoneFailure("invalid_workflow", "页面条件应为实际观察到的文字。")
      if (type == "ui") {
        val selector = step.getJSONObject("selector"); val action = step.getString("action")
        if (selector.length() == 0 || selector.keys().asSequence().any { it !in fields } || action !in actions)
          throw PhoneFailure("invalid_workflow", "流程目标条件或操作类型无效。")
        if (step.optString("source") == "ocr" && (action !in visualActions || selector.length() != 1 || !selector.has("text")))
          throw PhoneFailure("invalid_workflow", "OCR 定位使用真实整行文字，支持点击和长按；填写文字仍需实际可编辑控件。")
        if (action == "set_text") step.getString("text")
      }
    }
    val started = SystemClock.elapsedRealtime(); val trace = JSONArray()
    PhoneLedger.begin(context, request, execution, command)
    var finalFrame: JSONObject? = null; var failedStep = -1
    val result = try {
      for (index in 0 until steps.length()) {
        failedStep = index
        val step = steps.getJSONObject(index); val type = step.getString("type"); val stepStarted = SystemClock.elapsedRealtime()
        command.optJSONObject("appVersions")?.let { versions ->
          val expected = versions.optJSONObject(step.getString("packageName")); val actual = PhoneApps.version(context, step.getString("packageName"))
          if (expected == null || !expected.optBoolean("available") || !actual.optBoolean("available"))
            throw PhoneFailure("workflow_version_unknown", "无法核实当前应用与缓存版本，流程已停止，由模型重新观察。")
          if (expected.optString("versionCode") != actual.optString("versionCode") || expected.optLong("lastUpdateTime") != actual.optLong("lastUpdateTime"))
            throw PhoneFailure("workflow_app_changed", "应用在流程执行前或执行期间已更新，未继续使用旧步骤。")
        }
        val observed = if (type == "open") null else observe(context, request, execution, step, finalFrame)
        if (type == "observe") {
          finalFrame = observed!!.frame
          trace.put(JSONObject().put("step", index).put("observed", true).put("waitMs", SystemClock.elapsedRealtime() - stepStarted))
          continue
        }
        val physical = JSONObject().put("type", type).put("operationKey", command.getString("operationKey") + ":step:" + index)
        if (type == "open") {
          physical.put("packageName", step.getString("packageName"))
          physical.put("observationTimeoutMs", timeout(step))
          for (field in listOf("uri", "activityName")) if (step.has(field)) physical.put(field, step.get(field))
        } else {
          physical.put("snapshotId", observed!!.frame.getString("snapshotId"))
          if (observed.visual != null) {
            val rect = observed.visual.getJSONArray("bounds")
            val x = (rect.getDouble(0) + rect.getDouble(2)) / 2; val y = (rect.getDouble(1) + rect.getDouble(3)) / 2
            physical.put("type", "gesture").put("durationMs", if (step.getString("action") == "long_click") 650 else 60)
              .put("paths", JSONArray().put(JSONArray().put(JSONObject().put("x", x).put("y", y))))
          } else physical.put("nodeId", observed.node!!.getString("nodeId")).put("action", step.getString("action"))
          if (step.has("text")) physical.put("text", step.getString("text"))
        }
        val readyAt = SystemClock.elapsedRealtime()
        val action = PhoneController.executeAndObserve(context, request, execution, physical)
        trace.put(JSONObject().put("step", index).put("action", action.optJSONObject("action"))
          .put("source", if (observed?.visual != null) "local_ocr" else "accessibility")
          .put("waitMs", readyAt - stepStarted).put("timings", action.optJSONObject("timings")))
        finalFrame = action.optJSONObject("screen")
        if (!action.optBoolean("ok") || finalFrame?.optBoolean("ok") != true) {
          val cause = if (!action.optBoolean("ok")) action.optJSONObject("action") else finalFrame
          throw PhoneFailure(cause?.optString("code")?.takeIf { it.isNotBlank() } ?: "workflow_step_failed",
            "流程第 ${index + 1} 步：${cause?.optString("message")?.takeIf { it.isNotBlank() } ?: "未取得有效结果"}；已执行回执保留，不重复整段执行。")
        }
      }
      failedStep = -1
      JSONObject().put("ok", true).put("status", "sequence_executed").put("verifiedTaskCompleted", false)
    } catch (error: CancellationException) { throw error }
      catch (error: Exception) { PhoneController.failure(error) }
    if (failedStep >= 0) result.put("failedStep", failedStep)
    val actualFrame = if (!result.optBoolean("ok") || finalFrame == null) PhoneController.safeRequest { PhoneController.screen(context, request, execution, 0) } else finalFrame!!
    result.put("trace", trace).put("screen", actualFrame).put("elapsedMs", SystemClock.elapsedRealtime() - started)
      .put("message", if (result.optBoolean("ok")) "流程步骤已执行，须根据最终真实界面核对用户目标是否完成。" else result.optString("message"))
    PhoneLedger.finish(context, request, command, result); PhoneLedger.observed(context, request, command, actualFrame)
    return result
  }
}
