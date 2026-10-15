package uncover.web

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.functions.Queues
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.IDN
import java.net.InetAddress
import java.net.URL
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import okhttp3.Call
import okhttp3.Dns
import okhttp3.OkHttpClient
import okhttp3.Request

/** Public, unauthenticated text only. Each redirect and DNS result is checked before connecting. */
class UncoverWebModule : Module() {
  class Job { val cancelled = AtomicBoolean(false); @Volatile var call: Call? = null }
  private val jobs = ConcurrentHashMap<String, Job>()
  private val client = OkHttpClient.Builder().followRedirects(false).followSslRedirects(false)
    .connectTimeout(12, TimeUnit.SECONDS).readTimeout(15, TimeUnit.SECONDS).callTimeout(20, TimeUnit.SECONDS).build()
  override fun definition() = ModuleDefinition {
    Name("UncoverWeb")
    AsyncFunction("cancel") { id: String -> jobs[id]?.let { it.cancelled.set(true); it.call?.cancel() }; Unit }.runOnQueue(Queues.MAIN)
    AsyncFunction("read") { id: String, address: String ->
      val job = Job(); check(jobs.putIfAbsent(id, job) == null) { "网页请求编号重复。" }
      try { readPublicPage(address, job) } finally { jobs.remove(id); job.call?.cancel() }
    }
    OnDestroy { jobs.values.forEach { it.cancelled.set(true); it.call?.cancel() }; jobs.clear() }
  }
  fun readPublicPage(address: String, job: Job = Job()): String {
    var url = URL(address)
    repeat(6) {
      check(!job.cancelled.get()) { "网页请求已取消。" }
      PublicWebPolicy.validate(url)
      val host = IDN.toASCII(url.host).lowercase()
      val addresses = InetAddress.getAllByName(host).toList()
      require(addresses.isNotEmpty() && addresses.all(PublicWebPolicy::isPublic)) { "网页地址指向本机或私有网络，未访问。" }
      // Pin the validated resolution: a second DNS lookup must not rebind to a private address.
      val pinned = client.newBuilder().dns(object : Dns { override fun lookup(hostname: String): List<InetAddress> { require(hostname.equals(host, true)); return addresses } }).build()
      val call = pinned.newCall(Request.Builder().url(url).header("User-Agent", "Uncover/1.0 (public-text-reader)")
        .header("Accept", "text/html,application/rss+xml,application/xml,text/plain").header("Accept-Encoding", "identity").build())
      job.call = call; if (job.cancelled.get()) call.cancel()
      call.execute().use { response ->
        val code = response.code
        if (code in listOf(301, 302, 303, 307, 308)) { url = URL(url, response.header("Location") ?: error("网页重定向没有目标。")); return@repeat }
        check(code in 200..299) { "网页请求失败（HTTP $code）。" }
        val body = response.body ?: error("网页响应没有正文。")
        val type = response.header("Content-Type") ?: ""
        require(type.contains("text/") || type.contains("xml") || type.contains("json")) { "该链接不是文本网页。" }
        require(body.contentLength() <= 2 * 1024 * 1024) { "网页超过读取大小，请选择正文页面。" }
        val output = ByteArrayOutputStream()
        body.byteStream().use { stream ->
          val buffer = ByteArray(8192)
          while (true) {
            check(!job.cancelled.get()) { "网页请求已取消。" }
            val count = stream.read(buffer); if (count < 0) break
            require(output.size() + count <= 2 * 1024 * 1024) { "网页超过读取大小。" }; output.write(buffer, 0, count)
          }
        }
        val text = output.toByteArray().toString(body.contentType()?.charset(Charsets.UTF_8) ?: Charsets.UTF_8)
        return JSONObject().put("url", url.toString()).put("contentType", type).put("text", text).toString()
      }
    }
    error("网页重定向过多，未继续访问。")
  }
}
