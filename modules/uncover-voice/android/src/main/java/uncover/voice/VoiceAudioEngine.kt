package uncover.voice

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
import java.util.concurrent.atomic.AtomicInteger
import kotlin.concurrent.thread

/** One microphone owner. Cleaned speech feeds KWS/ASR; microphone PCM never leaves RAM or the device. */
internal class VoiceAudioEngine(private val context: Context, private val reference: VoiceRenderReference,
  private val ready: () -> Unit, private val wake: () -> Unit, private val partial: (String) -> Unit,
  private val utterance: (String) -> Unit, private val barge: () -> Unit, private val idle: () -> Unit,
  private val microphoneState: (Boolean) -> Unit, private val failure: (Throwable) -> Unit) {
  @Volatile var mode = "wake"
  @Volatile var silenced = false; private set
  @Volatile private var stopped = false
  @Volatile private var recorder: AudioRecord? = null
  private val reset = AtomicInteger(0)
  private var worker: Thread? = null
  fun listenAgain() { reset.incrementAndGet(); mode = "listening" }
  fun start() {
    worker = thread(name = "BLACK-local-audio") {
      var kws: KeywordSpotter? = null; var asr: OnlineRecognizer? = null; var vad: Vad? = null
      var kwsStream: OnlineStream? = null; var asrStream: OnlineStream? = null
      var hardwareEcho: AcousticEchoCanceler? = null; var echo: VoiceEcho? = null
      var recordingCallback: AudioManager.AudioRecordingCallback? = null
      try {
        kws = KeywordSpotter(context.assets, KeywordSpotterConfig(
          modelConfig = OnlineModelConfig(transducer = OnlineTransducerModelConfig(
            encoder = "black-voice/kws/encoder.onnx", decoder = "black-voice/kws/decoder.onnx", joiner = "black-voice/kws/joiner.onnx"),
            tokens = "black-voice/kws/tokens.txt", modelType = "zipformer2", numThreads = 1),
          keywordsFile = "black-voice/keywords.txt", keywordsThreshold = 0.5f, numTrailingBlanks = 1))
        asr = OnlineRecognizer(context.assets, OnlineRecognizerConfig(
          modelConfig = OnlineModelConfig(zipformer2Ctc = OnlineZipformer2CtcModelConfig("black-voice/asr/model.int8.onnx"),
            tokens = "black-voice/asr/tokens.txt", numThreads = 2),
          endpointConfig = EndpointConfig(EndpointRule(false, 15f, 0f), EndpointRule(true, 1.0f, 0f), EndpointRule(false, 0f, 1200f))))
        vad = Vad(context.assets, VadModelConfig(sileroVadModelConfig = SileroVadModelConfig(
          model = "black-voice/vad/silero_vad.onnx", windowSize = 512), numThreads = 1))
        kwsStream = kws.createStream(); asrStream = asr.createStream(); echo = VoiceEcho(512)
        val minimum = AudioRecord.getMinBufferSize(16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
        check(minimum > 0) { "系统不支持当前麦克风格式。" }
        val input = AudioRecord(MediaRecorder.AudioSource.VOICE_COMMUNICATION, 16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, maxOf(minimum * 2, 6400))
        recorder = input
        check(input.state == AudioRecord.STATE_INITIALIZED) { "麦克风初始化失败，可能被其他应用或系统占用。" }
        recordingCallback = object : AudioManager.AudioRecordingCallback() {
          override fun onRecordingConfigChanged(configs: MutableList<AudioRecordingConfiguration>?) {
            val owned = configs?.firstOrNull { it.clientAudioSessionId == input.audioSessionId } ?: return
            val next = owned.isClientSilenced
            if (silenced != next && !stopped) { silenced = next; microphoneState(next) }
          }
        }.also { input.registerAudioRecordingCallback({ runnable -> Handler(Looper.getMainLooper()).post(runnable) }, it) }
        if (AcousticEchoCanceler.isAvailable()) hardwareEcho = AcousticEchoCanceler.create(input.audioSessionId)?.apply { enabled = true }
        input.startRecording()
        val captureClock = VoiceCaptureClock(System.nanoTime())
        check(input.recordingState == AudioRecord.RECORDSTATE_RECORDING) { "系统没有启动麦克风录音。" }
        if (!stopped) ready()
        val samples = ShortArray(512); val stamp = AudioTimestamp(); val gate = VoiceSpeechGate()
        val preRoll = ArrayDeque<FloatArray>()
        var totalRead = 0L; var previousReset = -1; var previousMode = ""; var speech = false; var lastText = ""
        var heardAt = SystemClock.elapsedRealtime()
        while (!stopped) {
          var filled = 0
          while (!stopped && filled < samples.size) {
            val count = input.read(samples, filled, samples.size - filled)
            if (count < 0) error("麦克风读取失败 ($count)。")
            if (count > 0) { filled += count; totalRead += count }
          }
          if (stopped) break
          val state = mode; val resetId = reset.get()
          if (state == "listening" && previousMode != "listening") heardAt = SystemClock.elapsedRealtime()
          if (previousReset != resetId || state == "wake" && previousMode != "wake") {
            asr.reset(asrStream); kws.reset(kwsStream); vad.reset(); gate.reset(); preRoll.clear()
            speech = false; lastText = ""; heardAt = SystemClock.elapsedRealtime(); previousReset = resetId
          }
          previousMode = state
          if (silenced) continue
          val timestamped = input.getTimestamp(stamp, AudioTimestamp.TIMEBASE_MONOTONIC) == AudioRecord.SUCCESS
          val startNs = captureClock.frame(totalRead, samples.size,
            if (timestamped) stamp.framePosition else null, if (timestamped) stamp.nanoTime else null)
          val floats = echo.process(samples, reference.frame(startNs, samples.size))
          if (state == "wake") {
            kwsStream.acceptWaveform(floats, 16000)
            while (kws.isReady(kwsStream)) {
              kws.decode(kwsStream)
              if (kws.getResult(kwsStream).keyword.isNotBlank()) { kws.reset(kwsStream); mode = "processing"; wake(); break }
            }
            continue
          }
          if (state !in listOf("listening", "processing", "speaking")) continue
          val detected = vad.compute(floats)
          // Silero keeps recurrent state across frames. Its trailing confidence
          // is not new speech when the acoustic stage has removed all own-render PCM.
          val probability = if (floats.any { it != 0f }) detected else 0f
          val now = SystemClock.elapsedRealtime()
          if (probability >= .55f) heardAt = now
          preRoll.addLast(floats); if (preRoll.size > 16) preRoll.removeFirst()
          if (!speech && gate.observe(probability)) {
            speech = true; asr.reset(asrStream); lastText = ""
            // Preserve the first syllable while the local detector decides; do not require BLACK again.
            preRoll.forEach { asrStream.acceptWaveform(it, 16000) }
            if (state != "listening") { mode = "listening"; barge() }
          } else if (speech) asrStream.acceptWaveform(floats, 16000)
          if (speech) {
            while (asr.isReady(asrStream)) asr.decode(asrStream)
            val text = asr.getResult(asrStream).text.trim()
            if (text != lastText) { lastText = text; partial(text) }
            if (asr.isEndpoint(asrStream)) {
              asr.reset(asrStream); speech = false; gate.reset(); preRoll.clear(); lastText = ""
              if (text.isNotEmpty()) { mode = "processing"; utterance(text) }
              else partial("")
            }
          } else if (state == "listening" && now - heardAt > 20000) {
            mode = "wake"; idle()
          }
        }
      } catch (error: Throwable) { if (!stopped) failure(error) }
      finally {
        recordingCallback?.let { callback -> runCatching { recorder?.unregisterAudioRecordingCallback(callback) } }
        runCatching { recorder?.stop() }; recorder?.release(); recorder = null
        hardwareEcho?.release(); echo?.close(); vad?.release(); kwsStream?.release(); asrStream?.release(); kws?.release(); asr?.release()
      }
    }
  }
  fun stop() { stopped = true; runCatching { recorder?.stop() }; worker?.interrupt() }
}
