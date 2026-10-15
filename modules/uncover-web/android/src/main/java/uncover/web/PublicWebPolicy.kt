package uncover.web

import java.net.InetAddress
import java.net.URL

internal object PublicWebPolicy {
  fun validate(url: URL) {
    require(url.protocol in listOf("https", "http") && url.userInfo == null && url.port in listOf(-1, 80, 443) &&
      url.host.contains('.') && !url.host.lowercase().trimEnd('.').let { it.endsWith(".local") || it.endsWith(".internal") || it.endsWith(".localhost") }) { "只允许公开互联网网页。" }
  }
  fun isPublic(address: InetAddress): Boolean {
    if (address.isAnyLocalAddress || address.isLoopbackAddress || address.isLinkLocalAddress || address.isSiteLocalAddress || address.isMulticastAddress) return false
    val bytes = address.address.map { it.toInt() and 255 }
    if (bytes.size == 4) return bytes[0] !in listOf(0, 127) && bytes[0] < 224 && !(bytes[0] == 100 && bytes[1] in 64..127) && !(bytes[0] == 198 && bytes[1] in 18..19)
    return bytes.size == 16 && bytes[0] and 254 != 252
  }
}
