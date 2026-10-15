package uncover.voice

import android.Manifest
import android.app.*
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.*
import java.util.UUID
import org.json.JSONObject

/** Android host only. State transitions are owned by VoiceSessionController on the main event queue. */
class BlackVoiceService : Service() {
  companion object {
    @Volatile var instance: BlackVoiceService? = null; private set
    fun start(context: Context) { context.startForegroundService(Intent(context, BlackVoiceService::class.java)) }
    fun stop(context: Context) { instance?.stopCapture(); context.stopService(Intent(context, BlackVoiceService::class.java)) }
  }
  private val handler = Handler(Looper.getMainLooper())
  private val controller = VoiceSessionController()
  private val serviceEpoch = UUID.randomUUID().toString()
  private var sequence = 0L
  private var sessionId = UUID.randomUUID().toString()
  private var engine: VoiceAudioEngine? = null
  private var speaker: VoiceSpeaker? = null
  private var lock: PowerManager.WakeLock? = null
  private var segmentId = UUID.randomUUID().toString()
  private var transcript = ""; private var spokenEnd = 0; private var speechStart = 0; private var speechEnd = 0
  private var presentationError: String? = null
  private val reference = VoiceRenderReference()
  @Volatile private var presentation = "{\"kind\":\"status\",\"sequence\":0,\"phase\":\"starting\"}"
  private var pendingWake = false; private var audioEpoch = 0
  val phase get() = controller.phase
  @Volatile var listening = false; private set
  override fun onCreate() { super.onCreate(); instance = this }
  override fun onBind(intent: Intent?): IBinder? = null
  internal fun dialogue() = presentation
  private fun event(kind: String = "status", id: String? = controller.turnId, error: String? = null) {
    val data = mutableMapOf<String, Any>("kind" to kind, "sequence" to ++sequence, "serviceEpoch" to serviceEpoch,
      "sessionId" to sessionId, "phase" to phase, "segmentId" to segmentId, "text" to transcript)
    if (id != null) data["requestId"] = id
    (error ?: presentationError)?.let { data["error"] = it }
    if (controller.output == VoiceSessionController.Output.PLAYING) {
      data["spokenEnd"] = spokenEnd; data["speechStart"] = speechStart; data["speechEnd"] = speechEnd
    }
    presentation = JSONObject(data).toString(); UncoverVoiceModule.instance?.dialogue(data)
    UncoverVoiceModule.instance?.status()
  }
  private fun publish() {
    event()
    (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).notify(718, notification())
  }
  private fun notification(): Notification {
    val stop = PendingIntent.getService(this, 719, Intent(this, BlackVoiceService::class.java).setAction("stop"), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val open = PendingIntent.getActivity(this, 718, packageManager.getLaunchIntentForPackage(packageName)!!, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    return Notification.Builder(this, "black_voice").setSmallIcon(android.R.drawable.ic_btn_speak_now).setContentTitle("BLACK 语音对话")
      .setContentText(when (phase) {
        "listening" -> "正在听你说话"; "processing" -> "正在处理你的请求"; "speaking" -> "正在回答"
        "blocked" -> "麦克风被系统静音或暂时被占用"; "starting" -> "正在准备内置语音"; else -> "本地监听 BLACK"
      }).setContentIntent(open).setOngoing(true).addAction(Notification.Action.Builder(null, "停止监听", stop).build()).build()
  }
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == "stop") { VoiceState.setEnabled(this, false); stopSelf(); return START_NOT_STICKY }
    if (!VoiceState.enabled(this) || checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) { stopSelf(); return START_NOT_STICKY }
    val notifications = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
    notifications.createNotificationChannel(NotificationChannel("black_voice", "BLACK 语音监听", NotificationManager.IMPORTANCE_LOW))
    try {
      startForeground(718, notification(), android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
      if (speaker == null) {
        VoiceState.clearError(this)
        lock = (getSystemService(POWER_SERVICE) as PowerManager).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "$packageName:BLACK-listening").apply { acquire() }
        val epoch = ++audioEpoch
        fun post(action: () -> Unit) { handler.post { if (instance === this && epoch == audioEpoch) action() } }
        speaker = VoiceSpeaker(this, reference) { start, end, completed -> speechStart = start; speechEnd = end; spokenEnd = completed; event("speech") }
        speaker!!.prepare { error ->
          if (epoch != audioEpoch || instance !== this) return@prepare
          if (error != null) { fail("local_synthesis_init", error); stopSelf(); return@prepare }
          engine = VoiceAudioEngine(this, reference, object : VoiceAudioEvents {
            override fun ready() = post {
              listening = engine?.silenced != true; controller.ready(); controller.block(!listening); publish()
              if (pendingWake && listening) { pendingWake = false; wake() }
            }
            override fun armed() = post { controller.listen(); publish() }
            override fun partial(segment: String, text: String) = post { segmentId = segment; transcript = text; event("transcript", null) }
            override fun candidate() = post {
              controller.candidate(); speaker?.duck(true); event()
              // A sound candidate never destroys the reply or leaves output suspended indefinitely.
              handler.postDelayed({ if (epoch == audioEpoch) speaker?.duck(false) }, 1200)
            }
            override fun probe(id: String, text: String, wake: Boolean, silenceMs: Long) = post {
              if (!decisionActive(id)) return@post
              try { launch(id, text, wake, "decision", silenceMs) }
              catch (error: Exception) { engine?.decide(id, "error", error.message) }
            }
            override fun accepted() = post { cancelCurrent(preserveInput = true) }
            override fun utterance(text: String, wake: Boolean) = post { request(text, wake) }
            override fun dismissed() = post { controller.dismiss(); speaker?.duck(false); event() }
            override fun assessmentError(message: String) = post { fail("turn_decision_failed", message) }
            override fun idle() = post { controller.idle(); sessionId = UUID.randomUUID().toString(); transcript = ""; speaker?.duck(false); publish() }
            override fun microphoneState(silenced: Boolean) = post {
              cancelCurrent(); listening = !silenced; controller.block(silenced)
              if (silenced) fail("microphone_silenced", "系统将麦克风静音或其他应用占用了输入。") else VoiceState.clearError(this@BlackVoiceService)
              publish()
            }
            override fun failure(error: Throwable) = post { fail("capture_or_recognition_failed", error.message ?: "本地输入失败。"); stopSelf() }
          }).also { it.start() }
        }
        publish()
      }
    } catch (error: Exception) { fail("microphone_service_failed", error.message ?: "系统未允许麦克风服务。"); stopSelf() }
    return START_STICKY
  }
  private fun launch(id: String, text: String, wake: Boolean, kind: String = "turn", silenceMs: Long = 0) {
    startService(Intent(this, VoiceAgentTaskService::class.java).putExtra("requestId", id).putExtra("sessionId", sessionId)
      .putExtra("serviceEpoch", serviceEpoch).putExtra("text", text).putExtra("kind", kind).putExtra("wake", wake).putExtra("silenceMs", silenceMs))
  }
  internal fun wake() {
    if (!VoiceState.enabled(this)) return
    if (!listening) { pendingWake = true; return }
    engine?.arm(); controller.listen(); publish()
  }
  internal fun decisionActive(id: String) = listening && engine?.decisionActive(id) == true && VoiceState.enabled(this)
  internal fun decide(id: String, action: String, error: String?) { engine?.decide(id, action, error) }
  private fun cancelCurrent(id: String? = null, preserveInput: Boolean = false) {
    val cancelled = controller.cancel(id) ?: return
    speaker?.stop(); event("interrupt", cancelled)
    if (!preserveInput) engine?.listenAgain()
    publish()
  }
  internal fun cancel(id: String?) { cancelCurrent(id) }
  private fun request(text: String, woke: Boolean) {
    if (!listening || controller.stopped) return
    presentationError = null; VoiceState.clearError(this)
    val id = "voice-" + UUID.randomUUID(); controller.begin(id)
    spokenEnd = 0; transcript = text; event("transcript", id); publish(); engine?.beginReply()
    try { launch(id, text, woke) }
    catch (error: Exception) { controller.cancel(id); fail("agent_start_failed", error.message ?: "后台 Agent 未启动。"); engine?.afterReply(); publish() }
  }
  internal fun active(id: String) = listening && controller.active(id) && VoiceState.enabled(this)
  internal fun reply(id: String, text: String) {
    if (!active(id)) return
    val token = controller.generation
    if (text.isBlank()) { controller.complete(id, token); engine?.afterReply(); transcript = ""; publish(); return }
    if (!controller.play(id)) return
    transcript = ""; publish()
    runCatching { speaker!!.speak(text) { error ->
      if (controller.turnId != id || controller.generation != token) return@speak
      if (error != null) { event("playback_error", id, error); fail("local_output_failed", error) }
      controller.complete(id, token); engine?.afterReply(); publish()
    } }.onFailure { controller.complete(id, token); event("playback_error", id, it.message); fail("local_output_failed", it.message ?: "本地输出失败。"); engine?.afterReply(); publish() }
  }
  private fun fail(code: String, message: String) { presentationError = message; VoiceState.error(this, code, message); event(error = message) }
  private fun stopCapture() { audioEpoch++; listening = false; pendingWake = false; engine?.stop() }
  override fun onDestroy() {
    cancelCurrent(); stopCapture(); controller.stop(); event()
    engine = null; speaker?.close(); speaker = null; reference.clear()
    lock?.let { if (it.isHeld) it.release() }; lock = null
    if (instance === this) instance = null
    UncoverVoiceModule.instance?.status(); super.onDestroy()
  }
}
