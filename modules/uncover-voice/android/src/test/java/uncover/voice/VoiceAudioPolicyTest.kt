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
    repeat(4) { assertEquals(VoiceSpeechGate.Event.NONE, gate.observe(.95f, VoiceSoundSource.NEAR_END)) }
    assertEquals(VoiceSpeechGate.Event.NONE, gate.observe(.1f, VoiceSoundSource.NEAR_END))
    repeat(4) { assertEquals(VoiceSpeechGate.Event.NONE, gate.observe(.9f, VoiceSoundSource.NEAR_END)) }
    assertEquals(VoiceSpeechGate.Event.CANDIDATE, gate.observe(.9f, VoiceSoundSource.NEAR_END))
    gate.reset(); assertEquals(VoiceSpeechGate.Event.NONE, gate.observe(.9f, VoiceSoundSource.NEAR_END))
  }
  @Test fun hearingNeedsSustainedIndependentSpeechAndNeverAnAsrString() {
    val gate = VoiceSpeechGate()
    repeat(7) { assertNotEquals(VoiceSpeechGate.Event.HEARING, gate.observe(.95f, VoiceSoundSource.NEAR_END)) }
    assertEquals(VoiceSpeechGate.Event.HEARING, gate.observe(.95f, VoiceSoundSource.NEAR_END))
    assertEquals(VoiceSpeechGate.Event.NONE, gate.observe(.95f, VoiceSoundSource.NEAR_END))
    gate.reset(); repeat(7) { gate.observe(.95f, VoiceSoundSource.NEAR_END) }
    gate.observe(.95f, VoiceSoundSource.UNKNOWN)
    assertEquals(VoiceSpeechGate.Event.NONE, gate.observe(.95f, VoiceSoundSource.NEAR_END))
  }
  @Test fun aPlaybackCandidateCannotBypassConfirmationThroughAnAsrModelRequest() {
    assertFalse(VoiceSpeechGate.Event.CANDIDATE.startsRecognition(true))
    assertTrue(VoiceSpeechGate.Event.CANDIDATE.startsRecognition(false))
    assertTrue(VoiceSpeechGate.Event.HEARING.startsRecognition(true))
    assertTrue(VoiceSpeechGate.Event.HEARING.startsRecognition(false))
    assertFalse(VoiceSpeechGate.Event.NONE.startsRecognition(true))
    assertFalse(VoiceSpeechGate.Event.NONE.startsRecognition(false))
  }
  @Test fun evenContinuousHighVadEchoAndUnknownCannotPauseOrChangeTheAnswer() {
    for (source in listOf(VoiceSoundSource.ECHO, VoiceSoundSource.UNKNOWN)) {
      val c = VoiceSessionController(); c.ready(); val token = c.begin("answer"); c.prepare("answer"); c.render("answer", token, true)
      val gate = VoiceSpeechGate()
      repeat(1000) {
        when (gate.observe(.999f, source)) {
          VoiceSpeechGate.Event.CANDIDATE -> c.candidate("echo")
          VoiceSpeechGate.Event.HEARING -> c.hearing("echo")
          else -> Unit
        }
      }
      assertFalse(c.snapshot.held); assertEquals("speaking", c.phase); assertEquals("answer", c.turnId)
      assertEquals("", c.snapshot.draft); assertFalse(gate.candidate)
    }
  }
  @Test fun playbackNeedsAecEvidenceNotJustGoodErleOrQuietOutput() {
    val valid = VoiceAcousticEvidence(8, 8, 0, 8, 0, 1000.0, 50.0, 20.0, 80.0, 30.0)
    assertEquals(VoiceSoundSource.NEAR_END, valid.source(true, true))
    assertEquals(VoiceSoundSource.UNKNOWN, valid.source(true, false))
    for (uncertain in listOf(valid.copy(nearendBlocks = 0), valid.copy(reliableBlocks = 7), valid.copy(saturatedBlocks = 1),
      valid.copy(nearendPower = Double.NaN), valid.copy(echoPower = 500.0), VoiceAcousticEvidence())) {
      assertEquals(VoiceSoundSource.UNKNOWN, uncertain.source(true, true))
    }
    assertEquals(VoiceSoundSource.ECHO, valid.copy(nearendBlocks = 0, echoBlocks = 8).source(true, true))
    // Same voice/words are valid input when there is no playback reference. No text blacklist.
    assertEquals(VoiceSoundSource.NEAR_END, VoiceAcousticEvidence().source(false, false))
  }
  @Test fun renderClockAlignsReferenceAndNeverFeedsUnplayedAudioAfterStop() {
    val ref = VoiceRenderReference(); val clip = ShortArray(16000) { (it % 1000).toShort() }
    val id = ref.begin(clip, 1_000_000_000L)
    ref.clock(id, 1600, 1_200_000_000L) // Actual render began at 1.1 seconds, not the prepare time.
    assertArrayEquals(clip.copyOfRange(1600, 2112), ref.read(1_200_000_000L, 512).samples)
    ref.end(id, 2000)
    val tail = ref.read(1_200_000_000L, 512).samples
    assertEquals(0, tail[450].toInt()); assertEquals(clip[1700], tail[100])
    assertTrue(ref.read(3_000_000_000L, 512).samples.all { it == 0.toShort() })
  }
  @Test fun cancellationRetainsAlreadyRenderedAcousticTail() {
    val ref = VoiceRenderReference(); val id = ref.begin(shortArrayOf(1, 2, 3, 4), 1_000_000_000L)
    ref.end(id, 3)
    assertArrayEquals(shortArrayOf(1, 2, 3, 0), ref.read(1_000_000_000L, 4).samples)
    ref.clear(); assertArrayEquals(ShortArray(4), ref.read(1_000_000_000L, 4).samples)
  }
  @Test fun writeAheadFallbackSilenceAndTailRemainProtectedUntilTheirRealEnd() {
    val ref = VoiceRenderReference(); val id = ref.begin(ShortArray(1600), 1_000_000_000L)
    val pending = ref.read(950_000_000L, 512)
    assertTrue(pending.renderProtected); assertFalse(pending.reliable)
    ref.clock(id, 0, 1_000_000_000L)
    assertTrue(ref.read(1_050_000_000L, 512).reliable)
    ref.end(id, 800)
    val tail = ref.read(1_100_000_000L, 512)
    assertTrue(tail.samples.all { it == 0.toShort() }); assertTrue(tail.renderProtected)
    assertFalse(ref.read(1_800_000_000L, 512).renderProtected)
  }
  @Test fun routeChangesInvalidateEvidenceAndCannotReuseOldClocks() {
    val ref = VoiceRenderReference(); val id = ref.begin(ShortArray(16000), 1_000_000_000L)
    ref.clock(id, 0, 1_000_000_000L)
    val old = ref.read(1_050_000_000L, 512); assertTrue(old.reliable)
    ref.routeChanged(1_100_000_000L)
    val changed = ref.read(1_150_000_000L, 512)
    assertTrue(changed.renderProtected); assertFalse(changed.reliable); assertNotEquals(old.epoch, changed.epoch)
    ref.clock(id, 2400, 1_150_000_000L)
    assertFalse(ref.read(1_200_000_000L, 512).reliable)
    assertTrue(ref.read(1_850_000_000L, 512).reliable)
  }
  @Test fun queuedCaptureDoesNotLoseItsReferenceWhenTheProducerWritesAhead() {
    val ref = VoiceRenderReference(); val id = ref.begin(ShortArray(512) { 1234 }, 1_000_000_000L)
    ref.clock(id, 0, 1_000_000_000L)
    ref.begin(ShortArray(512) { 9876 }, 2_200_000_000L)
    val queued = ref.read(1_000_000_000L, 512)
    assertTrue(queued.renderProtected); assertTrue(queued.reliable)
    assertEquals(1234.toShort(), queued.samples.first())
  }
  @Test fun largeHardwareClockCorrectionInvalidatesOldAecEvidence() {
    val clock = VoiceCaptureClock(1_000_000_000L)
    clock.frame(512, 512, 512, 1_032_000_000L); assertEquals(0L, clock.revision)
    clock.frame(1024, 512, 1024, 1_264_000_000L); assertEquals(1L, clock.revision)
    val ref = VoiceRenderReference(); val id = ref.begin(ShortArray(16000), 1_000_000_000L)
    ref.clock(id, 0, 1_000_000_000L); val old = ref.read(1_100_000_000L, 512)
    ref.clock(id, 1600, 1_300_000_000L)
    val corrected = ref.read(1_350_000_000L, 512)
    assertNotEquals(old.epoch, corrected.epoch); assertFalse(corrected.reliable); assertTrue(corrected.renderProtected)
  }
  @Test fun aQueuedHearingEventFromAnOldRouteCannotPauseCurrentPlayback() {
    val ref = VoiceRenderReference(); val observed = ref.read(1_000_000_000L, 512)
    val controller = VoiceSessionController(); controller.ready(); val token = controller.begin("answer")
    controller.prepare("answer"); controller.render("answer", token, true); controller.candidate("input")
    ref.routeChanged(1_100_000_000L)
    // Same guard used by the Service when an audio-worker event reaches its main queue.
    if (ref.isCurrent(observed.epoch)) controller.hearing("input")
    assertFalse(controller.snapshot.held); assertEquals("speaking", controller.phase)
    assertTrue(ref.isCurrent(ref.read(1_200_000_000L, 512).epoch))
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
