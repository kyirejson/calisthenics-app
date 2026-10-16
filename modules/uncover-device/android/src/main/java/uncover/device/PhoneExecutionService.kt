package uncover.device

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

/** Lives only for a user-requested task, not an always-on phone surveillance service. */
class PhoneExecutionService : Service() {
  companion object {
    private const val ID = 4302
    private const val CHANNEL = "max_phone_tasks"
    @Volatile var instance: PhoneExecutionService? = null; private set
    @Volatile var onCancelled: ((String) -> Unit)? = null
    fun start(context: Context, id: String) { ContextCompat.startForegroundService(context, Intent(context, PhoneExecutionService::class.java).putExtra("executionId", id)) }
    fun finish(id: String) { if (instance?.executionId == id) instance?.stopSelf() }
    fun cancelActive() { instance?.cancelExecution() }
  }
  private var executionId = ""
  private fun cancelExecution() {
    if (executionId.isNotBlank()) { PhoneLedger.cancel(executionId); onCancelled?.invoke(executionId) }
    PhoneAccessibilityService.instance?.phoneUi?.clear(); stopSelf()
  }
  override fun onCreate() { super.onCreate(); instance = this }
  override fun onBind(intent: Intent?): IBinder? = null
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == "cancel") {
      val id = intent.getStringExtra("executionId").orEmpty()
      if (id == executionId) cancelExecution()
      else if (id.isNotBlank()) { PhoneLedger.cancel(id); onCancelled?.invoke(id) }
      return START_NOT_STICKY
    }
    val next = intent?.getStringExtra("executionId").orEmpty()
    if (executionId.isNotBlank() && next != executionId) { PhoneLedger.cancel(executionId); onCancelled?.invoke(executionId) }
    executionId = next
    if (next.isBlank() || PhoneLedger.isCancelled(next) || !PhoneLedger.enabled(this)) { stopSelf(); return START_NOT_STICKY }
    val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(NotificationChannel(CHANNEL, "MAX 手机操作", NotificationManager.IMPORTANCE_LOW))
    val cancel = PendingIntent.getService(this, ID, Intent(this, PhoneExecutionService::class.java).setAction("cancel").putExtra("executionId", next), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val open = PendingIntent.getActivity(this, ID, packageManager.getLaunchIntentForPackage(packageName), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CHANNEL) else Notification.Builder(this)
    startForeground(ID, builder.setSmallIcon(R.drawable.max_phone_notification).setContentTitle("MAX 正在操作手机")
      .setContentText("正在处理你提出的任务；可随时停止，操作结果会回读核对。")
      .setContentIntent(open).setOngoing(true).addAction(Notification.Action.Builder(null, "停止操作", cancel).build()).build())
    return START_NOT_STICKY
  }
  override fun onTaskRemoved(rootIntent: Intent?) { cancelExecution() }
  override fun onDestroy() { stopForeground(STOP_FOREGROUND_REMOVE); if (instance === this) instance = null; super.onDestroy() }
}
