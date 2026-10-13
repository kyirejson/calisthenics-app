package uncover.running

/** Pure, unit-testable speech content. No timer-only or synthetic mileage. */
internal object KilometreAnnouncement {
  data class Announcement(val km: Int, val text: String)
  fun next(distanceM: Double?, elapsedMs: Long, lastKm: Int, indoor: Boolean = false, partial: Boolean = false): Announcement? {
    if (distanceM == null || !distanceM.isFinite() || distanceM < 1000 || elapsedMs < 0 || lastKm < 0) return null
    val km = (distanceM / 1000).toInt()
    if (km <= lastKm) return null
    val seconds = elapsedMs / 1000; val minutes = seconds / 60; val remainder = seconds % 60
    val prefix = if (indoor) "计步估算，您已跑了" else if (partial) "已记录定位路段" else "您已跑了"
    val duration = if (remainder > 0) "${minutes}分${remainder}秒" else "${minutes}分钟"
    return Announcement(km, "${prefix}${km}公里，用时${duration}。")
  }
}
