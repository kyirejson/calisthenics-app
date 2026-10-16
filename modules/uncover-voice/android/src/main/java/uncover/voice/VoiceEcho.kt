package uncover.voice

/** Local AEC3 processing. Each native instance belongs to one processing worker. */
internal class VoiceEcho(frameSize: Int) : AutoCloseable {
  private var pointer = nativeCreate(frameSize)
  private val observations = DoubleArray(11)
  var evidence = VoiceAcousticEvidence(); private set
  init { check(pointer != 0L) { "本地回声消除器初始化失败。" } }
  fun process(captured: ShortArray, rendered: ShortArray): FloatArray {
    val output = ShortArray(captured.size)
    check(nativeProcess(pointer, captured, rendered, output, observations)) { "回声处理帧或证据无效。" }
    evidence = VoiceAcousticEvidence.from(observations)
    return FloatArray(output.size) { output[it] / 32768f }
  }
  fun resample(audio: ShortArray, rate: Int): ShortArray = if (rate == 16000) audio else
    nativeResample(audio, rate) ?: error("语音音频重采样失败。")
  override fun close() { if (pointer != 0L) { nativeRelease(pointer); pointer = 0 } }
  private external fun nativeCreate(frameSize: Int): Long
  private external fun nativeProcess(pointer: Long, captured: ShortArray, rendered: ShortArray, output: ShortArray, evidence: DoubleArray): Boolean
  private external fun nativeRelease(pointer: Long)
  private external fun nativeResample(audio: ShortArray, rate: Int): ShortArray?
  companion object { init { System.loadLibrary("black-echo") } }
}
