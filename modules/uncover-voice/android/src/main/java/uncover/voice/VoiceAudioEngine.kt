package uncover.voice

import android.content.Context
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.AudioManager
import android.media.AudioRecordingConfiguration
import android.media.MediaRecorder
import android.media.audiofx.AcousticEchoCanceler
import android.os.SystemClock
import android.os.Handler
import android.os.Looper
import com.k2fsa.sherpa.onnx.*
import kotlin.concurrent.thread

/** One native microphone owner; ambient PCM never leaves memory or the device. */
internal class VoiceAudioEngine(private val context: Context, private val ready: () -> Unit, private val wake: () -> Unit,
  private val utterance: (String) -> Unit, private val idle: () -> Unit, private val microphoneState: (Boolean) -> Unit, private val failure: (Throwable) -> Unit) {
  @Volatile var mode = "wake"
  @Volatile var silenced = false; private set
  @Volatile private var stopped = false
  @Volatile private var recorder: AudioRecord? = null
  private var worker: Thread? = null
  fun start() {
    worker = thread(name = "BLACK-local-audio") {
      var kws: KeywordSpotter? = null; var asr: OnlineRecognizer? = null
      var kwsStream: OnlineStream? = null; var asrStream: OnlineStream? = null
      var echo: AcousticEchoCanceler? = null
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
          endpointConfig = EndpointConfig(EndpointRule(false, 15f, 0f), EndpointRule(true, 1.2f, 0f), EndpointRule(false, 0f, 1200f))))
        kwsStream = kws.createStream(); asrStream = asr.createStream()
        val minimum = AudioRecord.getMinBufferSize(16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
        check(minimum > 0) { "系统不支持当前麦克风格式。" }
        val input = AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, 16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, maxOf(minimum * 2, 6400))
        recorder = input
        check(input.state == AudioRecord.STATE_INITIALIZED) { "麦克风初始化失败，可能被其他应用或系统占用。" }
        recordingCallback = object : AudioManager.AudioRecordingCallback() {
          override fun onRecordingConfigChanged(configs: MutableList<AudioRecordingConfiguration>?) {
            val owned = configs?.firstOrNull { it.clientAudioSessionId == input.audioSessionId } ?: return
            val next = owned.isClientSilenced
            if (silenced != next && !stopped) { silenced = next; microphoneState(next) }
          }
        }.also { input.registerAudioRecordingCallback({ runnable -> Handler(Looper.getMainLooper()).post(runnable) }, it) }
        if (AcousticEchoCanceler.isAvailable()) echo = AcousticEchoCanceler.create(input.audioSessionId)?.apply { enabled = true }
        input.startRecording()
        check(input.recordingState == AudioRecord.RECORDSTATE_RECORDING) { "系统没有启动麦克风录音。" }
        if (!stopped) ready()
        val samples = ShortArray(1600)
        var previous = ""
        var heardAt = SystemClock.elapsedRealtime()
        var listenStarted = heardAt
        while (!stopped) {
          val count = input.read(samples, 0, samples.size)
          if (count < 0) error("麦克风读取失败 ($count)。")
          if (count == 0) continue
          val state = mode
          if (state != previous) {
            kws.reset(kwsStream); asr.reset(asrStream)
            listenStarted = SystemClock.elapsedRealtime(); heardAt = listenStarted; previous = state
          }
          if (silenced) continue
          val floats = FloatArray(count) { samples[it] / 32768f }
          // The name also re-wakes an ongoing dialogue or interrupts a pending model request.
          kwsStream.acceptWaveform(floats, 16000)
          var triggered = false
          while (kws.isReady(kwsStream)) {
            kws.decode(kwsStream)
            if (kws.getResult(kwsStream).keyword.isNotBlank()) {
              kws.reset(kwsStream); mode = "speaking"; triggered = true; wake(); break
            }
          }
          if (triggered) continue
          // Keep local name detection for barge-in; do not send the assistant's own speech to ASR.
          if (state == "speaking") continue
          if (state == "listening") {
            asrStream.acceptWaveform(floats, 16000)
            while (asr.isReady(asrStream)) asr.decode(asrStream)
            val text = asr.getResult(asrStream).text.trim()
            val now = SystemClock.elapsedRealtime()
            if (floats.any { kotlin.math.abs(it) > .02f }) heardAt = now
            if (asr.isEndpoint(asrStream)) {
              asr.reset(asrStream)
              if (text.isNotEmpty()) { mode = "processing"; utterance(text) }
              else if (now - listenStarted > 15000) { mode = "wake"; idle() }
            } else if (text.isEmpty() && now - heardAt > 20000) { mode = "wake"; idle() }
          }
        }
      } catch (error: Throwable) { if (!stopped) failure(error) }
      finally {
        recordingCallback?.let { callback -> runCatching { recorder?.unregisterAudioRecordingCallback(callback) } }
        runCatching { recorder?.stop() }; recorder?.release(); recorder = null
        echo?.release(); kwsStream?.release(); asrStream?.release(); kws?.release(); asr?.release()
      }
    }
  }
  fun stop() { stopped = true; runCatching { recorder?.stop() }; worker?.interrupt() }
}
