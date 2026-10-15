package uncover.voice

import java.nio.ByteBuffer
import java.nio.ByteOrder
import org.junit.Assert.*
import org.junit.Test

class VoiceAudioPolicyTest {
  @Test fun oneActivationRequestsModelInsteadOfPlayingAnotherReply() {
    assertEquals(VoiceActivation.Action.REQUEST, VoiceActivation.decide(true, "wake"))
    for (phase in listOf("speaking", "processing", "listening")) assertEquals(VoiceActivation.Action.LISTEN, VoiceActivation.decide(true, phase))
    assertEquals(VoiceActivation.Action.WAIT, VoiceActivation.decide(false, "starting"))
  }
  @Test fun captureFallbackDoesNotTreatBufferedSamplesAsNewAudio() {
    val clock = VoiceCaptureClock(1_000_000_000L)
    assertEquals(1_000_000_000L, clock.frame(512, 512))
    // Inference can take arbitrarily long; no wall-clock read time enters the fallback.
    assertEquals(1_032_000_000L, clock.frame(1024, 512))
    assertEquals(1_100_000_000L, clock.frame(2112, 512, 1600, 1_100_000_000L))
    assertEquals(1_132_000_000L, clock.frame(2624, 512))
  }
  @Test fun clicksDoNotBargeButOrdinarySustainedSpeechDoes() {
    val gate = VoiceSpeechGate()
    repeat(4) { assertFalse(gate.observe(.95f)) }
    assertFalse(gate.observe(.1f))
    repeat(4) { assertFalse(gate.observe(.9f)) }
    assertTrue(gate.observe(.9f)); gate.reset(); assertFalse(gate.observe(.9f))
  }
  @Test fun renderClockAlignsReferenceAndNeverFeedsUnplayedAudioAfterStop() {
    val ref = VoiceRenderReference(); val clip = ShortArray(16000) { (it % 1000).toShort() }
    val id = ref.begin(clip, 1_000_000_000L)
    ref.clock(id, 1600, 1_200_000_000L) // Actual render began at 1.1 seconds, not the prepare time.
    assertArrayEquals(clip.copyOfRange(1600, 2112), ref.frame(1_200_000_000L, 512))
    ref.end(id, 2000)
    val tail = ref.frame(1_200_000_000L, 512)
    assertEquals(0, tail[450].toInt()); assertEquals(clip[1700], tail[100])
    assertTrue(ref.frame(3_000_000_000L, 512).all { it == 0.toShort() })
  }
  @Test fun cancellationRetainsAlreadyRenderedAcousticTail() {
    val ref = VoiceRenderReference(); val id = ref.begin(shortArrayOf(1, 2, 3, 4), 1_000_000_000L)
    ref.end(id, 3)
    assertArrayEquals(shortArrayOf(1, 2, 3, 0), ref.frame(1_000_000_000L, 4))
    ref.clear(); assertArrayEquals(ShortArray(4), ref.frame(1_000_000_000L, 4))
  }
  private fun wav(channels: Int, rate: Int, values: ShortArray): ByteArray {
    val buffer = ByteBuffer.allocate(44 + values.size * 2).order(ByteOrder.LITTLE_ENDIAN)
    buffer.put("RIFF".toByteArray()).putInt(buffer.capacity() - 8).put("WAVEfmt ".toByteArray()).putInt(16)
      .putShort(1).putShort(channels.toShort()).putInt(rate).putInt(rate * channels * 2).putShort((channels * 2).toShort()).putShort(16)
      .put("data".toByteArray()).putInt(values.size * 2)
    values.forEach { buffer.putShort(it) }; return buffer.array()
  }
  @Test fun pcmReadsSystemTtsMonoAndStereoWithoutTruncation() {
    val mono = VoicePcm.read(wav(1, 24000, shortArrayOf(10, 20, 30)))
    assertEquals(24000, mono.sampleRate); assertArrayEquals(shortArrayOf(10, 20, 30), mono.samples)
    val stereo = VoicePcm.read(wav(2, 16000, shortArrayOf(100, 300, -100, -300)))
    assertArrayEquals(shortArrayOf(200, -200), stereo.samples)
  }
  @Test fun corruptSpeechFileFailsExplicitly() {
    try { VoicePcm.read(byteArrayOf(1, 2)); fail("Must reject corrupt audio") } catch (_: IllegalArgumentException) {}
  }
  @Test fun speechChunksPreferSentencesButKeepEveryCharacter() {
    val text = "我已记录早餐。现在可以开始训练！还有后续内容😀"
    val chunks = VoiceSpeechChunks.split(text, 160)
    assertEquals("我已记录早餐。", chunks.first()); assertEquals(text, chunks.joinToString(""))
  }
}
