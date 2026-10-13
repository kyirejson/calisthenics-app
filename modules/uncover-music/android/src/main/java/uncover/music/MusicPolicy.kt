package uncover.music

import java.net.URI

internal class MusicFailure(val code: String, message: String, val details: org.json.JSONObject? = null) : IllegalStateException(message)
internal object MusicPolicy {
  val packages = mapOf("netease" to "com.netease.cloudmusic", "qq" to "com.tencent.qqmusic")
  fun packageFor(provider: String): String = packages[provider] ?: throw MusicFailure("invalid_provider", "请选择网易云音乐或 QQ 音乐。")
  fun acceptsUri(provider: String, raw: String): Boolean {
    val uri = try { URI(raw) } catch (_: Exception) { return false }
    val scheme = uri.scheme?.lowercase() ?: return false
    if (scheme == "orpheus") return provider == "netease"
    if (scheme == "qqmusic") return provider == "qq"
    if (scheme !in setOf("https", "http") || uri.userInfo != null) return false
    val host = uri.host?.lowercase() ?: return false
    val domains = if (provider == "netease") listOf("music.163.com", "music.126.net", "163cn.tv") else listOf("y.qq.com", "c.y.qq.com")
    return domains.any { host == it || host.endsWith(".$it") }
  }
}
