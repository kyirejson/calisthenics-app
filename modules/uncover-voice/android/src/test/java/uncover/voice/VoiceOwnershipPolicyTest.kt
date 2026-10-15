package uncover.voice

import org.junit.Assert.*
import org.junit.Test

class VoiceOwnershipPolicyTest {
  private fun frame(value: Float, time: Long = 0) = VoiceAudioFrame(FloatArray(512) { value }, true, time)
  @Test fun aVerifiedPacketCannotAuthorizeTheNextSpeaker() {
    var comparisons = 0
    val packets = VoicePacketGate { frames, _ -> comparisons++; frames.all { it.samples[0] > 0 } }
    repeat(20) { packets.append(frame(1f)) }
    val first = packets.resolve(false)!!; assertTrue(first.accepted)
    repeat(20) { packets.append(frame(-1f)) }
    assertNull(packets.resolve(false))
    val second = packets.resolve(true)!!
    assertFalse(second.accepted); assertEquals(3, comparisons)
    assertTrue(first.frames.all { it.samples[0] > 0 }); assertFalse(packets.pending)
  }
  @Test fun aShortTailCannotBorrowThePreviousSpeakersVoice() {
    val inputs = mutableListOf<List<VoiceAudioFrame>>()
    val packets = VoicePacketGate { frames, _ -> inputs.add(frames); frames.all { it.samples[0] > 0 } }
    repeat(20) { packets.append(frame(1f)) }; assertTrue(packets.resolve(false)!!.accepted)
    repeat(6) { packets.append(frame(-1f)) }
    assertFalse(packets.resolve(true)!!.accepted)
    assertEquals("Too short to verify; never combine it with earlier owner audio", 1, inputs.size)
    repeat(10) { packets.append(frame(-1f)) }
    assertFalse(packets.resolve(true)!!.accepted)
    assertTrue(inputs.last().all { it.samples[0] < 0 })
  }
  @Test fun silenceDoesNotInvalidateAlreadyCertifiedAudio() {
    val packets = VoicePacketGate { _, _ -> true }
    repeat(20) { packets.append(frame(1f)) }; assertTrue(packets.resolve(false)!!.accepted)
    repeat(11) { packets.append(VoiceAudioFrame(FloatArray(512), false)) }
    assertNull(packets.resolve(true)); assertFalse(packets.pending)
  }
  @Test fun strangersDoNotRevokeAReadOnlyDecisionButNewOwnerAudioDoes() {
    val control = VoiceTurnControl(); control.owner(0); assertTrue(control.issue("first", 1000))
    // Unverified capture never calls owner(): the same completed decision survives.
    assertTrue(control.active("first")); assertTrue(control.submit("first")); assertFalse(control.active("first"))
    assertTrue(control.consume("first", "respond", 2000))
    control.owner(3000); assertTrue(control.issue("old", 4000)); assertTrue(control.submit("old"))
    control.owner(4100); assertFalse(control.consume("old", "respond", 4200))
  }
  @Test fun waitAndFailuresExpireEvenOnTheFirstWake() {
    for (decision in listOf("wait", "error")) {
      val control = VoiceTurnControl(); control.owner(100); control.issue("wake", 1000); control.submit("wake")
      assertTrue(control.consume("wake", decision, 1500)); assertFalse(control.expired(20099)); assertTrue(control.expired(20100))
      control.reset(); assertFalse(control.hasOwner); assertFalse(control.active("wake"))
    }
  }
  @Test fun unchangedInputIsNotBilledRepeatedlyAndErrorsRetryOnlyTheAssessment() {
    val control = VoiceTurnControl(); control.owner(0); control.issue("one", 1000); control.submit("one"); control.consume("one", "error", 1100)
    assertFalse(control.issue("too-soon", 2000)); assertTrue(control.issue("two", 2300))
    control.submit("two"); control.consume("two", "error", 2400); assertFalse(control.issue("third", 9000))
    control.owner(9100); assertTrue(control.issue("new-text", 10000))
  }
  @Test fun cancellingOrDeletingInvalidatesTheDiskCommitTicketImmediately() {
    val gate = VoiceRegistrationGate(); val old = gate.begin(); gate.cancel(); var wrote = false
    try { gate.commit(old) { wrote = true }; fail("Cancelled registration committed") } catch (_: IllegalStateException) {}
    assertFalse(wrote)
    val next = gate.begin(); gate.invalidate { wrote = false }
    try { gate.commit(next) { wrote = true }; fail("Deleted registration returned") } catch (_: IllegalStateException) {}
    assertFalse(wrote)
    val valid = gate.begin(); gate.commit(valid) { wrote = true }; assertTrue(wrote); assertFalse(gate.isActive(valid))
  }
  @Test fun anOldServiceCannotCommitIntoANewerEnrollment() {
    val gate = VoiceRegistrationGate(); val old = gate.begin(); val current = gate.begin()
    try { gate.commit(old) { fail("Obsolete enrollment committed") }; fail() } catch (_: IllegalStateException) {}
    assertTrue(gate.isActive(current)); gate.commit(current) { Unit }
  }
  @Test fun wakeTimestampWindowExcludesAnEarlierSpeaker() {
    val window = VoiceWakeWindow()
    repeat(64) { i -> window.append(frame(if (i < 30) -1f else 1f, i * 32L)) }
    val clip = window.clip(floatArrayOf(1.20f, 1.40f))!!
    assertTrue(clip.frames.all { it.samples[0] > 0 }); assertTrue(clip.tail.isNotEmpty())
    assertNull(window.clip(floatArrayOf(Float.NaN)))
  }
  @Test fun aKeywordWithoutPersonalTemplatesNeverPassesIdentity() {
    val vector = floatArrayOf(1f, 0f)
    val base = VoiceIdentity.enroll(List(3) { vector })
    assertFalse(VoiceIdentity.acceptsWake(base, vector, 500))
    val full = VoiceIdentity.complete(base, List(3) { listOf(vector) }, List(3) { vector }, vector, 400)
    assertTrue(VoiceIdentity.acceptsWake(full, vector, 400))
    assertFalse(VoiceIdentity.acceptsWake(full, floatArrayOf(0f, 1f), 400))
    try { VoiceIdentity.complete(base, List(3) { listOf(vector) }, List(3) { vector }, floatArrayOf(0f, 1f), 400); fail("Failed read-back committed") } catch (_: IllegalArgumentException) {}
  }
}
