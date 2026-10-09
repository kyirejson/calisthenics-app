package uncover.running

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.ColorMatrixColorFilter
import android.graphics.Paint
import android.graphics.RectF
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class TileFrame : Record {
  @Field var key: String = ""
  @Field var x: Double = 0.0
  @Field var y: Double = 0.0
}

/** Filter map imagery only. Route, labels and GPS controls stay unfiltered. */
class MapTilesView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val onTileLoad by EventDispatcher()
  private val onTileError by EventDispatcher()
  private val ui = Handler(Looper.getMainLooper())
  private var scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
  private var frames: List<TileFrame> = emptyList()
  private val images = mutableMapOf<String, Bitmap>()
  private val pending = mutableSetOf<String>()
  private val failed = mutableSetOf<String>()
  private var attempt = 0
  private var generation = 0
  private val paint = Paint(Paint.FILTER_BITMAP_FLAG).apply {
      colorFilter = ColorMatrixColorFilter(floatArrayOf(
        -.17008f, -.57216f, -.05776f, 0f, 219f,
        -.17008f, -.57216f, -.05776f, 0f, 232f,
        -.17008f, -.57216f, -.05776f, 0f, 235f,
        0f, 0f, 0f, 1f, 0f
      ))
  }
  init { setWillNotDraw(false) }

  fun setTiles(value: List<TileFrame>) {
    frames = value.filter { it.x.isFinite() && it.y.isFinite() }
    val visible = frames.map { it.key }.toSet()
    images.keys.retainAll(visible); failed.retainAll(visible)
    loadVisible(); invalidate()
  }
  fun retry(value: Int) {
    if (attempt == value) return
    attempt = value; failed.clear(); loadVisible()
  }
  private fun loadVisible() {
    for (frame in frames) {
      val key = frame.key
      if (images.containsKey(key) || key in pending || key in failed) continue
      pending.add(key)
      val started = generation
      scope.launch {
        try {
          val address = key.split('/').map { it.toInt() }
          require(address.size == 3)
          val file = TileCache.get(context, address[0], address[1], address[2])
          val bitmap = BitmapFactory.decodeFile(file.absolutePath) ?: error("地图瓦片无法解码。")
          check(bitmap.width == 256 && bitmap.height == 256) { "地图瓦片尺寸不正确。" }
          ui.post {
            if (started != generation) return@post
            pending.remove(key)
            if (frames.any { it.key == key }) {
              images[key] = bitmap; invalidate(); onTileLoad(mapOf("key" to key))
            }
          }
        } catch (_: Exception) {
          ui.post {
            if (started != generation) return@post
            pending.remove(key)
            if (frames.any { it.key == key }) { failed.add(key); onTileError(mapOf("key" to key)) }
          }
        }
      }
    }
  }
  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    val density = resources.displayMetrics.density
    for (frame in frames) {
      val image = images[frame.key] ?: continue
      val left = frame.x.toFloat() * density; val top = frame.y.toFloat() * density
      canvas.drawBitmap(image, null, RectF(left, top, left + 256 * density, top + 256 * density), paint)
    }
  }
  override fun onDetachedFromWindow() {
    generation++; scope.cancel(); pending.clear(); images.clear()
    super.onDetachedFromWindow()
  }
  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    if (!scope.isActive) scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    loadVisible()
  }
}
