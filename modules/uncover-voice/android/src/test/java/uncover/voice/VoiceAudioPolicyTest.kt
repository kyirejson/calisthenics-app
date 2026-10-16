package uncover.voice

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
  @Test fun aCandidateNeedsBothSustainedCleanSpeechAndTextBeforeHoldingPlayback() {
    val gate = VoiceSpeechGate()
    repeat(5) { gate.observe(.95f) }; assertFalse(gate.confirm("停"))
    repeat(3) { assertFalse(gate.observe(.95f)) }
    assertFalse(gate.confirm("…")); assertFalse(gate.confirm(""))
    assertTrue(gate.confirm("停")); assertFalse(gate.confirm("停"))
    gate.reset(); repeat(7) { gate.observe(.95f) }; gate.observe(.1f)
    assertFalse(gate.confirm("噪声残留文字"))
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
  @Test fun localPcmRetainsCompleteSamplesAndItsOriginalRate() {
    val pcm = shortArrayOf(10, 20, 30)
    val audio = VoicePcm(pcm, 44100)
    assertEquals(44100, audio.sampleRate); assertArrayEquals(pcm, audio.samples)
  }
  @Test fun invalidLocalAudioIsNotPassedToTheRenderer() {
    for (rate in listOf(0, 7999, 192001)) {
      try { VoicePcm(shortArrayOf(1), rate); fail("Invalid sample rate") } catch (_: IllegalArgumentException) {}
    }
    try { VoicePcm(ShortArray(0), 16000); fail("Empty synthesis") } catch (_: IllegalArgumentException) {}
  }
  @Test fun speechChunksPreferSentencesButKeepEveryCharacter() {
    val text = "我已记录早餐。现在可以开始训练！还有后续内容😀"
    val chunks = VoiceSpeechChunks.split(text, 160)
    assertEquals("我已记录早餐。", chunks.first().text)
    assertEquals(text, chunks.joinToString("") { text.substring(it.start, it.end) })
  }
}
