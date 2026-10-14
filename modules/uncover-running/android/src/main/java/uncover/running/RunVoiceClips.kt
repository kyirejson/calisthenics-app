package uncover.running

/** Mirrors voiceClips.ts; only the recorder's finite announcement grammar. */
internal object RunVoiceClips {
  fun cleanStyle(value: String) = value.also { require(it == "female" || it == "male") { "请选择女声或男声。" } }
  fun number(n: Long): List<String> {
    require(n in 0..999999999) { "播报数字超出范围。" }
    if (n < 100) return listOf("n$n")
    val (value, key) = listOf(100000000L to "hundred_million", 10000L to "ten_thousand", 1000L to "thousand", 100L to "hundred").first { n >= it.first }
    val rest = n % value
    return number(n / value) + key + if (rest > 0) (if (rest < value / 10) listOf("n0") else emptyList()) + number(rest) else emptyList()
  }
  fun forText(text: String): List<String> {
    val fixed = mapOf("开始跑步" to "start", "继续跑步" to "resume", "跑步已暂停" to "pause", "已自动暂停，重新跑动后继续" to "auto_pause", "已自动继续跑步" to "auto_resume")
    fixed[text]?.let { return listOf(it) }
    val match = Regex("^(您已跑了|计步估算，您已跑了|已记录定位路段)(\\d+)公里，用时(\\d+)(分钟|分(\\d+)秒)。$").matchEntire(text) ?: error("跑步播报内容无效。")
    val g = match.groupValues
    val prefix = when (g[1]) { "您已跑了" -> "distance"; "已记录定位路段" -> "partial"; else -> "estimated" }
    return listOf(prefix) + number(g[2].toLong()) + "km_time" + number(g[3].toLong()) +
      if (g[4] == "分钟") listOf("minutes") else listOf("minute") + number(g[5].toLong()) + "seconds"
  }
}
