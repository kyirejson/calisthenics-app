package uncover.running

import android.content.Context
import android.util.AtomicFile
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/** Only visible viewport tiles. Identifiable native requests, persistent HTTP cache. */
internal object TileCache {
  @Synchronized fun get(context: Context, zoom: Int, x: Int, y: Int): File {
    require(zoom in 3..18 && x in 0 until (1 shl zoom) && y in 0 until (1 shl zoom))
    val directory = File(context.cacheDir, "running-map-tiles").apply { mkdirs() }
    val image = File(directory, "${zoom}_${x}_${y}.png")
    val metadata = File(directory, "${zoom}_${x}_${y}.json")
    val info = try { JSONObject(metadata.readText()) } catch (_: Exception) { JSONObject() }
    if (image.exists() && info.optLong("expiresAt") > System.currentTimeMillis()) return image
    val connection = URL("https://tile.openstreetmap.org/$zoom/$x/$y.png").openConnection() as HttpURLConnection
    connection.connectTimeout = 8000; connection.readTimeout = 10000
    connection.setRequestProperty("User-Agent", "Uncover/1.7.2 (+https://github.com/kyirejson/calisthenics-app; Android)")
    connection.setRequestProperty("X-Requested-With", context.packageName)
    if (image.exists() && info.has("etag")) connection.setRequestProperty("If-None-Match", info.getString("etag"))
    try {
      val code = connection.responseCode
      check(code == 200 || (code == 304 && image.exists())) { "地图服务返回 HTTP $code。" }
      if (code == 200) {
        check(connection.contentType?.startsWith("image/") == true) { "地图响应不是图像。" }
        val file = AtomicFile(image); val stream = file.startWrite()
        try { connection.inputStream.use { it.copyTo(stream) }; file.finishWrite(stream) }
        catch (exception: Exception) { file.failWrite(stream); throw exception }
      }
      val lifetime = Regex("max-age=(\\d+)").find(connection.getHeaderField("Cache-Control") ?: "")?.groupValues?.get(1)?.toLongOrNull()?.times(1000)
        ?: (7L * 24 * 60 * 60 * 1000)
      info.put("expiresAt", System.currentTimeMillis() + lifetime)
      connection.getHeaderField("ETag")?.let { info.put("etag", it) }
      val file = AtomicFile(metadata); val stream = file.startWrite()
      try { stream.write(info.toString().toByteArray()); file.finishWrite(stream) }
      catch (exception: Exception) { file.failWrite(stream); throw exception }
      return image
    } catch (exception: Exception) {
      // Previously cached geography is still useful offline. Never substitute invented tiles.
      if (image.exists()) return image
      throw exception
    } finally { connection.disconnect() }
  }
}
