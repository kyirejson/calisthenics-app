package uncover.music

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** Records the attempt before the cross-app side effect. A crash must not blindly replay a tap. */
internal object MusicLedger {
  private val cancelled = mutableSetOf<String>()
  private const val FILE = "uncover_music_v1"
  private fun prefs(context: Context) = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)
  fun consent(context: Context, kind: String): Boolean = prefs(context).getBoolean("consent_$kind", false)
  fun setConsent(context: Context, kind: String, value: Boolean) {
    if (!prefs(context).edit().putBoolean("consent_$kind", value).commit()) throw MusicFailure("storage_failed", "音乐授权设置保存失败。")
  }
  private fun entries(context: Context): JSONObject = try { JSONObject(prefs(context).getString("receipts", "{}")!!) }
    catch (_: Exception) { throw MusicFailure("journal_corrupt", "音乐操作记录无法读取，请先在音乐设置中关闭控制并清理音乐操作记录。") }
  private fun write(context: Context, rows: JSONObject) {
    if (!prefs(context).edit().putString("receipts", rows.toString()).commit()) throw MusicFailure("storage_failed", "音乐操作暂存失败，未重复执行，请核对当前音乐界面。")
  }
  private fun key(requestId: String, operationKey: String) = JSONArray().put(requestId).put(operationKey).toString()
  @Synchronized fun cancel(executionId: String) { cancelled.add(executionId) }
  @Synchronized fun isCancelled(executionId: String) = executionId in cancelled
  fun replay(context: Context, requestId: String, command: JSONObject): JSONObject? {
    val item = entries(context).optJSONObject(key(requestId, command.getString("operationKey"))) ?: return null
    if (item.getJSONObject("command").toString() != command.toString()) throw MusicFailure("operation_conflict", "操作编号已使用，请核对旧回执；新步骤使用新编号，不能重复旧操作。")
    val result = item.optJSONObject("result") ?: JSONObject().put("ok", false).put("code", "uncertain_operation").put("status", "uncertain").put("message", "此前请求可能已执行，但进程中断未确认；请先查看界面或播放状态，不要盲目重复。")
    return JSONObject(result.toString()).put("replayed", true)
  }
  fun begin(context: Context, requestId: String, command: JSONObject) {
    require(requestId.isNotBlank() && command.getString("operationKey").isNotBlank())
    val rows = entries(context)
    val history = rows.keys().asSequence().map { rows.getJSONObject(it) }.map { it.optString("requestId") to it.optLong("createdAt") }.toList()
    val expired = MusicJournalPolicy.expiredRequests(history, requestId)
    rows.keys().asSequence().toList().filter { rows.getJSONObject(it).optString("requestId") in expired }.forEach { rows.remove(it) }
    rows.put(key(requestId, command.getString("operationKey")), JSONObject().put("requestId", requestId).put("createdAt", System.currentTimeMillis()).put("operationKey", command.getString("operationKey")).put("command", command))
    write(context, rows)
    if (!prefs(context).edit().putString("owner", requestId).commit()) throw MusicFailure("storage_failed", "音乐任务状态保存失败。")
  }
  fun finish(context: Context, requestId: String, command: JSONObject, result: JSONObject) {
    val rows = entries(context)
    val id = key(requestId, command.getString("operationKey"))
    if (result.optBoolean("ok")) rows.getJSONObject(id).put("result", result) else rows.remove(id)
    write(context, rows)
  }
  fun receipts(context: Context, requestId: String): JSONArray {
    val rows = entries(context)
    val result = JSONArray()
    rows.keys().forEach { id -> val item = rows.getJSONObject(id); if (item.optString("requestId") == requestId) result.put(item) }
    return result
  }
  fun owns(context: Context, requestId: String) = prefs(context).getString("owner", null) == requestId
  fun clear(context: Context) {
    if (!prefs(context).edit().clear().commit()) throw MusicFailure("storage_failed", "音乐操作记录清理失败。")
  }
}
