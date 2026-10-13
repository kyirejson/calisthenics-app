package uncover.running

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.LocationManager
import android.os.HandlerThread
import android.os.Handler
import android.view.WindowManager
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.location.LocationManagerCompat
import org.json.JSONObject
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.functions.Queues

class UncoverRunningModule : Module() {
  private val context get() = appContext.reactContext ?: error("App 尚未就绪。")
  private var previewThread: HandlerThread? = null
  private var previewRequest: GpsSubscription? = null
  private fun stopPreview() {
    previewRequest?.stop(); previewRequest = null
    previewThread?.quitSafely(); previewThread = null
  }
  private fun launch(action: String, id: String? = null, mode: String = "outdoor") {
    check(appContext.currentActivity != null) { "请回到 App 再开始或继续跑步。" }
    stopPreview()
    ContextCompat.startForegroundService(context, Intent(context, RunningService::class.java).setAction(action).putExtra("id", id).putExtra("mode", mode))
  }
  override fun definition() = ModuleDefinition {
    Name("UncoverRunning")
    View(MapTilesView::class) {
      Events("onTileLoad", "onTileError")
      Prop("tiles") { view: MapTilesView, frames: List<TileFrame> -> view.setTiles(frames) }
      Prop("attempt") { view: MapTilesView, attempt: Int -> view.retry(attempt) }
    }
    AsyncFunction("insets") {
      val bars = appContext.currentActivity?.window?.decorView?.let { ViewCompat.getRootWindowInsets(it)?.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()) }
      val density = context.resources.displayMetrics.density
      JSONObject().put("top", (bars?.top ?: 0) / density).put("bottom", (bars?.bottom ?: 0) / density).toString()
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("snapshot") { after: Int -> RunStore.snapshot(context, after) }
    AsyncFunction("configure") { raw: String -> RunPreferences.write(context, raw) }.runOnQueue(Queues.MAIN)
    AsyncFunction("setVoice") { enabled: Boolean -> RunStore.setVoice(context, enabled); RunningService.instance?.refreshVoice(); Unit }.runOnQueue(Queues.MAIN)
    AsyncFunction("keepScreenOn") { enabled: Boolean ->
      appContext.currentActivity?.window?.let { window ->
        if (enabled) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
      }
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("preview") {
      check(ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED || ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) { "位置权限未开启；仍可开始计时。" }
      check(LocationManagerCompat.isLocationEnabled(context.getSystemService(Context.LOCATION_SERVICE) as LocationManager)) { "请打开系统定位开关。" }
      stopPreview()
      if (RunStore.phase() == "running") {
        check(RunStore.mode() == "outdoor") { "室内跑不使用定位。" }
        launch("locate")
      } else {
        previewThread = HandlerThread("UncoverGpsPreview").also { it.start() }
        try {
          previewRequest = GpsSubscription(context, Handler(previewThread!!.looper), false).also { it.start() }
        } catch (exception: Exception) { stopPreview(); throw exception }
      }
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("stopPreview") { stopPreview() }.runOnQueue(Queues.MAIN)
    AsyncFunction("start") { id: String, mode: String -> launch("start", id, mode) }.runOnQueue(Queues.MAIN)
    AsyncFunction("pause") {
      if (RunningService.instance != null) context.startService(Intent(context, RunningService::class.java).setAction("pause")) else RunStore.pause(context)
      Unit // Never expose startService's ComponentName through the JS bridge.
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("resume") { launch("resume") }.runOnQueue(Queues.MAIN)
    AsyncFunction("finish") { distance: Double -> if (RunningService.instance != null) RunningService.instance!!.finish(distance) else RunStore.finish(context, distance) }
    AsyncFunction("acknowledge") { id: String -> RunStore.acknowledge(context, id) }
    AsyncFunction("clear") { stopPreview(); context.stopService(Intent(context, RunningService::class.java)); RunStore.clear(context) }
    OnDestroy { stopPreview() } // Recording belongs to the service, not a mounted JS screen.
  }
}
