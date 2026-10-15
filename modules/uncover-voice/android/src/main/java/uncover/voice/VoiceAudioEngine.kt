package uncover.voice

import android.content.Context
import android.os.SystemClock
import com.k2fsa.sherpa.onnx.*
import java.util.ArrayDeque
import java.util.UUID
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.atomic.AtomicInteger
import kotlin.concurrent.thread

internal data class VoiceAudioFrame(val samples: FloatArray, val speech: Boolean, val timeMs: Long = 0)
internal interface VoiceAudioEvents {
  fun ready(); fun armed(); fun partial(segment: String, text: String); fun candidate()
  fun probe(id: String, text: String, wake: Boolean, silenceMs: Long)
  fun accepted(); fun utterance(text: String, wake: Boolean); fun dismissed()
  fun assessmentError(message: String); fun idle(); fun microphoneState(silenced: Boolean); fun failure(error: Throwable)
}

/** Input processing only. Capture and reply playback have independent lifecycles. No identity gate. */
internal class VoiceAudioEngine(private val context: Context, private val reference: VoiceRenderReference, private val events: VoiceAudioEvents) {
  @Volatile var silenced = false; private set
  @Volatile private var stopped = false
  @Volatile private var outputActive = false
  private val control = VoiceTurnControl()
  private val decisions = ConcurrentLinkedQueue<Triple<String, String, String?>>()
  private val reset = AtomicInteger(); private val followUp = AtomicInteger()
  private val capture = VoiceCaptureDriver({ value -> silenced = value; if (!stopped) events.microphoneState(value) }, { if (!stopped) events.failure(it) })
  private var worker: Thread? = null
  fun listenAgain() { reset.incrementAndGet() }
  fun afterReply() { outputActive = false; followUp.incrementAndGet() }
  fun beginReply() { outputActive = true }
  fun arm() { reset.incrementAndGet() }
  fun decisionActive(id: String) = !stopped && control.active(id)
  fun decide(id: String, action: String, error: String? = null) { if (!stopped && control.submit(id)) decisions.add(Triple(id, action, error)) }
  fun start() {
    worker = thread(name = "BLACK-recognition") {
      var kws: KeywordSpotter? = null; var asr: OnlineRecognizer? = null; var vad: Vad? = null; var echo: VoiceEcho? = null
      var ks: OnlineStream? = null; var stream: OnlineStream? = null
      try {
        kws = KeywordSpotter(context.assets, KeywordSpotterConfig(modelConfig = OnlineModelConfig(transducer = OnlineTransducerModelConfig(
          encoder = "black-voice/kws/encoder.onnx", decoder = "black-voice/kws/decoder.onnx", joiner = "black-voice/kws/joiner.onnx"),
          tokens = "black-voice/kws/tokens.txt", modelType = "zipformer2", numThreads = 1),
          keywordsFile = "black-voice/keywords.txt", keywordsScore = 1f, keywordsThreshold = .5f, numTrailingBlanks = 1))
        asr = OnlineRecognizer(context.assets, OnlineRecognizerConfig(modelConfig = OnlineModelConfig(
          zipformer2Ctc = OnlineZipformer2CtcModelConfig("black-voice/asr/model.int8.onnx"), tokens = "black-voice/asr/tokens.txt", numThreads = 2),
          endpointConfig = EndpointConfig(EndpointRule(false, 15f, 0f), EndpointRule(true, .65f, 0f), EndpointRule(false, 0f, 1200f))))
        vad = Vad(context.assets, VadModelConfig(sileroVadModelConfig = SileroVadModelConfig(model = "black-voice/vad/silero_vad.onnx", windowSize = 512), numThreads = 1))
        echo = VoiceEcho(512); ks = kws.createStream(); stream = asr.createStream()
        val gate = VoiceSpeechGate(); val recent = ArrayDeque<VoiceAudioFrame>(); val turn = VoiceTurnBuffer()
        var activeSession = false; var collecting = false; var segment = UUID.randomUUID().toString(); var displayed = ""
        var lastSpeech = 0L; var lastActivity = SystemClock.elapsedRealtime(); var previousReset = 0; var previousFollowUp = 0
        var keywordFrames = 0
        fun show() { if (turn.text != displayed) { displayed = turn.text; control.revise(displayed); events.partial(segment, displayed) } }
        fun resetSegment() { collecting = false; asr.reset(stream); gate.reset() }
        fun resetTurn() { control.reset(); turn.clear(); segment = UUID.randomUUID().toString(); displayed = ""; resetSegment() }
        fun resetKeyword() { ks?.release(); ks = kws.createStream(); keywordFrames = 0 }
        fun decode() { while (asr.isReady(stream)) asr.decode(stream); turn.update(asr.getResult(stream).text); show() }
        fun accept() {
          val text = turn.text; val woke = turn.wake
          resetTurn(); recent.clear(); events.accepted(); outputActive = true; events.utterance(text, woke)
        }
        if (stopped) return@thread
        capture.start { if (!stopped) events.ready() }
        while (!stopped) {
          val input = capture.next() ?: continue; val now = SystemClock.elapsedRealtime()
          if (previousReset != reset.get()) {
            previousReset = reset.get(); resetTurn(); resetKeyword(); vad.reset(); recent.clear(); activeSession = true; lastActivity = now; events.armed()
          }
          if (previousFollowUp != followUp.get()) { previousFollowUp = followUp.get(); activeSession = true; lastActivity = now }
          if (silenced) continue
          val floats = echo.process(input.samples, reference.frame(input.startNs, input.samples.size))
          val detected = vad.compute(floats)
          val probability = if (floats.any { it != 0f }) detected else 0f
          val frame = VoiceAudioFrame(floats, probability >= .55f, input.startNs / 1_000_000)
          recent.addLast(frame); if (recent.size > 12) recent.removeFirst()
          if (!activeSession) {
            ks!!.acceptWaveform(floats, 16000)
            while (kws.isReady(ks!!)) kws.decode(ks!!)
            if (kws.getResult(ks!!).keyword.isBlank()) {
              if (++keywordFrames >= 1000) resetKeyword()
              continue
            }
            resetKeyword(); resetTurn(); turn.activate(); lastActivity = now; lastSpeech = frame.timeMs
            activeSession = true; events.armed(); show()
            // Preserve the keyword frame and pre-roll: a following command may
            // already have started before KWS returns. The model receives wake metadata.
            collecting = true; recent.forEach { stream!!.acceptWaveform(it.samples, 16000) }; decode()
            recent.clear(); continue
          }
          if (frame.speech) { lastSpeech = frame.timeMs; lastActivity = now }
          if (!collecting && gate.observe(probability)) {
            collecting = true; events.candidate()
            recent.forEach { stream!!.acceptWaveform(it.samples, 16000) }; decode()
          } else if (collecting) {
            stream!!.acceptWaveform(floats, 16000); decode()
          }
          if (collecting && frame.timeMs - lastSpeech >= 650) {
            stream!!.acceptWaveform(FloatArray(11200), 16000); decode(); turn.seal(); resetSegment(); recent.clear()
            if (turn.text.isBlank()) events.dismissed()
          }
          if (!collecting && !gate.candidate) {
            while (true) {
              val result = decisions.poll() ?: break
              if (!control.consume(result.first, result.second, now)) continue
              when (result.second) {
                "respond" -> accept()
                "wait" -> events.dismissed()
                "ignore" -> { resetTurn(); events.dismissed() }
                else -> { events.dismissed(); events.assessmentError(result.third ?: "判停暂不可用，输入已保留。") }
              }
            }
            if (control.hasDraft && turn.text.isNotBlank()) {
              if (turn.onlyWake && frame.timeMs - lastSpeech >= 650) accept()
              else if (frame.timeMs - lastSpeech >= 900) {
                val id = "voice-probe-" + UUID.randomUUID()
                if (control.issue(id, now)) events.probe(id, turn.text, turn.wake, frame.timeMs - lastSpeech)
              }
            }
          }
          if (control.timeout(now)) { events.dismissed(); events.assessmentError("判停超时，输入已保留，不会执行未确认的半句话。") }
          if (!collecting && !outputActive && now - lastActivity > 30000) {
            resetTurn(); activeSession = false; recent.clear(); resetKeyword(); events.partial(segment, ""); events.idle()
          }
        }
      } catch (error: Throwable) { if (!stopped) events.failure(error) }
      finally { capture.stop(); control.reset(); echo?.close(); vad?.release(); ks?.release(); stream?.release(); kws?.release(); asr?.release() }
    }
  }
  fun stop() { stopped = true; control.reset(); capture.stop(); worker?.interrupt() }
}
