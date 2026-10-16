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
  private val controller = VoiceSessionController(SystemClock::elapsedRealtime)
  private val serviceEpoch = UUID.randomUUID().toString()
  private var sequence = 0L
  private var sessionId = UUID.randomUUID().toString()
  private var engine: VoiceAudioEngine? = null
  private var speaker: VoiceSpeaker? = null
  private var lock: PowerManager.WakeLock? = null
  private var spokenEnd = 0; private var speechStart = 0; private var speechEnd = 0
  private var presentationError: String? = null
  private val reference = VoiceRenderReference()
  @Volatile private var presentation = "{\"kind\":\"status\",\"sequence\":0,\"phase\":\"starting\"}"
  private var pendingWake = false; private var audioEpoch = 0
  val phase get() = controller.phase
  val captureAvailable get() = controller.captureAvailable
  internal val snapshot get() = controller.snapshot
  private val pulse = object : Runnable {
    override fun run() {
      if (instance !== this@BlackVoiceService) return
      when (controller.tick()) {
        VoiceSessionController.Tick.IDLE -> enterStandby()
        VoiceSessionController.Tick.RESUME -> publish()
        else -> Unit
      }
      handler.postDelayed(this, 250)
    }
  }
  override fun onCreate() { super.onCreate(); instance = this; handler.post(pulse) }
  override fun onBind(intent: Intent?): IBinder? = null
  internal fun dialogue() = presentation
  private fun event(kind: String = "status", id: String? = controller.turnId, error: String? = null, text: String? = null, decisionId: String? = null) {
    val state = controller.snapshot
    val data = mutableMapOf<String, Any>("kind" to kind, "sequence" to ++sequence, "serviceEpoch" to serviceEpoch,
      "sessionId" to sessionId, "phase" to state.phase, "segmentId" to (state.segmentId ?: ""), "text" to (text ?: state.draft),
      "input" to state.input.name.lowercase(), "output" to state.output.name.lowercase(), "held" to state.held)
    if (id != null) data["requestId"] = id
    if (decisionId != null) data["decisionId"] = decisionId
    (error ?: presentationError)?.let { data["error"] = it }
    if (controller.turnId != null) {
      data["spokenEnd"] = spokenEnd; data["speechStart"] = speechStart; data["speechEnd"] = speechEnd
    }
    presentation = JSONObject(data).toString(); UncoverVoiceModule.instance?.dialogue(data)
    UncoverVoiceModule.instance?.status()
  }
  private fun syncOutput() {
    speaker?.hold(controller.snapshot.held)
  }
  private fun publish() {
    syncOutput()
    event()
    (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).notify(718, notification())
  }
  private fun enterStandby() {
    engine?.idle(); sessionId = UUID.randomUUID().toString(); publish()
  }
  private fun notification(): Notification {
    val stop = PendingIntent.getService(this, 719, Intent(this, BlackVoiceService::class.java).setAction("stop"), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val open = PendingIntent.getActivity(this, 718, packageManager.getLaunchIntentForPackage(packageName)!!, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    return Notification.Builder(this, "black_voice").setSmallIcon(android.R.drawable.ic_btn_speak_now).setContentTitle("${VoiceBrand.NAME} 语音对话")
      .setContentText(when (phase) {
        "listening" -> "正在听你说话"; "assessing" -> "正在确认你的意思"; "processing" -> "正在处理你的请求"; "speaking" -> "正在回答"
        "synthesizing" -> "正在准备语音"; "buffering" -> "正在准备后续语音"
        "blocked" -> "麦克风被系统静音或暂时被占用"; "starting" -> "正在准备内置语音"; else -> "本地监听 ${VoiceBrand.NAME}"
      }).setContentIntent(open).setOngoing(true).addAction(Notification.Action.Builder(null, "停止监听", stop).build()).build()
  }
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == "stop") { VoiceState.setEnabled(this, false); stopSelf(); return START_NOT_STICKY }
    if (!VoiceState.enabled(this) || checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) { stopSelf(); return START_NOT_STICKY }
    val notifications = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
    notifications.createNotificationChannel(NotificationChannel("black_voice", "${VoiceBrand.NAME} 语音监听", NotificationManager.IMPORTANCE_LOW))
    try {
      startForeground(718, notification(), android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
      if (speaker == null) {
        VoiceState.clearError(this)
        lock = (getSystemService(POWER_SERVICE) as PowerManager).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "$packageName:MAX-listening").apply { acquire() }
        val epoch = ++audioEpoch
        fun post(action: () -> Unit) { handler.post { if (instance === this && epoch == audioEpoch) action() } }
        speaker = VoiceSpeaker(this, reference) { start, end, completed -> speechStart = start; speechEnd = end; spokenEnd = completed; event("speech") }
        speaker!!.prepare { error ->
          if (epoch != audioEpoch || instance !== this) return@prepare
          if (error != null) { fail("local_synthesis_init", error); stopSelf(); return@prepare }
          engine = VoiceAudioEngine(this, reference, object : VoiceAudioEvents {
            override fun ready() = post {
              controller.ready(); if (engine?.silenced == true) controller.block(true); publish()
              if (pendingWake && captureAvailable) { pendingWake = false; wake() }
            }
            override fun armed(segment: String) = post { controller.listen(segment); publish() }
            override fun partial(segment: String, text: String) = post {
              if (controller.partial(segment, text)) event("transcript", null)
            }
            override fun candidate(segment: String) = post { controller.candidate(segment); publish() }
            override fun hearing(segment: String, referenceEpoch: Long) = post {
              if (reference.isCurrent(referenceEpoch) && controller.hearing(segment)) publish()
            }
            override fun probe(segment: String, id: String, text: String, wake: Boolean, silenceMs: Long) = post {
              if (!decisionActive(id) || !controller.assessing(segment)) return@post
              publish()
              try { launch(id, text, wake, "decision", silenceMs) }
              catch (error: Exception) { engine?.decide(id, "error", error.message) }
            }
            override fun revoked(id: String) = post { event("decision_cancelled", decisionId = id) }
            override fun utterance(segment: String, text: String, wake: Boolean) = post {
              if (controller.accepts(segment)) request(text, wake)
            }
            override fun settled(segment: String, action: String) = post { if (controller.settle(segment, action)) publish() }
            override fun assessmentError(message: String) = post { fail("turn_decision_failed", message) }
            override fun microphoneState(silenced: Boolean) = post {
              controller.block(silenced)?.let(::stopCancelledOutput); engine?.arm()
              if (silenced) fail("microphone_silenced", "系统将麦克风静音或其他应用占用了输入。")
              else { presentationError = null; VoiceState.clearError(this@BlackVoiceService) }
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
    if (!captureAvailable) { pendingWake = true; return }
    cancelCurrent()
    engine?.arm(); controller.listen(); publish()
  }
  internal fun decisionActive(id: String) = captureAvailable && engine?.decisionActive(id) == true && VoiceState.enabled(this)
  internal fun decide(id: String, action: String, error: String?) { engine?.decide(id, action, error) }
  private fun cancelCurrent(id: String? = null, preserveInput: Boolean = false) {
    val cancelled = controller.cancel(id, preserveInput) ?: return
    stopCancelledOutput(cancelled)
    if (!preserveInput) engine?.arm()
    publish()
  }
  private fun stopCancelledOutput(id: String) { speaker?.stop(); event("interrupt", id) }
  internal fun cancel(id: String?) { cancelCurrent(id) }
  internal fun standby(id: String): Boolean {
    if (!VoiceState.enabled(this) || !controller.standby(id)) { publish(); return false }
    speaker?.stop(); enterStandby(); return true
  }
  private fun request(text: String, woke: Boolean) {
    if (!captureAvailable) return
    cancelCurrent(preserveInput = true)
    presentationError = null; VoiceState.clearError(this)
    val id = "voice-" + UUID.randomUUID(); controller.begin(id)
    spokenEnd = 0; speechStart = 0; speechEnd = 0; event("transcript", id, text = text); publish()
    try { launch(id, text, woke) }
    catch (error: Exception) { controller.cancel(id); fail("agent_start_failed", error.message ?: "后台 Agent 未启动。"); publish() }
  }
  internal fun active(id: String) = controller.active(id) && VoiceState.enabled(this)
  internal fun reply(id: String, text: String) {
    if (!active(id)) return
    val token = controller.generation
    if (text.isBlank()) { controller.complete(id, token); publish(); return }
    if (!controller.prepare(id)) return
    publish()
    runCatching { speaker!!.speak(text, playback = { playing ->
      if (controller.render(id, token, playing)) publish()
    }) { error ->
      if (controller.turnId != id || controller.generation != token) return@speak
      if (error != null) { event("playback_error", id, error); fail("local_output_failed", error) }
      controller.complete(id, token); publish()
    }; syncOutput() }.onFailure { controller.complete(id, token); event("playback_error", id, it.message); fail("local_output_failed", it.message ?: "本地输出失败。"); publish() }
  }
  private fun fail(code: String, message: String) { presentationError = message; VoiceState.error(this, code, message); event(error = message) }
  private fun stopCapture() { audioEpoch++; pendingWake = false; engine?.stop() }
  override fun onDestroy() {
    handler.removeCallbacks(pulse)
    cancelCurrent(); stopCapture(); controller.stop(); event()
    engine = null; speaker?.close(); speaker = null; reference.clear()
    lock?.let { if (it.isHeld) it.release() }; lock = null
    if (instance === this) instance = null
    UncoverVoiceModule.instance?.status(); super.onDestroy()
  }
}
