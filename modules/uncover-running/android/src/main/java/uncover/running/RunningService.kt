package uncover.running

import android.Manifest
import android.app.*
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.LocationManager
import android.location.Location
import android.os.*
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.core.location.LocationManagerCompat

class RunningService : Service() {
  companion object { @Volatile internal var instance: RunningService? = null; private const val CHANNEL = "uncover_running_v2" }
  private lateinit var worker: HandlerThread
  private lateinit var handler: Handler
  private var request: GpsSubscription? = null
  private var steps: RunSteps? = null
  private var voice: RunVoice? = null
  private val motion = MotionGate()
  private val checkpoint = object : Runnable {
    override fun run() {
      try { announceProgress(); RunStore.persist(this@RunningService); notifyState() }
      catch (_: Exception) { RunStore.problem("草稿保存失败，已暂停以保护记录。"); safelyPause() }
      if (RunStore.phase() != "finished") handler.postDelayed(this, 5000)
    }
  }

  override fun onCreate() {
    super.onCreate()
    // Promote immediately, before any file read, GPS request or worker startup.
    try {
      val notificationManager = getSystemService(NotificationManager::class.java)
      if (Build.VERSION.SDK_INT >= 26) {
        notificationManager.createNotificationChannel(NotificationChannel(CHANNEL, "跑步记录", NotificationManager.IMPORTANCE_LOW))
      }
      val notification = notification()
      // The workout stopwatch needs no location permission. Only upgrade to
      // location FGS once location prerequisites are satisfied from the visible app.
      if (Build.VERSION.SDK_INT >= 34) startForeground(4208, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
      else if (Build.VERSION.SDK_INT >= 29) startForeground(4208, notification, 0) else startForeground(4208, notification)
      worker = HandlerThread("UncoverGps").also { it.start() }; handler = Handler(worker.looper); instance = this
    } catch (exception: Exception) { RunStore.problem("无法启动跑步记录服务（${exception.javaClass.simpleName}），请回到 App 重试。"); stopSelf() }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (!::handler.isInitialized) return START_NOT_STICKY
    handler.post {
      try {
        when (intent?.action) {
          "start" -> { RunStore.begin(this, intent.getStringExtra("id")!!, intent.getStringExtra("mode") ?: "outdoor"); setupFeatures(); voice?.say("开始跑步"); subscribe() }
          "resume" -> { RunStore.resume(this); motion.reset(); setupFeatures(); voice?.say("继续跑步"); subscribe() }
          "locate" -> { unsubscribe(); subscribe() }
          "pause" -> { safelyPause(); voice?.say("跑步已暂停") }
        }
        handler.removeCallbacks(checkpoint); handler.postDelayed(checkpoint, 5000); notifyState()
      } catch (exception: Exception) {
        RunStore.problem(exception.message ?: "定位启动失败。"); safelyPause(); stopSelf()
      }
    }
    return START_NOT_STICKY // Never silently restart with stale while-in-use permissions.
  }

  private fun subscribe() {
    if (request != null || RunStore.mode() == "indoor") return
    val allowed = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED || ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
    val manager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
    if (!allowed || !LocationManagerCompat.isLocationEnabled(manager)) return
    try {
      if (Build.VERSION.SDK_INT >= 29) startForeground(4208, notification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION or (if (Build.VERSION.SDK_INT >= 34) ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE else 0))
      request = GpsSubscription(this, handler, true, { value, provider ->
        try { motionFix(value, provider) }
        catch (_: Exception) { RunStore.problem("自动暂停记录保存失败，已暂停保护记录，请检查存储空间。"); safelyPause() }
      }).also { it.start() }
    } catch (exception: Exception) {
      request?.stop(); request = null
      GpsDiagnostics.failed("定位请求失败（${exception.javaClass.simpleName}）；计时仍在继续，可重试定位。")
    }
  }
  private fun unsubscribe() {
    request?.stop(); request = null
  }
  private fun setupFeatures() {
    val options = RunStore.options(this)
    if (options.optBoolean("voice") && voice == null) try { voice = RunVoice(this).also { it.start() } }
      catch (_: Exception) { RunStore.speechIssue = "语音引擎启动失败，跑步记录不受影响。" }
    if (RunStore.mode() == "indoor" && options.optBoolean("stepTracking")) {
      try {
        if (steps == null) steps = RunSteps(this, handler, RunStore::addSteps)
        RunStore.stepIssue = steps!!.start()
      } catch (_: Exception) { RunStore.stepIssue = "计步传感器不可用，仍可计时并手动填写距离。" }
    }
  }
  private fun motionFix(location: Location, provider: String) {
    if (RunStore.error.isNotEmpty()) return
    if (!RunStore.options(this).optBoolean("autoPause") || RunStore.mode() != "outdoor" || provider !in listOf("gps", "fused")) return
    if (RunStore.phase() != "running" && !RunStore.autoPaused()) { motion.reset(); return }
    val age = SystemClock.elapsedRealtimeNanos() - location.elapsedRealtimeNanos
    if (age !in 0..3_000_000_000L) { motion.reset(); return }
    val speed = if (location.hasSpeed()) location.speed.toDouble() else null
    val uncertainty = if (Build.VERSION.SDK_INT >= 26 && location.hasSpeedAccuracy()) location.speedAccuracyMetersPerSecond.toDouble() else null
    val action = motion.update(location.elapsedRealtimeNanos / 1000000, speed, if (location.hasAccuracy()) location.accuracy.toDouble() else Double.NaN, uncertainty, RunStore.autoPaused())
    if (action == "pause") { RunStore.pause(this, automatic = true); voice?.say("已自动暂停，重新跑动后继续"); notifyState() }
    if (action == "resume") { RunStore.resume(this); voice?.say("已自动继续跑步"); notifyState() }
    // Auto-pause deliberately retains GPS updates; manual pause unsubscribes.
  }
  private fun announceProgress() {
    if (RunStore.phase() != "running" || voice?.isReady() != true) return
    val elapsed = RunStore.elapsed()
    val metrics = RunStore.liveMetrics()
    val distance = if (RunStore.mode() == "indoor") RunStore.stepDistance() else metrics.first
    val km = ((distance ?: 0.0) / 1000).toInt()
    val minutes = (elapsed / 60000).toInt()
    val partial = if (RunStore.mode() == "indoor") RunStore.stepPartial() else elapsed - metrics.second > maxOf(15000, elapsed / 10)
    val text = if (km > RunStore.spokenKm()) {
      val prefix = if (RunStore.mode() == "indoor") "计步估算" else if (partial) "已定位路段" else "已跑"
      val pace = if (!partial && distance != null && distance > 0) (elapsed / distance).toInt() else 0
      "$prefix $km 公里，用时 $minutes 分钟" + if (pace > 0) "，${if (RunStore.mode() == "indoor") "估算" else "平均"}配速 ${pace / 60} 分 ${pace % 60} 秒每公里" else "，部分距离未测得"
    } else if (minutes / 5 > RunStore.spokenMinutes() / 5) "已跑步 $minutes 分钟" else return
    if (voice!!.say(text)) RunStore.markSpoken(km, minutes)
  }
  private fun safelyPause() { unsubscribe(); steps?.stop(); motion.reset(); try { RunStore.pause(this) } catch (_: Exception) {} }
  internal fun finish(distance: Double) { if (::handler.isInitialized) handler.post { unsubscribe(); steps?.stop(); try { RunStore.finish(this, distance) } catch (exception: Exception) { RunStore.problem(exception.message ?: "结束失败。") }; stopSelf() } }

  private fun notification(): android.app.Notification {
    val open = packageManager.getLaunchIntentForPackage(packageName) ?: Intent()
    val pending = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    val seconds = RunStore.elapsed() / 1000
    val action = if (RunStore.phase() == "paused") "resume" else "pause"
    val control = PendingIntent.getService(this, 4209, Intent(this, RunningService::class.java).setAction(action), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    return NotificationCompat.Builder(this, CHANNEL).setSmallIcon(R.drawable.uncover_run_notification)
      .setContentTitle(if (RunStore.autoPaused()) "跑步已自动暂停" else if (RunStore.phase() == "paused") "跑步已暂停" else "Uncover 正在记录跑步")
      .setContentText("已记时 ${seconds / 60} 分 ${seconds % 60} 秒 · 点击返回跑步")
      .setContentIntent(pending).addAction(0, if (action == "resume") "继续" else "暂停", control).setOngoing(true).setOnlyAlertOnce(true).setCategory(NotificationCompat.CATEGORY_SERVICE).build()
  }
  private fun notifyState() { try { getSystemService(NotificationManager::class.java).notify(4208, notification()) } catch (_: Exception) {} }
  override fun onBind(intent: Intent?): IBinder? = null
  override fun onDestroy() {
    unsubscribe()
    steps?.stop(); voice?.stop(); motion.reset()
    if (::handler.isInitialized) { handler.removeCallbacksAndMessages(null); try { RunStore.pause(this, true) } catch (_: Exception) {}; worker.quitSafely() }
    instance = null; stopForeground(STOP_FOREGROUND_REMOVE); super.onDestroy()
  }
}
