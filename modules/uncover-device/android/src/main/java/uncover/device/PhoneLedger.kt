package uncover.device

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest

/** Persist before dispatch. Ambiguous/cancelled responses never erase the attempt or replay a send. */
object PhoneLedger {
  private const val FILE = "uncover_phone_control_v1"
  private val cancelled = mutableSetOf<String>()
  private fun prefs(context: Context) = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)
  fun enabled(context: Context) = prefs(context).getBoolean("consent", false)
  fun accepted(context: Context) = prefs(context).getBoolean("consentAccepted", enabled(context))
  fun consent(context: Context, value: Boolean) {
    if (!prefs(context).edit().putBoolean("consent", value).apply { if (value) putBoolean("consentAccepted", true) }.commit()) throw PhoneFailure("storage_failed", "手机控制授权保存失败。")
  }
  @Synchronized fun cancel(id: String) { cancelled.add(id) }
  @Synchronized fun isCancelled(id: String) = id in cancelled
  private fun rows(context: Context): JSONObject = try { JSONObject(prefs(context).getString("receipts", "{}")!!) }
    catch (_: Exception) { throw PhoneFailure("journal_corrupt", "手机操作回执无法读取；为避免重复发送，未执行操作，请在设置中关闭并清理操作回执。") }
  private fun save(context: Context, rows: JSONObject) {
    if (!prefs(context).edit().putString("receipts", rows.toString()).commit()) throw PhoneFailure("storage_failed", "操作回执保存失败，请先核对实际界面，不要重复发送或点击。")
  }
  private fun canonical(value: Any?): String = when (value) {
    is JSONObject -> value.keys().asSequence().sorted().joinToString(",", "{", "}") { JSONObject.quote(it) + ":" + canonical(value.get(it)) }
    is JSONArray -> (0 until value.length()).joinToString(",", "[", "]") { canonical(value.get(it)) }
    else -> JSONArray().put(value).toString().let { it.substring(1, it.length - 1) }
  }
  private fun digest(command: JSONObject) = MessageDigest.getInstance("SHA-256").digest(canonical(command).toByteArray()).joinToString("") { "%02x".format(it) }
  private fun key(request: String, operation: String) = JSONArray().put(request).put(operation).toString()
  fun replay(context: Context, request: String, command: JSONObject): JSONObject? {
    val entry = rows(context).optJSONObject(key(request, command.getString("operationKey"))) ?: return null
    if (entry.getString("commandHash") != digest(command)) throw PhoneFailure("operation_conflict", "操作编号已用于另一组参数。先核对原回执；新步骤使用新编号。")
    val result = entry.optJSONObject("result") ?: JSONObject().put("ok", false).put("status", "uncertain").put("code", "uncertain_operation")
      .put("mayHaveExecuted", true).put("message", "此前操作可能已执行，但进程未保存最终结果；必须先核对真实界面，不能盲目重发。")
    return JSONObject(result.toString()).put("replayed", true)
  }
  fun begin(context: Context, request: String, execution: String, command: JSONObject) {
    require(request.isNotBlank() && execution.isNotBlank() && command.getString("operationKey").isNotBlank())
    val all = rows(context)
    val retained = PhonePolicy.retainedRequests(all.keys().asSequence().map { all.getJSONObject(it) }.map { it.getString("requestId") to it.getLong("createdAt") }.toList(), request)
    all.keys().asSequence().toList().filter { all.getJSONObject(it).getString("requestId") !in retained }.forEach(all::remove)
    // Do not persist contact names, message text or the entire screen in a second database.
    all.put(key(request, command.getString("operationKey")), JSONObject().put("requestId", request).put("executionId", execution)
      .put("createdAt", System.currentTimeMillis()).put("operationKey", command.getString("operationKey")).put("commandHash", digest(command)))
    save(context, all)
  }
  fun finish(context: Context, request: String, command: JSONObject, result: JSONObject) {
    val all = rows(context); val entry = all.getJSONObject(key(request, command.getString("operationKey")))
    // Replay execution facts, not a stale/private copy of the screen. Observations are metadata below.
    entry.put("result", JSONObject(result.toString()).apply { remove("screen") }); save(context, all)
  }
  fun observed(context: Context, request: String, command: JSONObject, frame: JSONObject) {
    val all = rows(context); val entry = all.optJSONObject(key(request, command.getString("operationKey"))) ?: return
    if (entry.optString("commandHash") != digest(command)) return
    val observation = JSONObject().put("ok", frame.optBoolean("ok")).put("at", System.currentTimeMillis())
    for (field in listOf("snapshotId", "packageName", "windowId", "appVersion", "emptyTree", "code"))
      if (frame.has(field)) observation.put(field, frame.get(field))
    entry.put("observation", observation); save(context, all)
  }
  fun receipts(context: Context, request: String): JSONArray {
    val result = JSONArray(); val all = rows(context)
    all.keys().forEach { key -> val entry = all.getJSONObject(key); if (entry.optString("requestId") == request) result.put(entry) }
    return result
  }
  fun clear(context: Context) {
    if (!prefs(context).edit().clear().commit()) throw PhoneFailure("storage_failed", "手机控制回执清理失败。")
  }
}
