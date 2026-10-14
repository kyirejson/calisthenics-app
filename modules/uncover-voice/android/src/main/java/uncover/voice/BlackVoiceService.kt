package uncover.voice

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import java.util.UUID

class BlackVoiceService : Service() {
  companion object {
    @Volatile var instance: BlackVoiceService? = null; private set
    fun start(context: Context) { context.startForegroundService(Intent(context, BlackVoiceService::class.java)) }
    fun stop(context: Context) { context.stopService(Intent(context, BlackVoiceService::class.java)) }
  }
  private val handler = Handler(Looper.getMainLooper())
  private var engine: VoiceAudioEngine? = null
  private var speaker: VoiceSpeaker? = null
  private var lock: PowerManager.WakeLock? = null
  private var requestId: String? = null
  private var sessionId = UUID.randomUUID().toString()
  private var generation = 0
  private var pendingWake = false
  @Volatile var phase = "starting"; private set
  @Volatile var listening = false; private set
  override fun onCreate() { super.onCreate(); instance = this }
  override fun onBind(intent: Intent?): IBinder? = null
  private fun notifyState(value: String) {
    phase = value; UncoverVoiceModule.instance?.status()
    (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).notify(718, notification())
  }
  private fun notification(): Notification {
    val stop = PendingIntent.getService(this, 719, Intent(this, BlackVoiceService::class.java).setAction("stop"), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val app = packageManager.getLaunchIntentForPackage(packageName)!!
    val open = PendingIntent.getActivity(this, 718, app, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    return Notification.Builder(this, "black_voice").setSmallIcon(android.R.drawable.ic_btn_speak_now).setContentTitle("BLACK 语音唤醒")
      .setContentText(when (phase) { "listening" -> "我在 · 正在听你说话"; "processing" -> "正在处理你的请求"; "speaking" -> "正在回答"; "blocked" -> "麦克风被系统静音或暂时被其他应用占用"; "starting" -> "正在准备本地语音模型"; else -> "本地监听 BLACK，可锁屏使用" })
      .setContentIntent(open).setOngoing(true).addAction(Notification.Action.Builder(null, "停止监听", stop).build()).build()
  }
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == "stop") { VoiceState.setEnabled(this, false); stopSelf(); return START_NOT_STICKY }
    if (!VoiceState.enabled(this) || checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) { stopSelf(); return START_NOT_STICKY }
    val notifications = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
    notifications.createNotificationChannel(NotificationChannel("black_voice", "BLACK 语音监听", NotificationManager.IMPORTANCE_LOW))
    try {
      startForeground(718, notification(), android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
      if (engine == null) {
        VoiceState.clearError(this)
        lock = (getSystemService(POWER_SERVICE) as PowerManager).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "$packageName:BLACK-listening").apply { acquire() }
        speaker = VoiceSpeaker(this)
        engine = VoiceAudioEngine(this,
          { handler.post { if (instance === this && VoiceState.enabled(this)) { listening = engine?.silenced != true; notifyState(if (listening) "wake" else "blocked"); if (pendingWake && listening) { pendingWake = false; wake() } } } },
          { handler.post { if (instance === this) wake() } },
          { text -> handler.post { if (instance === this) request(text) } },
          { handler.post { if (instance === this) { sessionId = UUID.randomUUID().toString(); notifyState("wake") } } },
          { silenced -> handler.post { if (instance === this) {
            generation++; requestId = null; speaker?.stop(); listening = !silenced; engine?.mode = "wake"
            if (silenced) fail("microphone_silenced", "系统将麦克风静音或其他应用占用了录音输入；解除限制后自动恢复监听。") else VoiceState.clearError(this)
            notifyState(if (silenced) "blocked" else "wake")
          } } },
          { error -> handler.post { if (instance === this) { fail("audio_failed", error.message ?: "本地语音引擎失败。"); stopSelf() } } }).also { it.start() }
        notifyState("starting")
      }
    } catch (error: Exception) { fail("microphone_service_failed", error.message ?: "系统未允许后台麦克风服务。"); stopSelf() }
    return START_STICKY // System recovery only; no restart alarms or permission bypass.
  }
  internal fun wake() {
    if (!VoiceState.enabled(this)) return
    if (!listening) { pendingWake = true; return }
    val token = ++generation
    requestId = null
    engine?.mode = "speaking"; notifyState("speaking")
    runCatching { speaker?.acknowledge { error ->
      if (!listening || generation != token) return@acknowledge
      if (error != null) fail("acknowledgement_failed", error)
      engine?.mode = "listening"; notifyState("listening")
    } }.onFailure { fail("speaker_failed", it.message ?: "系统未允许语音回应。"); engine?.mode = "listening"; notifyState("listening") }
  }
  private fun request(text: String) {
    if (!listening) return
    val id = "voice-${UUID.randomUUID()}"; requestId = id
    engine?.mode = "processing"; notifyState("processing")
    try { startService(Intent(this, VoiceAgentTaskService::class.java).putExtra("requestId", id).putExtra("sessionId", sessionId).putExtra("text", text)) }
    catch (error: Exception) { fail("agent_start_failed", error.message ?: "后台 Agent 未能启动。"); engine?.mode = "listening"; notifyState("listening") }
  }
  internal fun active(id: String) = listening && requestId == id && engine?.mode == "processing" && VoiceState.enabled(this)
  internal fun reply(id: String, text: String) {
    if (!active(id)) return
    val token = ++generation
    requestId = null; engine?.mode = "speaking"; notifyState("speaking")
    runCatching { speaker?.speak(text) { error ->
      if (!listening || generation != token) return@speak
      if (error != null) fail("speech_failed", error)
      engine?.mode = "listening"; notifyState("listening")
    } }.onFailure { fail("speech_failed", it.message ?: "语音回答未能播放。"); engine?.mode = "listening"; notifyState("listening") }
  }
  private fun fail(code: String, message: String) { VoiceState.error(this, code, message) }
  override fun onDestroy() {
    generation++; listening = false; pendingWake = false; requestId = null; phase = "stopped"
    engine?.stop(); engine = null; speaker?.close(); speaker = null
    lock?.let { if (it.isHeld) it.release() }; lock = null
    if (instance === this) instance = null
    UncoverVoiceModule.instance?.status(); super.onDestroy()
  }
}
