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
import java.util.concurrent.atomic.AtomicLong
import org.json.JSONObject

class BlackVoiceService : Service() {
  companion object {
    private val sequence = AtomicLong(0)
    @Volatile var instance: BlackVoiceService? = null; private set
    fun start(context: Context) { context.startForegroundService(Intent(context, BlackVoiceService::class.java)) }
    fun stop(context: Context) {
      // Invalidate consent synchronously, before Android schedules onDestroy.
      VoiceOwnerStore(context).cancelEnrollment()
      instance?.stopCapture()
      context.stopService(Intent(context, BlackVoiceService::class.java))
    }
  }
  private val handler = Handler(Looper.getMainLooper())
  private var engine: VoiceAudioEngine? = null
  private var speaker: VoiceSpeaker? = null
  private var lock: PowerManager.WakeLock? = null
  private var requestId: String? = null
  private var replyId: String? = null
  private var segmentId = UUID.randomUUID().toString()
  private var transcript = ""
  private var spokenEnd = 0
  private var speechStart = 0
  private var speechEnd = 0
  private var presentationError: String? = null
  private val reference = VoiceRenderReference()
  @Volatile private var presentation = "{\"kind\":\"status\",\"sequence\":0,\"phase\":\"stopped\"}"
  private var sessionId = UUID.randomUUID().toString()
  private var generation = 0
  private var pendingWake = false
  private var candidatePending = false
  private var audioEpoch = 0
  @Volatile var enrolling = false; private set
  @Volatile var phase = "starting"; private set
  @Volatile var listening = false; private set
  override fun onCreate() { super.onCreate(); instance = this }
  override fun onBind(intent: Intent?): IBinder? = null
  private fun notifyState(value: String) {
    phase = value; UncoverVoiceModule.instance?.status()
    event("status")
    (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).notify(718, notification())
  }
  internal fun dialogue() = presentation
  private fun event(kind: String, id: String? = requestId ?: replyId, error: String? = null) {
    val data = mutableMapOf<String, Any>("kind" to kind, "sequence" to sequence.incrementAndGet(), "phase" to if (candidatePending) "listening" else phase,
      "segmentId" to segmentId, "text" to transcript)
    if (id != null) data["requestId"] = id
    (error ?: presentationError)?.let { data["error"] = it }
    if (replyId != null) { data["spokenEnd"] = spokenEnd; data["speechStart"] = speechStart; data["speechEnd"] = speechEnd }
    presentation = JSONObject(data).toString(); UncoverVoiceModule.instance?.dialogue(data)
  }
  private fun notification(): Notification {
    val stop = PendingIntent.getService(this, 719, Intent(this, BlackVoiceService::class.java).setAction("stop"), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val app = packageManager.getLaunchIntentForPackage(packageName)!!
    val open = PendingIntent.getActivity(this, 718, app, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    return Notification.Builder(this, "black_voice").setSmallIcon(android.R.drawable.ic_btn_speak_now).setContentTitle("BLACK 语音唤醒")
      .setContentText(when (phase) { "enrolling" -> "正在本机登记声音，请按 App 提示朗读"; "verifying" -> "正在确认主人声音"; "listening" -> "正在听你说话"; "processing" -> "正在处理你的请求"; "speaking" -> "正在回答，可直接说话打断"; "blocked" -> "麦克风被系统静音或暂时被其他应用占用"; "starting" -> "正在准备本地语音模型"; else -> "本地监听 BLACK，可锁屏使用" })
      .setContentIntent(open).setOngoing(true).addAction(Notification.Action.Builder(null, "停止监听", stop).build()).build()
  }
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == "stop") { VoiceState.setEnabled(this, false); stopSelf(); return START_NOT_STICKY }
    val enrollmentMode = intent?.action == "enroll"
    val enrollmentTicket = if (enrollmentMode) intent?.getLongExtra("enrollmentTicket", -1) else null
    if (enrollmentMode && (enrollmentTicket == null || !VoiceOwnerStore(this).enrollmentActive(enrollmentTicket))) { stopSelf(); return START_NOT_STICKY }
    if ((!VoiceState.enabled(this) && !enrollmentMode) || checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) { stopSelf(); return START_NOT_STICKY }
    val notifications = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
    notifications.createNotificationChannel(NotificationChannel("black_voice", "BLACK 语音监听", NotificationManager.IMPORTANCE_LOW))
    try {
      startForeground(718, notification(), android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
      if (engine == null) {
        VoiceState.clearError(this)
        enrolling = enrollmentMode
        lock = (getSystemService(POWER_SERVICE) as PowerManager).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "$packageName:BLACK-listening").apply { acquire() }
        if (!enrollmentMode) speaker = VoiceSpeaker(this, reference) { start, end, completed ->
          speechStart = start; speechEnd = end; spokenEnd = completed; event("speech")
        }
        val epoch = ++audioEpoch
        fun post(action: () -> Unit) { handler.post { if (instance === this && audioEpoch == epoch) action() } }
        engine = VoiceAudioEngine(this, reference, enrollmentTicket, object : VoiceAudioEvents {
          override fun ready() = post {
            listening = !enrolling && engine?.silenced != true
            notifyState(if (enrolling) "enrolling" else if (listening) "wake" else "blocked")
            if (pendingWake && listening) { pendingWake = false; wake() }
          }
          override fun armed() = post { if (phase == "wake") notifyState("verifying") }
          override fun partial(segment: String, text: String) = post { segmentId = segment; transcript = text; event("transcript", null) }
          override fun candidate() = post { candidatePending = true; speaker?.pause(); event("status") }
          override fun probe(id: String, text: String, wake: Boolean, silenceMs: Long) = post {
            if (engine?.decisionActive(id) != true) return@post
            try { startService(Intent(this@BlackVoiceService, VoiceAgentTaskService::class.java).putExtra("requestId", id).putExtra("sessionId", sessionId)
              .putExtra("text", text).putExtra("kind", "decision").putExtra("wake", wake).putExtra("silenceMs", silenceMs)) }
            catch (error: Exception) { engine?.decide(id, "error", error.message ?: "语义判断未能启动。") }
          }
          override fun accepted() = post { interrupt(preserveSpeech = true) }
          override fun utterance(text: String, wake: Boolean) = post { request(text, wake) }
          override fun dismissed() = post { candidatePending = false; speaker?.resume(); event("status") }
          override fun assessmentError(message: String) = post { fail("turn_decision_failed", message) }
          override fun enrollment(progress: Int, stage: String, complete: Boolean, error: String?) = post {
            VoiceState.enrollmentProgress = progress; VoiceState.enrollmentStage = stage; UncoverVoiceModule.instance?.status()
            if (complete || error != null) { if (error != null) fail("enrollment_failed", error); stopSelf() }
          }
          override fun idle() = post { candidatePending = false; speaker?.resume(); sessionId = UUID.randomUUID().toString(); transcript = ""; notifyState("wake") }
          override fun microphoneState(silenced: Boolean) = post {
            interrupt(); listening = !silenced; engine?.mode = "wake"
            if (silenced) fail("microphone_silenced", "系统将麦克风静音或其他应用占用了录音输入；解除限制后自动恢复监听。") else VoiceState.clearError(this@BlackVoiceService)
            notifyState(if (silenced) "blocked" else "wake")
          }
          override fun failure(error: Throwable) = post { fail("audio_failed", error.message ?: "本地语音引擎失败。"); stopSelf() }
        }).also { it.start() }
        notifyState("starting")
      }
    } catch (error: Exception) { fail("microphone_service_failed", error.message ?: "系统未允许后台麦克风服务。"); stopSelf() }
    return START_STICKY // System recovery only; no restart alarms or permission bypass.
  }
  internal fun wake() {
    if (!VoiceState.enabled(this)) return
    if (!listening) { pendingWake = true; return }
    // A system-assistant button arms capture; it never bypasses owner verification.
    engine?.arm(); notifyState("verifying")
  }
  internal fun decisionActive(id: String) = listening && engine?.decisionActive(id) == true && VoiceState.enabled(this)
  internal fun decide(id: String, action: String, error: String?) { engine?.decide(id, action, error) }
  private fun interrupt(preserveSpeech: Boolean = false) {
    val interrupted = requestId ?: replyId
    ++generation
    // Invalidate before stopping audio or sending JS events: no stale headless result can start speaking.
    requestId = null; speaker?.stop(); phase = "listening"; candidatePending = false
    event("interrupt", interrupted)
    replyId = null; spokenEnd = 0; speechStart = 0; speechEnd = 0
    segmentId = UUID.randomUUID().toString(); transcript = ""
    if (!preserveSpeech) engine?.listenAgain()
    notifyState("listening")
  }
  internal fun cancel(id: String?) {
    if (id != null && id != requestId && id != replyId) return
    presentationError = null; VoiceState.clearError(this)
    interrupt(preserveSpeech = engine?.mode == "listening" && phase != "listening")
  }
  private fun request(text: String, woke: Boolean = false) {
    if (!listening || engine?.mode != "processing") return
    presentationError = null; VoiceState.clearError(this)
    val id = "voice-${UUID.randomUUID()}"; requestId = id
    transcript = text; replyId = null
    event("transcript")
    engine?.mode = "processing"; notifyState("processing")
    try { startService(Intent(this, VoiceAgentTaskService::class.java).putExtra("requestId", id).putExtra("sessionId", sessionId).putExtra("text", text).putExtra("wake", woke)) }
    catch (error: Exception) { fail("agent_start_failed", error.message ?: "后台 Agent 未能启动。"); engine?.afterReply(); notifyState("listening") }
  }
  internal fun active(id: String) = listening && requestId == id && engine?.mode == "processing" && VoiceState.enabled(this)
  internal fun reply(id: String, text: String) {
    if (!active(id)) return
    if (text.isBlank()) {
      // An explicit model continue_listening tool result. No TTS, canned response or error.
      requestId = null; replyId = null; transcript = ""; segmentId = UUID.randomUUID().toString()
      engine?.afterReply(); notifyState("listening"); return
    }
    val token = ++generation
    requestId = null; replyId = id; spokenEnd = 0; speechStart = 0; speechEnd = 0
    transcript = ""; engine?.mode = "speaking"; notifyState("speaking")
    runCatching { speaker?.speak(text) { error ->
      if (!listening || generation != token) return@speak
      if (error != null) { event("playback_error", id, error); fail("speech_failed", error) }
      replyId = null; segmentId = UUID.randomUUID().toString()
      engine?.afterReply(); notifyState("listening")
    } }.onFailure { event("playback_error", id, it.message ?: "语音回答未能播放。"); fail("speech_failed", it.message ?: "语音回答未能播放。"); replyId = null; engine?.afterReply(); notifyState("listening") }
    if (candidatePending) speaker?.pause()
  }
  private fun fail(code: String, message: String) { presentationError = message; VoiceState.error(this, code, message); event("status", error = message) }
  private fun stopCapture() { audioEpoch++; listening = false; pendingWake = false; engine?.stop() }
  override fun onDestroy() {
    val interrupted = requestId ?: replyId
    generation++; audioEpoch++; listening = false; pendingWake = false; candidatePending = false; enrolling = false; phase = "stopped"
    event("interrupt", interrupted); requestId = null; replyId = null; event("status")
    engine?.stop(); engine = null; speaker?.close(); speaker = null
    reference.clear()
    lock?.let { if (it.isHeld) it.release() }; lock = null
    if (instance === this) instance = null
    UncoverVoiceModule.instance?.status(); super.onDestroy()
  }
}
