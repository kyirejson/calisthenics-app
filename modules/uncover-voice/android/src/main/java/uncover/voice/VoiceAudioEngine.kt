package uncover.voice

import android.content.Context
import android.os.SystemClock
import android.util.Log
import com.k2fsa.sherpa.onnx.*
import java.util.ArrayDeque
import java.util.UUID
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread

internal data class VoiceAudioFrame(val samples: FloatArray, val speech: Boolean, val timeMs: Long = 0)
internal interface VoiceAudioEvents {
  fun ready(); fun armed(segment: String); fun partial(segment: String, text: String)
  fun candidate(segment: String); fun hearing(segment: String, referenceEpoch: Long)
  fun probe(segment: String, id: String, text: String, wake: Boolean, silenceMs: Long)
  fun revoked(id: String); fun utterance(text: String, wake: Boolean); fun settled(segment: String, action: String)
  fun assessmentError(message: String); fun microphoneState(silenced: Boolean); fun failure(error: Throwable)
}

/** Input processing only. Capture and reply playback have independent lifecycles. No identity gate. */
internal class VoiceAudioEngine(private val context: Context, private val reference: VoiceRenderReference, private val events: VoiceAudioEvents,
  source: ((Boolean) -> Unit, (Throwable) -> Unit) -> VoiceFrameSource = ::VoiceCaptureDriver) {
  @Volatile var silenced = false; private set
  @Volatile private var stopped = false
  private val control = VoiceTurnControl()
  private val decisions = ConcurrentLinkedQueue<Triple<String, String, String?>>()
  private val mode = AtomicReference<Boolean?>(null)
  private val capture = source({ value -> silenced = value; if (!stopped) events.microphoneState(value) }, { if (!stopped) events.failure(it) })
  private var worker: Thread? = null
  fun arm() { mode.set(true) }
  fun idle() { mode.set(false) }
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
        // This selects the KWS/ASR stream only; session/output state and inactivity are owned by the controller.
        var recognizing = false; var collecting = false; var segment = UUID.randomUUID().toString(); var displayed = ""
        var lastSpeech = 0L
        var keywordFrames = 0
        var referenceEpoch = 0L; var captureRoute = 0; var captureClockRevision = 0L
        var lastAcoustic = ""; var loggedAt = 0L
        fun show() { if (turn.text != displayed) { displayed = turn.text; control.revise(displayed)?.let(events::revoked); events.partial(segment, displayed) } }
        fun resetSegment() { collecting = false; asr.reset(stream); gate.reset() }
        fun resetTurn() { control.reset()?.let(events::revoked); turn.clear(); segment = UUID.randomUUID().toString(); displayed = ""; resetSegment() }
        fun resetKeyword() { ks?.release(); ks = kws.createStream(); keywordFrames = 0 }
        fun decode() { while (asr.isReady(stream)) asr.decode(stream); turn.update(asr.getResult(stream).text); show() }
        fun accept() {
          val text = turn.text; val woke = turn.wake
          resetTurn(); recent.clear(); events.utterance(text, woke)
        }
        if (stopped) return@thread
        capture.start { if (!stopped) events.ready() }
        while (!stopped) {
          val input = capture.next() ?: continue; val now = SystemClock.elapsedRealtime()
          mode.getAndSet(null)?.let { armed ->
            resetTurn(); resetKeyword(); vad.reset(); recent.clear(); recognizing = armed
            if (armed) events.armed(segment)
          }
          if (silenced) continue
          if ((captureRoute != 0 && input.routeId != 0 && captureRoute != input.routeId) || input.clockRevision != captureClockRevision)
            reference.routeChanged(input.startNs)
          captureClockRevision = input.clockRevision
          if (input.routeId != 0) captureRoute = input.routeId
          val rendered = reference.read(input.startNs, input.samples.size)
          if (rendered.epoch != referenceEpoch) {
            referenceEpoch = rendered.epoch
            echo?.close(); echo = VoiceEcho(512); vad.reset(); recent.clear()
            // Keep already accepted user words, but not a hypothesis from an old route.
            if (collecting) turn.seal()
            resetSegment(); resetKeyword()
          }
          val processor = checkNotNull(echo)
          val floats = processor.process(input.samples, rendered.samples)
          val detected = vad.compute(floats)
          val probability = if (floats.any { it != 0f }) detected else 0f
          val evidence = processor.evidence
          val source = evidence.source(rendered.renderProtected, rendered.reliable && input.timestamped)
          val diagnostic = "$source protected=${rendered.renderProtected} renderClock=${rendered.reliable} captureClock=${input.timestamped}"
          if (diagnostic != lastAcoustic && now - loggedAt >= 500) {
            Log.i("BLACK-VoiceInput", "$diagnostic near=${evidence.nearendBlocks}/${evidence.blocks} echo=${evidence.echoBlocks} delayMs=${evidence.delayMs} erleDb=${evidence.erleDb}")
            lastAcoustic = diagnostic; loggedAt = now
          }
          // AEC always processes the full duplex waveform. Admission, not whole-frame
          // DSP muting, keeps echo/unknown candidates out of KWS, ASR and the model.
          val admitted = if (source == VoiceSoundSource.NEAR_END) floats else FloatArray(floats.size)
          val frame = VoiceAudioFrame(admitted, source == VoiceSoundSource.NEAR_END && probability >= .55f, input.startNs / 1_000_000)
          recent.addLast(frame); if (recent.size > 12) recent.removeFirst()
          if (!recognizing) {
            ks!!.acceptWaveform(admitted, 16000)
            while (kws.isReady(ks!!)) kws.decode(ks!!)
            if (kws.getResult(ks!!).keyword.isBlank()) {
              if (++keywordFrames >= 1000) resetKeyword()
              continue
            }
            resetKeyword(); resetTurn(); turn.activate(); lastSpeech = frame.timeMs
            recognizing = true; events.armed(segment); show()
            // Preserve the keyword frame and pre-roll: a following command may
            // already have started before KWS returns. The model receives wake metadata.
            collecting = true; recent.forEach { stream!!.acceptWaveform(it.samples, 16000) }; decode()
            recent.clear(); continue
          }
          if (frame.speech) lastSpeech = frame.timeMs
          val onset = gate.observe(probability, source)
          if (onset == VoiceSpeechGate.Event.CANDIDATE) events.candidate(segment)
          if (onset == VoiceSpeechGate.Event.HEARING) events.hearing(segment, rendered.epoch)
          if (!collecting && onset.startsRecognition(rendered.renderProtected)) {
            collecting = true
            recent.forEach { stream!!.acceptWaveform(it.samples, 16000) }; decode()
          } else if (collecting) {
            stream!!.acceptWaveform(admitted, 16000); decode()
          }
          if (collecting && frame.timeMs - lastSpeech >= 650) {
            stream!!.acceptWaveform(FloatArray(11200), 16000); decode()
            val emptySegment = turn.partial.isBlank()
            turn.seal(); resetSegment(); recent.clear()
            if (emptySegment) events.settled(segment, "noise")
          }
          if (!collecting && !gate.candidate) {
            while (true) {
              val result = decisions.poll() ?: break
              if (!control.consume(result.first, result.second, now)) continue
              when (result.second) {
                "respond" -> accept()
                "wait" -> events.settled(segment, "wait")
                "ignore" -> { events.settled(segment, "ignore"); resetTurn() }
                else -> { events.settled(segment, "error"); events.assessmentError(result.third ?: "判停暂不可用，输入已保留。") }
              }
            }
            if (control.hasDraft && turn.text.isNotBlank()) {
              if (turn.onlyWake && frame.timeMs - lastSpeech >= 650) accept()
              else if (frame.timeMs - lastSpeech >= 900) {
                val id = "voice-probe-" + UUID.randomUUID()
                if (control.issue(id, now)) events.probe(segment, id, turn.text, turn.wake, frame.timeMs - lastSpeech)
              }
            }
          }
          if (control.timeout(now)) { events.settled(segment, "error"); events.assessmentError("判停超时，输入已保留，不会执行未确认的半句话。") }
        }
      } catch (error: Throwable) { if (!stopped) events.failure(error) }
      finally { capture.stop(); control.reset(); echo?.close(); vad?.release(); ks?.release(); stream?.release(); kws?.release(); asr?.release() }
    }
  }
  fun stop() { stopped = true; control.reset(); capture.stop(); worker?.interrupt() }
}
