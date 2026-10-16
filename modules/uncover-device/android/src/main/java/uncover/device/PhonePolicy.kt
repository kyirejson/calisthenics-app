package uncover.device

import java.net.URI

class PhoneFailure(val code: String, message: String) : IllegalStateException(message)

/** Platform/protocol facts only. No app list, contact matcher, route planner or intent classifier. */
object PhonePolicy {
  const val PAGE_SIZE = 200
  const val QUIET_MS = 100L
  const val NO_EVENT_GRACE_MS = 280L
  const val DEADLINE_MS = 1800L
  fun ready(now: Long, started: Long, lastEvent: Long, changed: Boolean, afterAction: Boolean): Boolean =
    now - lastEvent >= QUIET_MS && (!afterAction || changed || now - started >= NO_EVENT_GRACE_MS)
  fun packageName(value: String): String {
    if (!Regex("[A-Za-z_][A-Za-z0-9_]*(?:\\.[A-Za-z_][A-Za-z0-9_]*)*").matches(value))
      throw PhoneFailure("invalid_package", "应用包名无效，请从真实应用列表中选择。")
    return value
  }
  fun launchUri(value: String): String {
    val uri = try { URI(value) } catch (_: Exception) { throw PhoneFailure("invalid_uri", "应用链接格式不正确。") }
    val scheme = uri.scheme?.lowercase()
    if (scheme == null || scheme in setOf("file", "content", "data", "javascript", "intent") || uri.userInfo != null)
      throw PhoneFailure("unsafe_uri", "此链接不是可交给目标应用的公开页面链接。")
    if (scheme in setOf("https", "http") && uri.host.isNullOrBlank()) throw PhoneFailure("invalid_uri", "网页链接缺少主机名。")
    return value
  }
  fun retainedRequests(history: List<Pair<String, Long>>, current: String): Set<String> = history.groupBy({ it.first }, { it.second })
    .mapValues { (_, times) -> times.maxOrNull() ?: 0L }.filterKeys { it != current }.entries.sortedByDescending { it.value }.take(31).map { it.key }.toSet() + current
  fun point(x: Double, y: Double, left: Int, top: Int, right: Int, bottom: Int) {
    if (!x.isFinite() || !y.isFinite() || x < left || x >= right || y < top || y >= bottom)
      throw PhoneFailure("outside_screen", "手势坐标不在刚读取的真实屏幕范围内，请重新观察。")
  }
}
