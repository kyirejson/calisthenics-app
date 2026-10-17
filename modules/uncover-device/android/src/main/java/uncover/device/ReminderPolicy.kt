package uncover.device

import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneId

/** Time/identity validation only. The model interprets the user's date and recurrence. */
object ReminderPolicy {
  fun instant(at: String): Long = try { OffsetDateTime.parse(at).toInstant().toEpochMilli() }
    catch (_: Exception) { throw PhoneFailure("invalid_reminder_time", "提醒时间需包含日期和时区偏移，例如 2026-10-17T11:30:00+08:00。") }
  fun zone(value: String): ZoneId = try { ZoneId.of(value) }
    catch (_: Exception) { throw PhoneFailure("invalid_time_zone", "提醒时区无效。") }
  fun days(values: List<Int>): List<Int> {
    if (values.any { it !in 1..7 } || values.distinct().size != values.size) throw PhoneFailure("invalid_repeat_days", "重复日期使用 1 至 7（周一至周日），不得重复。")
    return values.sorted()
  }
  fun next(first: Long, zone: String, days: List<Int>, after: Long): Long? {
    if (days.isEmpty()) return first.takeIf { it > after }
    val origin = Instant.ofEpochMilli(first).atZone(zone(zone))
    val today = Instant.ofEpochMilli(maxOf(after, first - 1)).atZone(origin.zone).toLocalDate()
    for (offset in 0..7) {
      val date = today.plusDays(offset.toLong())
      val value = date.atTime(origin.toLocalTime()).atZone(origin.zone).toInstant().toEpochMilli()
      if (date.dayOfWeek.value in days && value > after && value >= first) return value
    }
    return null
  }
}
