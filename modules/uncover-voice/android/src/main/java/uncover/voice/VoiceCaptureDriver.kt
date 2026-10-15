package uncover.voice

import android.media.*
import android.os.Handler
import android.os.Looper
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread

internal data class CapturedVoiceFrame(val samples: ShortArray, val startNs: Long)

/** AudioRecord never waits for KWS, ASR, synthesis or network callbacks. */
internal class VoiceCaptureDriver(private val state: (Boolean) -> Unit, private val failure: (Throwable) -> Unit) {
  private val frames = ArrayBlockingQueue<CapturedVoiceFrame>(32)
  @Volatile private var stopped = false
  @Volatile private var recorder: AudioRecord? = null
  @Volatile private var silenced = false
  private var worker: Thread? = null
  fun start(ready: () -> Unit) {
    if (stopped) return
    worker = thread(name = "BLACK-capture") {
      android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_AUDIO)
      var callback: AudioManager.AudioRecordingCallback? = null
      try {
        val minimum = AudioRecord.getMinBufferSize(16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
        check(minimum > 0) { "麦克风不支持 16 kHz 单声道输入。" }
        // Software AEC owns this route. Do not also enable AcousticEchoCanceler.
        val input = AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, 16000, AudioFormat.CHANNEL_IN_MONO,
          AudioFormat.ENCODING_PCM_16BIT, maxOf(minimum * 4, 64000))
        recorder = input
        check(input.state == AudioRecord.STATE_INITIALIZED) { "麦克风初始化失败。" }
        callback = object : AudioManager.AudioRecordingCallback() {
          override fun onRecordingConfigChanged(configs: MutableList<AudioRecordingConfiguration>?) {
            configs?.firstOrNull { it.clientAudioSessionId == input.audioSessionId }?.let {
              if (!stopped && silenced != it.isClientSilenced) { silenced = it.isClientSilenced; state(silenced) }
            }
          }
        }.also { input.registerAudioRecordingCallback({ r -> Handler(Looper.getMainLooper()).post(r) }, it) }
        if (stopped) return@thread
        input.startRecording()
        check(input.recordingState == AudioRecord.RECORDSTATE_RECORDING) { "系统没有启动录音。" }
        val clock = VoiceCaptureClock(System.nanoTime()); val stamp = AudioTimestamp(); var total = 0L
        if (!stopped) ready()
        while (!stopped) {
          val pcm = ShortArray(512); var filled = 0
          while (!stopped && filled < pcm.size) {
            val count = input.read(pcm, filled, pcm.size - filled)
            if (count < 0) error("麦克风读取失败 ($count)。")
            if (count > 0) { filled += count; total += count }
          }
          if (stopped) break
          val timestamped = input.getTimestamp(stamp, AudioTimestamp.TIMEBASE_MONOTONIC) == AudioRecord.SUCCESS
          val start = clock.frame(total, pcm.size, if (timestamped) stamp.framePosition else null, if (timestamped) stamp.nanoTime else null)
          check(frames.offer(CapturedVoiceFrame(pcm, start))) { "语音处理持续落后，录音队列已满；请重新开启语音。" }
        }
      } catch (error: Throwable) { if (!stopped) failure(error) }
      finally {
        callback?.let { runCatching { recorder?.unregisterAudioRecordingCallback(it) } }
        runCatching { recorder?.stop() }; recorder?.release(); recorder = null
      }
    }
  }
  fun next(): CapturedVoiceFrame? = frames.poll(100, TimeUnit.MILLISECONDS)
  fun stop() { stopped = true; runCatching { recorder?.stop() }; worker?.interrupt(); frames.clear() }
}
