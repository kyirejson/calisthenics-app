package uncover.device

import android.accessibilityservice.AccessibilityService
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import android.os.Build
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.ExperimentalCoroutinesApi
import org.json.JSONArray
import org.json.JSONObject
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/** Optional, local-only pixels -> text. No image file, image upload, camera or GMS model download. */
object PhoneOcr {
  @OptIn(ExperimentalCoroutinesApi::class)
  private suspend fun capture(service: AccessibilityService): Bitmap {
    if (Build.VERSION.SDK_INT < 30) throw PhoneFailure("ocr_unsupported", "本机截图识字需要 Android 11 或更高；仍可使用控件读屏。")
    return withTimeout(8000) {
      suspendCancellableCoroutine { continuation ->
        service.takeScreenshot(0, service.mainExecutor, object : AccessibilityService.TakeScreenshotCallback {
          override fun onSuccess(result: AccessibilityService.ScreenshotResult) {
            val buffer = result.hardwareBuffer
            try {
              val wrapped = Bitmap.wrapHardwareBuffer(buffer, result.colorSpace) ?: throw PhoneFailure("screenshot_empty", "系统没有返回可用画面。")
              val bitmap = try { wrapped.copy(Bitmap.Config.ARGB_8888, true) ?: throw PhoneFailure("screenshot_empty", "无法读取系统画面。") } finally { wrapped.recycle() }
              if (continuation.isActive) continuation.resume(bitmap) { bitmap.recycle() } else bitmap.recycle()
            } catch (error: Exception) { if (continuation.isActive) continuation.resumeWithException(error) }
            finally { buffer.close() }
          }
          override fun onFailure(errorCode: Int) {
            if (continuation.isActive) continuation.resumeWithException(PhoneFailure("screenshot_failed", "系统拒绝截图识字（代码 $errorCode）；可能是受保护窗口、截图间隔或无障碍授权。不会绕过保护。"))
          }
        })
      }
    }
  }
  suspend fun read(service: AccessibilityService, viewport: Rect, passwords: List<Rect>): JSONObject {
    val captured = capture(service)
    val area = Rect(viewport)
    val cropped = try {
      if (!area.intersect(0, 0, captured.width, captured.height) || area.isEmpty) throw PhoneFailure("screenshot_bounds", "画面范围已改变，请重新读屏。")
      val canvas = Canvas(captured); val mask = Paint().apply { color = Color.BLACK }
      passwords.forEach { canvas.drawRect(it, mask) }
      Bitmap.createBitmap(captured, area.left, area.top, area.width(), area.height()).let {
        // createBitmap may return its input when no crop is needed; keep one independent owner.
        if (it === captured) captured.copy(Bitmap.Config.ARGB_8888, false)!! else it
      }
    } finally { captured.recycle() }
    val recognizer = TextRecognition.getClient(ChineseTextRecognizerOptions.Builder().build())
    val task = try { recognizer.process(InputImage.fromBitmap(cropped, 0)) }
      catch (error: Exception) { cropped.recycle(); recognizer.close(); throw error }
    val result = try {
      withTimeout(15000) { suspendCancellableCoroutine<Text> { continuation ->
        task.addOnSuccessListener { if (continuation.isActive) continuation.resume(it) }
          .addOnFailureListener { if (continuation.isActive) continuation.resumeWithException(it) }
      } }
    } finally {
      // ML Kit tasks are not cancellable. Keep their bitmap alive until native inference really ends.
      task.addOnCompleteListener { cropped.recycle(); recognizer.close() }
    }
    val lines = JSONArray()
    result.textBlocks.forEach { block -> block.lines.forEach { line ->
      line.boundingBox?.let { bounds -> lines.put(JSONObject().put("text", line.text)
        .put("bounds", JSONArray().put(bounds.left + area.left).put(bounds.top + area.top).put(bounds.right + area.left).put(bounds.bottom + area.top))) }
    } }
    return JSONObject().put("ok", true).put("source", "local_ocr").put("externalData", true).put("imageUploaded", false)
      .put("lines", lines).put("message", "本机识别文字可能有误，不代表理解图片或已找到可点击节点；可结合真实坐标手势并核对结果。")
  }
}
