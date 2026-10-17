package uncover.device

import android.Manifest
import android.app.*
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject
import java.time.ZoneId
import java.util.UUID
import java.security.MessageDigest

/** AlarmManager and a receiver own delivery. No JS process, LLM, microphone or Shizuku is needed. */
object PhoneReminders {
  private const val FILE = "max_reminders_v1"
  private const val CHANNEL = "max_reminders"
  private fun prefs(context: Context) = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)
  private fun manager(context: Context) = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
  private fun notifications(context: Context) = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
  private fun channel(context: Context) {
    notifications(context).createNotificationChannel(NotificationChannel(CHANNEL, "MAX 事项提醒", NotificationManager.IMPORTANCE_HIGH).apply { description = "你让 MAX 安排的本地事项提醒" })
  }
  fun status(context: Context): JSONObject {
    if (Build.VERSION.SDK_INT < 26) return JSONObject().put("ok", false).put("native", false).put("code", "reminder_unsupported")
      .put("notificationsGranted", false).put("exactAlarmsGranted", false).put("message", "本地事项提醒需要 Android 8 或更高版本。")
    channel(context)
    val notificationAllowed = notifications(context).areNotificationsEnabled() && notifications(context).getNotificationChannel(CHANNEL)?.importance != NotificationManager.IMPORTANCE_NONE &&
      (Build.VERSION.SDK_INT < 33 || context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED)
    return JSONObject().put("ok", true).put("native", true).put("notificationsGranted", notificationAllowed)
      .put("exactAlarmsGranted", Build.VERSION.SDK_INT < 31 || manager(context).canScheduleExactAlarms())
      .put("timeZone", ZoneId.systemDefault().id).put("now", System.currentTimeMillis())
      .put("lastError", prefs(context).getString("lastError", null) ?: JSONObject.NULL)
  }
  private fun rows(context: Context) = JSONObject(prefs(context).getString("rows", "{}")!!)
  private fun operations(context: Context) = JSONObject(prefs(context).getString("operations", "{}")!!)
  private fun save(context: Context, value: JSONObject, operations: JSONObject? = null) {
    if (!prefs(context).edit().putString("rows", value.toString()).apply { operations?.let { putString("operations", it.toString()) } }.commit()) throw PhoneFailure("reminder_storage_failed", "提醒未能保存，请稍后重试。")
  }
  private fun pending(context: Context, id: String): PendingIntent = PendingIntent.getBroadcast(context, 0,
    Intent(context, ReminderReceiver::class.java).setAction("uncover.reminder.FIRE").setData(Uri.parse("uncover://reminder/$id")), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  private fun days(row: JSONObject) = row.getJSONArray("repeatDays").let { array -> (0 until array.length()).map(array::getInt) }
  private fun requirePermission(context: Context) {
    val state = status(context)
    if (!state.getBoolean("notificationsGranted")) throw PhoneFailure("reminder_notifications_required", "系统尚未允许 MAX 提醒通知；请在服务设置的事项提醒中开启一次。")
    if (!state.getBoolean("exactAlarmsGranted")) throw PhoneFailure("reminder_exact_alarm_required", "系统尚未允许准时提醒；请在服务设置开启“闹钟和提醒”权限一次。尚未创建此提醒。")
  }
  private fun schedule(context: Context, row: JSONObject) {
    manager(context).setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, row.getLong("nextAt"), pending(context, row.getString("id")))
  }
  @Synchronized fun list(context: Context): JSONObject {
    val all = rows(context); val entries = JSONArray()
    var completed = 0
    all.keys().forEach { val row = all.getJSONObject(it); if (row.optString("state") == "notified") completed++ else entries.put(row) }
    return status(context).put("reminders", entries).put("completedCount", completed)
  }
  @Synchronized fun write(context: Context, request: String, input: JSONObject): JSONObject {
    if (Build.VERSION.SDK_INT < 26) throw PhoneFailure("reminder_unsupported", "本地事项提醒需要 Android 8 或更高版本。")
    require(request.isNotBlank() && input.getString("operationKey").isNotBlank())
    val title = input.getString("title").trim()
    if (title.isEmpty()) throw PhoneFailure("invalid_reminder", "提醒内容不能为空。")
    val first = ReminderPolicy.instant(input.getString("at")); val now = System.currentTimeMillis()
    val zone = input.optString("timeZone", ZoneId.systemDefault().id); ReminderPolicy.zone(zone)
    val repeatDays = input.optJSONArray("repeatDays")?.let { array -> ReminderPolicy.days((0 until array.length()).map(array::getInt)) } ?: emptyList()
    val id = input.optString("id").ifBlank { UUID.nameUUIDFromBytes("$request:${input.getString("operationKey")}".toByteArray()).toString() }
    val all = rows(context); val previous = all.optJSONObject(id)
    val operation = JSONArray().put(request).put(input.getString("operationKey")).toString()
    val payload = JSONObject().put("id", id).put("title", title).put("at", input.getString("at")).put("timeZone", zone).put("repeatDays", JSONArray(repeatDays)).toString()
    val hash = MessageDigest.getInstance("SHA-256").digest(payload.toByteArray()).joinToString("") { "%02x".format(it) }
    val ops = operations(context); val priorOps = JSONObject(ops.toString())
    ops.optJSONObject(operation)?.let { recorded ->
      if (recorded.getString("hash") != hash) throw PhoneFailure("operation_conflict", "提醒操作编号已使用；修改提醒请使用新编号。")
      // A retry after editing/cancelling must not recreate or rewind the old reminder.
      return status(context).put("replayed", true).put("reminder", previous ?: JSONObject.NULL).put("cancelled", previous == null)
    }
    requirePermission(context)
    if (input.has("id") && previous == null) throw PhoneFailure("reminder_not_found", "未找到要修改的提醒，请先读取提醒列表。")
    val next = ReminderPolicy.next(first, zone, repeatDays, now) ?: throw PhoneFailure("reminder_time_in_past", "提醒时间已过去，请结合用户意图确定下一次时间。")
    val row = JSONObject().put("id", id).put("title", title).put("at", input.getString("at")).put("firstAt", first).put("timeZone", zone)
      .put("repeatDays", JSONArray(repeatDays)).put("nextAt", next).put("state", "scheduled")
    // Commit intent before scheduling. Startup restores a row if the process dies between these calls.
    ops.put(operation, JSONObject().put("hash", hash).put("id", id).put("createdAt", now))
    ops.keys().asSequence().toList().sortedByDescending { ops.getJSONObject(it).optLong("createdAt") }.drop(512).forEach(ops::remove)
    all.put(id, row); save(context, all, ops)
    try { schedule(context, row) } catch (error: Exception) {
      if (previous == null) all.remove(id) else all.put(id, previous)
      save(context, all, priorOps); throw error
    }
    return JSONObject().put("ok", true).put("reminder", row).put("delivery", "android_exact_alarm_notification")
  }
  @Synchronized fun cancel(context: Context, id: String): JSONObject {
    val all = rows(context); val existed = all.has(id)
    all.remove(id); save(context, all)
    manager(context).cancel(pending(context, id)); notifications(context).cancel(id, 1)
    return JSONObject().put("ok", true).put("id", id).put("removed", existed)
  }
  @Synchronized fun fire(context: Context, id: String) {
    val all = rows(context); val row = all.optJSONObject(id) ?: return
    if (row.optString("state") == "notified" || row.getLong("nextAt") > System.currentTimeMillis() + 1000) return
    if (!status(context).getBoolean("notificationsGranted")) { row.put("state", "blocked_notifications"); save(context, all); return }
    val open = context.packageManager.getLaunchIntentForPackage(context.packageName)?.let { intent ->
      PendingIntent.getActivity(context, id.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
    val notification = Notification.Builder(context, CHANNEL).setSmallIcon(R.drawable.max_phone_notification)
      .setContentTitle("MAX 提醒").setContentText(row.getString("title")).setStyle(Notification.BigTextStyle().bigText(row.getString("title")))
      .setCategory(Notification.CATEGORY_REMINDER).setContentIntent(open).setAutoCancel(true)
      .setVisibility(Notification.VISIBILITY_PRIVATE).build()
    notifications(context).notify(id, 1, notification)
    row.put("lastNotifiedAt", System.currentTimeMillis())
    val next = ReminderPolicy.next(row.getLong("firstAt"), row.getString("timeZone"), days(row), System.currentTimeMillis())
    if (next == null) row.put("state", "notified") else row.put("state", "scheduled").put("nextAt", next)
    save(context, all)
    if (next != null && status(context).getBoolean("exactAlarmsGranted")) schedule(context, row)
  }
  @Synchronized fun restore(context: Context) {
    val state = status(context)
    if (!state.getBoolean("notificationsGranted") || !state.getBoolean("exactAlarmsGranted")) return
    val all = rows(context)
    all.keys().asSequence().toList().forEach { id ->
      val row = all.getJSONObject(id)
      if (row.optString("state") != "notified") runCatching {
        if (row.getLong("nextAt") <= System.currentTimeMillis()) fire(context, id) else schedule(context, row)
      }.onFailure { recordFailure(context, it) }
    }
  }
  @Synchronized fun clear(context: Context) {
    val all = rows(context); all.keys().asSequence().toList().forEach { cancel(context, it) }
    if (!prefs(context).edit().clear().commit()) throw PhoneFailure("reminder_storage_failed", "提醒清理失败。")
  }
  fun recordFailure(context: Context, error: Throwable) {
    prefs(context).edit().putString("lastError", "${error.javaClass.simpleName}: ${error.message ?: "提醒调度失败"}").apply()
  }
}
