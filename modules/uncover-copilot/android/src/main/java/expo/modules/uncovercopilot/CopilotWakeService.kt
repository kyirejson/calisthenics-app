package expo.modules.uncovercopilot

import ai.picovoice.porcupine.PorcupineManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.graphics.PixelFormat
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button

/** Opt-in, single detection session. No boot receiver, sticky restart, raw audio
 * storage or invisible background launch. Detection releases the microphone. */
class CopilotWakeService : Service() {
  companion object {
    @Volatile var running = false
    @Volatile var lastError = ""
    private var current: CopilotWakeService? = null
    fun stopListening() { current?.releaseMic(); current?.stopSelf() }
    private const val CHANNEL = "copilot-wake"
    private const val ID = 4011
  }
  private var manager: PorcupineManager? = null
  private var overlay: Button? = null
  private val main = Handler(Looper.getMainLooper())
  override fun onBind(intent: Intent?): IBinder? = null
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    current = this
    if (intent?.action == "stop") { stopSelf(); return START_NOT_STICKY }
    if (manager != null) return START_NOT_STICKY
    try {
      val notifications = getSystemService(NotificationManager::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) notifications.createNotificationChannel(NotificationChannel(CHANNEL, "个人助手唤醒", NotificationManager.IMPORTANCE_LOW))
      startForeground(ID, notification("正在本机监听唤醒词 · 可随时停止"))
      val key = intent?.getStringExtra("accessKey") ?: throw IllegalArgumentException("Missing AccessKey")
      intent?.removeExtra("accessKey")
      manager = PorcupineManager.Builder().setAccessKey(key)
        .setKeywordPath("uncover-wake.ppn").setModelPath("porcupine_params_zh.pv")
        .setSensitivity(0.5f).setErrorCallback { main.post { fail() } }
        .build(applicationContext) { main.post { detected() } }
      manager?.start()
      running = true
    } catch (_: Exception) { fail() }
    return START_NOT_STICKY
  }
  private fun launchIntent(): Intent = (packageManager.getLaunchIntentForPackage(packageName) ?: Intent())
    .setAction(Intent.ACTION_VIEW).setData(Uri.parse("uncover://assistant"))
    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
  private fun notification(text: String): Notification {
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(this, CHANNEL) else Notification.Builder(this)
    val open = PendingIntent.getActivity(this, 0, launchIntent(), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val stop = PendingIntent.getService(this, 1, Intent(this, CopilotWakeService::class.java).setAction("stop"), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    return builder.setContentTitle("Uncover 个人助手").setContentText(text).setSmallIcon(android.R.drawable.ic_btn_speak_now)
      .setContentIntent(open).setOngoing(true).addAction(Notification.Action.Builder(null, "停止", stop).build()).build()
  }
  private fun releaseMic() {
    running = false
    val active = manager; manager = null
    try { active?.stop() } catch (_: Exception) { }
    try { active?.delete() } catch (_: Exception) { }
  }
  private fun detected() {
    releaseMic()
    getSystemService(NotificationManager::class.java).notify(ID, notification("检测到唤醒词，点击打开；麦克风已释放"))
    if (Settings.canDrawOverlays(this)) {
      try {
        val button = Button(this).apply {
          text = "打开个人助手"
          setOnClickListener { startActivity(launchIntent()); stopSelf() }
        }
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY else WindowManager.LayoutParams.TYPE_PHONE
        val params = WindowManager.LayoutParams(WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT, type, WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE, PixelFormat.TRANSLUCENT)
        params.gravity = Gravity.END or Gravity.CENTER_VERTICAL
        getSystemService(WindowManager::class.java).addView(button, params); overlay = button
      } catch (_: Exception) { lastError = "悬浮入口被系统拒绝，请从通知栏打开助手" }
    }
    main.postDelayed({ stopSelf() }, 60000)
  }
  private fun fail() {
    // Do not include SDK errors that can contain keys, tokens or device identifiers.
    lastError = "唤醒引擎未启动或已停止：请核对 AccessKey、模型版本和系统权限"
    stopSelf()
  }
  override fun onDestroy() {
    if (current === this) current = null
    main.removeCallbacksAndMessages(null)
    releaseMic()
    overlay?.let { try { getSystemService(WindowManager::class.java).removeView(it) } catch (_: Exception) { } }
    overlay = null
    stopForeground(STOP_FOREGROUND_REMOVE)
    super.onDestroy()
  }
}
