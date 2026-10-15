package uncover.voice

import com.k2fsa.sherpa.onnx.SpeakerEmbeddingExtractor

/** Local encoder adapter; profiles retain features only, never the enrollment PCM. */
internal class VoiceBiometrics(private val extractor: SpeakerEmbeddingExtractor) {
  fun samples(frames: List<VoiceAudioFrame>): FloatArray {
    val output = FloatArray(frames.sumOf { it.samples.size }); var offset = 0
    frames.forEach { frame -> System.arraycopy(frame.samples, 0, output, offset, frame.samples.size); offset += frame.samples.size }
    return output
  }
  fun embedding(frames: List<VoiceAudioFrame>) = embedding(samples(frames))
  fun embedding(samples: FloatArray): FloatArray? {
    val stream = extractor.createStream()
    try {
      stream.acceptWaveform(samples, 16000); stream.inputFinished()
      return if (extractor.isReady(stream)) VoiceIdentity.normalized(extractor.compute(stream)) else null
    } finally { stream.release() }
  }
  fun shortViews(samples: FloatArray): List<FloatArray> = listOf(5120, 10240).flatMap { size ->
    if (samples.size < size) emptyList() else (0..5).mapNotNull { index ->
      val start = (samples.size - size) * index / 5
      embedding(samples.copyOfRange(start, start + size))
    }
  }
}
