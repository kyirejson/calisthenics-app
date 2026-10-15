package uncover.voice

import java.nio.ByteBuffer
import java.nio.ByteOrder
import org.junit.Assert.*
import org.junit.Test

class VoiceAudioPolicyTest {
  @Test fun recognitionSegmentsKeepOneTurnUntilTheModelCommits() {
    val turn = VoiceTurnBuffer(); turn.activate()
    assertEquals("BLACK", turn.text)
    turn.update("帮我播放"); turn.seal(); turn.update("我喜欢的歌")
    assertEquals("帮我播放 我喜欢的歌", turn.text)
    turn.seal(); assertEquals("帮我播放 我喜欢的歌", turn.text)
    turn.clear(); assertEquals("", turn.text); assertFalse(turn.wake)
  }
  @Test fun aPartialRevisionReplacesRatherThanDuplicatesTheAsrHypothesis() {
    val turn = VoiceTurnBuffer(); turn.update("今天"); turn.update("今天吃了两个鸡蛋")
    assertEquals("今天吃了两个鸡蛋", turn.text); turn.seal(); turn.update("和牛奶")
    assertEquals("今天吃了两个鸡蛋 和牛奶", turn.text)
  }
  @Test fun ownerVerificationRejectsDifferentSpeakersAndInvalidVectors() {
    val profile = VoiceIdentity.enroll(listOf(floatArrayOf(1f, .1f, 0f), floatArrayOf(1f, .12f, 0f), floatArrayOf(1f, .08f, 0f)))
    assertTrue(VoiceIdentity.accepts(profile, floatArrayOf(1f, .13f, 0f), 1500))
    assertFalse(VoiceIdentity.accepts(profile, floatArrayOf(0f, .1f, 1f), 1500))
    assertFalse(VoiceIdentity.accepts(profile, floatArrayOf(1f, .1f, 0f), 160))
    try { VoiceIdentity.enroll(listOf(floatArrayOf(1f, 0f), floatArrayOf(0f, 1f), floatArrayOf(1f, 0f))); fail("Mixed enrollment must not replace owner") } catch (_: IllegalArgumentException) {}
    try { VoiceIdentity.normalized(floatArrayOf(Float.NaN)); fail("Invalid embedding") } catch (_: IllegalArgumentException) {}
  }
  @Test fun nearlyIdenticalEnrollmentDoesNotOverfitTheAcceptanceThreshold() {
    val profile = VoiceIdentity.enroll(List(3) { floatArrayOf(1f, 0f) })
    val changedSpeech = floatArrayOf(.55f, kotlin.math.sqrt(1f - .55f * .55f))
    assertTrue(VoiceIdentity.accepts(profile, changedSpeech, 1600))
    assertFalse(VoiceIdentity.accepts(profile, floatArrayOf(.35f, kotlin.math.sqrt(1f - .35f * .35f)), 1600))
    val borderline = floatArrayOf(.45f, kotlin.math.sqrt(1f - .45f * .45f))
    assertTrue(VoiceIdentity.accepts(profile, borderline, 1600))
    assertFalse("Short voice needs stronger evidence, not just the wake transcript", VoiceIdentity.accepts(profile, borderline, 500))
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
