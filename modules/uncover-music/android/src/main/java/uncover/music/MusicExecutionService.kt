package uncover.music

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.content.ContextCompat

/** Keeps only the current user-initiated model music request alive across app switches.
 * Foreground notification here is a service lifecycle requirement, not a visible music window.
 */
class MusicExecutionService : Service() {
  companion object {
    private const val CHANNEL = "uncover_music_agent"
    private const val ID = 4301
    @Volatile var instance: MusicExecutionService? = null; private set
    var onCancelled: ((String) -> Unit)? = null
    fun start(context: Context, executionId: String) {
      val intent = Intent(context, MusicExecutionService::class.java).putExtra("executionId", executionId)
      ContextCompat.startForegroundService(context, intent)
    }
    fun finish(executionId: String) { if (instance?.executionId == executionId) instance?.stopSelf() }
    fun cancelActive() { instance?.cancelExecution() }
  }
  private var executionId = ""
  private fun cancelExecution() {
    if (executionId.isNotBlank()) {
      MusicLedger.cancel(executionId)
      onCancelled?.invoke(executionId)
    }
    stopSelf()
  }
  override fun onCreate() { super.onCreate(); instance = this }
  override fun onBind(intent: Intent?): IBinder? = null
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == "cancel") {
      val cancelledId = intent.getStringExtra("executionId").orEmpty()
      MusicLedger.cancel(cancelledId)
      onCancelled?.invoke(cancelledId)
      if (cancelledId == executionId) stopSelf()
      return START_NOT_STICKY
    }
    executionId = intent?.getStringExtra("executionId").orEmpty()
    if (executionId.isBlank() || MusicLedger.isCancelled(executionId)) { stopSelf(); return START_NOT_STICKY }
    val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(NotificationChannel(CHANNEL, "AI 音乐操作", NotificationManager.IMPORTANCE_LOW))
    val open = PendingIntent.getActivity(this, 0, packageManager.getLaunchIntentForPackage(packageName), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val cancel = PendingIntent.getService(this, 4301, Intent(this, MusicExecutionService::class.java).setAction("cancel").putExtra("executionId", executionId), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CHANNEL) else Notification.Builder(this)
    val notification = builder.setSmallIcon(applicationInfo.icon).setContentTitle("AI 正在处理音乐请求")
      .setContentText("只操作你选择的音乐软件；可随时取消。")
      .setContentIntent(open).addAction(Notification.Action.Builder(null, "取消点歌", cancel).build()).setOngoing(true).build()
    startForeground(ID, notification)
    return START_NOT_STICKY
  }
  override fun onTaskRemoved(rootIntent: Intent?) { cancelExecution() }
  override fun onDestroy() { stopForeground(STOP_FOREGROUND_REMOVE); if (instance === this) instance = null; super.onDestroy() }
}
