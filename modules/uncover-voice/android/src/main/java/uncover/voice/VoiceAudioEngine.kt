package uncover.voice

import android.app.ActivityManager
import android.app.KeyguardManager
import android.content.Context
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.AudioManager
import android.media.AudioRecordingConfiguration
import android.media.AudioTimestamp
import android.media.MediaRecorder
import android.media.audiofx.AcousticEchoCanceler
import android.os.SystemClock
import android.os.Handler
import android.os.Looper
import com.k2fsa.sherpa.onnx.*
import java.util.ArrayDeque
import java.util.UUID
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.atomic.AtomicInteger
import kotlin.concurrent.thread

internal interface VoiceAudioEvents {
  fun ready()
  fun armed()
  fun partial(segment: String, text: String)
  fun candidate()
  fun probe(id: String, text: String, wake: Boolean, silenceMs: Long)
  fun accepted()
  fun utterance(text: String, wake: Boolean)
  fun dismissed()
  fun assessmentError(message: String)
  fun enrollment(progress: Int, stage: String, complete: Boolean, error: String? = null)
  fun idle()
  fun microphoneState(silenced: Boolean)
  fun failure(error: Throwable)
}

/** Neural keyword + independent packet identity + semantic turn control. One microphone owner. */
internal class VoiceAudioEngine(private val context: Context, private val reference: VoiceRenderReference,
  private val enrollmentTicket: Long?, private val events: VoiceAudioEvents) {
  private val enrolling get() = enrollmentTicket != null
  @Volatile var mode = if (enrolling) "enrolling" else "wake"
  @Volatile var silenced = false; private set
  @Volatile private var stopped = false
  private val control = VoiceTurnControl()
  private val decisions = ConcurrentLinkedQueue<Triple<String, String, String?>>()
  private val reset = AtomicInteger(0)
  private val followUpClock = AtomicInteger(0)
  private var recorder: AudioRecord? = null
  private var worker: Thread? = null
  fun listenAgain() { control.reset(); reset.incrementAndGet(); mode = "listening" }
  // Answer completion starts a fresh listening window without erasing speech
  // the owner may already be saying while the previous answer is delivered.
  fun afterReply() { followUpClock.incrementAndGet(); mode = "listening" }
  fun arm() { control.reset(); reset.incrementAndGet(); mode = "verifying" }
  fun decisionActive(id: String) = !stopped && control.active(id)
  fun decide(id: String, action: String, error: String? = null) {
    if (!stopped && control.submit(id)) decisions.add(Triple(id, action, error))
  }
  fun start() {
    worker = thread(name = "BLACK-local-audio") {
      var kws: KeywordSpotter? = null; var asr: OnlineRecognizer? = null; var vad: Vad? = null
      var kwsStream: OnlineStream? = null; var asrStream: OnlineStream? = null
      var hardwareEcho: AcousticEchoCanceler? = null; var echo: VoiceEcho? = null; var extractor: SpeakerEmbeddingExtractor? = null
      var recordingCallback: AudioManager.AudioRecordingCallback? = null
      try {
        val store = VoiceOwnerStore(context)
        val profile = if (enrolling) null else store.read() ?: error("请先在语音设置中登记主人声音。")
        extractor = SpeakerEmbeddingExtractor(context.assets, SpeakerEmbeddingExtractorConfig(model = "black-voice/speaker/campplus.onnx", numThreads = 1))
        val biometrics = VoiceBiometrics(extractor)
        kws = KeywordSpotter(context.assets, KeywordSpotterConfig(
          modelConfig = OnlineModelConfig(transducer = OnlineTransducerModelConfig(
            encoder = "black-voice/kws/encoder.onnx", decoder = "black-voice/kws/decoder.onnx", joiner = "black-voice/kws/joiner.onnx"),
            tokens = "black-voice/kws/tokens.txt", modelType = "zipformer2", numThreads = 1),
          // Pin the boost: Kotlin's 1.5 default misses BLACK before a longer
          // sentence with this model; the measured Python pipeline uses 1.0.
          keywordsFile = "black-voice/keywords.txt", keywordsScore = 1f, keywordsThreshold = 0.5f, numTrailingBlanks = 1))
        asr = OnlineRecognizer(context.assets, OnlineRecognizerConfig(
          modelConfig = OnlineModelConfig(zipformer2Ctc = OnlineZipformer2CtcModelConfig("black-voice/asr/model.int8.onnx"),
            tokens = "black-voice/asr/tokens.txt", numThreads = 2),
          endpointConfig = EndpointConfig(EndpointRule(false, 15f, 0f), EndpointRule(true, .65f, 0f), EndpointRule(false, 0f, 1200f))))
        vad = Vad(context.assets, VadModelConfig(sileroVadModelConfig = SileroVadModelConfig(model = "black-voice/vad/silero_vad.onnx", windowSize = 512), numThreads = 1))
        kwsStream = kws.createStream(); asrStream = asr.createStream(); echo = VoiceEcho(512)
        val wakeWindow = VoiceWakeWindow()
        fun resetKeyword() { kwsStream?.release(); kwsStream = kws.createStream(); wakeWindow.clear() }
        fun keyword(frame: VoiceAudioFrame): VoiceWakeClip? {
          wakeWindow.append(frame); kwsStream!!.acceptWaveform(frame.samples, 16000)
          while (kws.isReady(kwsStream!!)) {
            kws.decode(kwsStream!!)
            val result = kws.getResult(kwsStream!!)
            if (result.keyword.isNotBlank()) {
              val clip = wakeWindow.clip(result.timestamps); resetKeyword(); return clip
            }
          }
          return null
        }
        val minimum = AudioRecord.getMinBufferSize(16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
        check(minimum > 0) { "系统不支持当前麦克风格式。" }
        val input = AudioRecord(MediaRecorder.AudioSource.VOICE_COMMUNICATION, 16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, maxOf(minimum * 4, 64000))
        recorder = input; check(input.state == AudioRecord.STATE_INITIALIZED) { "麦克风初始化失败，可能被其他应用占用。" }
        recordingCallback = object : AudioManager.AudioRecordingCallback() {
          override fun onRecordingConfigChanged(configs: MutableList<AudioRecordingConfiguration>?) {
            val owned = configs?.firstOrNull { it.clientAudioSessionId == input.audioSessionId } ?: return
            if (silenced != owned.isClientSilenced && !stopped) { silenced = owned.isClientSilenced; control.reset(); events.microphoneState(silenced) }
          }
        }.also { input.registerAudioRecordingCallback({ runnable -> Handler(Looper.getMainLooper()).post(runnable) }, it) }
        if (AcousticEchoCanceler.isAvailable()) hardwareEcho = AcousticEchoCanceler.create(input.audioSessionId)?.apply { enabled = true }
        input.startRecording(); val captureClock = VoiceCaptureClock(System.nanoTime())
        check(input.recordingState == AudioRecord.RECORDSTATE_RECORDING) { "系统没有启动麦克风录音。" }
        if (!stopped) events.ready()
        val samples = ShortArray(512); val stamp = AudioTimestamp(); val gate = VoiceSpeechGate()
        val recent = ArrayDeque<VoiceAudioFrame>()
        val turn = VoiceTurnBuffer()
        val packets = VoicePacketGate { frames, voiced -> biometrics.embedding(frames)?.let { VoiceIdentity.accepts(profile!!, it, voiced) } == true }
        var segmentId = UUID.randomUUID().toString(); var displayed = ""
        var totalRead = 0L; var previousReset = -1; var previousFollowUp = -1; var collecting = false; var certifiedAudio = false
        var lastRawSpeech = 0L; var lastOwnerSpeech = 0L; var armedAt = 0L
        var heardAt = SystemClock.elapsedRealtime()
        fun present() { if (turn.text != displayed) { displayed = turn.text; events.partial(segmentId, displayed) } }
        fun resetSegment() { collecting = false; certifiedAudio = false; packets.clear(); asr.reset(asrStream); gate.reset(); recent.clear() }
        fun resetTurn() { control.reset(); turn.clear(); segmentId = UUID.randomUUID().toString(); displayed = ""; resetSegment() }
        fun decode() { while (asr.isReady(asrStream)) asr.decode(asrStream); turn.update(asr.getResult(asrStream).text); present() }
        fun sealCertifiedSegment() {
          // ASR has received certified PCM only. A rejected next speaker must
          // not erase the owner's preceding words or enter this decoder.
          if (certifiedAudio) { asrStream.acceptWaveform(FloatArray(11200), 16000); decode(); turn.seal() }
          resetSegment()
        }
        fun acceptTurn() {
          val text = turn.text; val woke = turn.wake
          resetTurn(); events.accepted(); mode = "processing"; events.utterance(text, woke)
        }
        val enrollFrames = mutableListOf<VoiceAudioFrame>()
        val enrolledVectors = mutableListOf<FloatArray>(); val enrolledGroups = mutableListOf<List<FloatArray>>(); val enrolledWakes = mutableListOf<FloatArray>()
        var capturedWake: FloatArray? = null; var enrollVoiced = 0L; var enrollCapture = false; var enrollLastSpeech = 0L
        var enrollCooldown = 0L; val enrollStarted = SystemClock.elapsedRealtime(); var enrollNotified = -1
        var enrollBase: VoiceOwnerProfile? = null
        while (!stopped) {
          var filled = 0
          while (!stopped && filled < samples.size) {
            val count = input.read(samples, filled, samples.size - filled)
            if (count < 0) error("麦克风读取失败 (" + count + ")。")
            if (count > 0) { filled += count; totalRead += count }
          }
          if (stopped) break
          val now = SystemClock.elapsedRealtime()
          if (previousReset != reset.get()) {
            previousReset = reset.get(); resetTurn(); resetKeyword(); vad.reset(); heardAt = now
            if (mode == "verifying") { armedAt = now; events.armed() }
          }
          if (previousFollowUp != followUpClock.get()) { previousFollowUp = followUpClock.get(); heardAt = now }
          if (silenced) continue
          val timestamped = input.getTimestamp(stamp, AudioTimestamp.TIMEBASE_MONOTONIC) == AudioRecord.SUCCESS
          val startNs = captureClock.frame(totalRead, samples.size, if (timestamped) stamp.framePosition else null, if (timestamped) stamp.nanoTime else null)
          val audioNow = startNs / 1_000_000L
          val floats = echo.process(samples, reference.frame(startNs, samples.size))
          val detected = vad.compute(floats); val probability = if (floats.any { it != 0f }) detected else 0f
          val frame = VoiceAudioFrame(floats, probability >= .55f, audioNow)
          recent.addLast(frame); if (recent.size > 5) recent.removeFirst()
          if (enrolling) {
            if (!store.enrollmentActive(enrollmentTicket!!)) break
            val info = ActivityManager.RunningAppProcessInfo(); ActivityManager.getMyMemoryState(info)
            check(!(context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager).isDeviceLocked &&
              info.importance <= ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND) { "声音登记需保持 App 在前台且手机已解锁。" }
            check(now - enrollStarted < 90000) { "没有收集到足够清晰人声，请在安静处重新登记。" }
            if (now < enrollCooldown) continue
            if (frame.speech) enrollLastSpeech = audioNow
            val hit = if (capturedWake == null || enrolledVectors.size == 3) keyword(frame) else null
            if (hit != null) {
              val voiced = hit.frames.count { it.speech } * 32L
              val vector = if (voiced >= 192) biometrics.embedding(hit.frames) else null
              if (enrolledVectors.size == 3 && vector != null) {
                val completed = VoiceIdentity.complete(enrollBase!!, enrolledGroups, enrolledWakes, vector, voiced)
                store.commitEnrollment(completed, enrollmentTicket)
                events.enrollment(100, "complete", true); return@thread
              }
              if (vector != null) capturedWake = vector
            }
            if (enrolledVectors.size == 3) continue
            if (!enrollCapture && gate.observe(probability)) { enrollCapture = true; enrollFrames.addAll(recent); enrollVoiced = recent.count { it.speech } * 32L }
            else if (enrollCapture) { enrollFrames.add(frame); if (frame.speech) enrollVoiced += 32 }
            val percent = enrolledVectors.size * 25 + ((enrollVoiced * 24 / 3200).toInt().coerceAtMost(24))
            if (percent / 3 != enrollNotified) { enrollNotified = percent / 3; events.enrollment(percent, "voice_" + (enrolledVectors.size + 1), false) }
            // Let the user finish the displayed sentence. Advancing at exactly
            // 3.2 seconds would record its remaining words as the next sample.
            if (enrollVoiced >= 3200 && audioNow - enrollLastSpeech >= 650) {
              val wake = capturedWake ?: error("请在每段登记内容开头先说 BLACK，再读后面的句子。")
              val audio = biometrics.samples(enrollFrames.filter { it.speech })
              enrolledVectors.add(biometrics.embedding(audio) ?: error("有效人声不足，请重新登记。"))
              enrolledGroups.add(biometrics.shortViews(audio)); enrolledWakes.add(wake)
              enrollFrames.clear(); capturedWake = null; enrollVoiced = 0; enrollCapture = false; recent.clear(); gate.reset(); resetKeyword(); vad.reset()
              enrollCooldown = SystemClock.elapsedRealtime() + 800
              if (enrolledVectors.size == 3) {
                enrollBase = VoiceIdentity.enroll(enrolledVectors)
                events.enrollment(75, "wake_check", false)
              } else events.enrollment(enrolledVectors.size * 25, "voice_" + (enrolledVectors.size + 1), false)
            }
            continue
          }
          val hit = keyword(frame)
          var queuedByWake = false
          if (hit != null) {
            val voiced = hit.frames.count { it.speech } * 32L
            if (biometrics.embedding(hit.frames)?.let { VoiceIdentity.acceptsWake(profile!!, it, voiced) } == true) {
              // Authorize exactly the keyword audio. Adjacent speech remains unverified.
              if (mode == "wake") resetTurn()
              else { turn.update(""); present(); resetSegment() }
              turn.activate(); control.owner(now); heardAt = now; lastOwnerSpeech = hit.frames.last().timeMs
              if (mode == "wake" || mode == "verifying") { mode = "verifying"; armedAt = now; events.armed() }
              hit.tail.forEach(packets::append); collecting = packets.pending
              if (collecting) lastRawSpeech = hit.tail.lastOrNull { it.speech }?.timeMs ?: audioNow
              queuedByWake = true; events.candidate()
            }
          }
          if (mode == "wake") continue
          if (mode !in listOf("verifying", "listening", "processing", "speaking")) continue
          if (frame.speech) lastRawSpeech = audioNow
          if (!queuedByWake && !collecting && gate.observe(probability)) {
            collecting = true; packets.clear(); recent.forEach(packets::append)
          } else if (!queuedByWake && collecting) packets.append(frame)
          if (collecting) {
            val final = audioNow - lastRawSpeech >= 320
            val result = packets.resolve(final)
            if (result != null) {
              if (result.accepted) {
                control.owner(now); heardAt = now
                lastOwnerSpeech = result.frames.lastOrNull { it.speech }?.timeMs ?: lastOwnerSpeech
                events.candidate(); result.frames.forEach { asrStream.acceptWaveform(it.samples, 16000) }
                certifiedAudio = true; decode()
              } else {
                sealCertifiedSegment(); events.dismissed()
              }
            }
            if (collecting && audioNow - lastRawSpeech >= 650) {
              sealCertifiedSegment()
            }
          }
          // Unknown sound can defer a decision while one packet is classified,
          // but cannot revoke it. A rejected packet releases the same decision.
          if (!packets.pending && !gate.candidate) while (true) {
            val decision = decisions.poll() ?: break
            if (!control.consume(decision.first, decision.second, now)) continue
            when (decision.second) {
              "respond" -> acceptTurn()
              "wait" -> Unit
              "ignore" -> { resetTurn(); if (mode == "verifying") mode = "listening"; events.dismissed() }
              else -> { events.dismissed(); events.assessmentError(decision.third ?: "语义判断未完成，正在保留输入重试。") }
            }
          }
          if (control.hasOwner && !collecting && !gate.candidate && turn.text.isNotBlank()) {
            // A personally verified keyword invokes the normal Agent directly.
            // It does not dictate a response or synthesize a second local greeting.
            if (turn.onlyWake && audioNow - lastOwnerSpeech >= 450) acceptTurn()
            else if (audioNow - lastOwnerSpeech >= 800) {
              val id = "voice-probe-" + UUID.randomUUID()
              if (control.issue(id, now)) events.probe(id, turn.text, turn.wake, audioNow - lastOwnerSpeech)
            }
          }
          if (control.timeout(now)) { events.dismissed(); events.assessmentError("语义判断超时，输入已保留；只重试判定，不会执行半句话。") }
          // The same idle recovery applies after the first wake, wait and errors.
          if (control.expired(now) && !packets.pending) {
            val foregroundTurn = mode == "processing" || mode == "speaking"
            resetTurn(); events.partial(segmentId, ""); events.dismissed()
            if (!foregroundTurn) { mode = "wake"; events.idle() }
          }
          if (mode == "verifying" && !control.hasOwner && now - armedAt > 7000) { resetTurn(); mode = "wake"; events.idle() }
          if (mode == "listening" && !control.hasOwner && now - heardAt > 20000) { resetTurn(); mode = "wake"; events.idle() }
        }
      } catch (error: Throwable) {
        if (!stopped) { if (enrolling) events.enrollment(0, "failed", false, error.message ?: "声音登记失败。") else events.failure(error) }
      } finally {
        control.reset()
        recordingCallback?.let { callback -> runCatching { recorder?.unregisterAudioRecordingCallback(callback) } }
        runCatching { recorder?.stop() }; recorder?.release(); recorder = null
        hardwareEcho?.release(); echo?.close(); extractor?.release(); vad?.release(); kwsStream?.release(); asrStream?.release(); kws?.release(); asr?.release()
      }
    }
  }
  fun stop() { stopped = true; control.reset(); runCatching { recorder?.stop() }; worker?.interrupt() }
}
