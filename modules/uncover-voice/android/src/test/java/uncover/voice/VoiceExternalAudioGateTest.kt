package uncover.voice

import org.junit.Assert.*
import org.junit.Test

class VoiceExternalAudioGateTest {
  @Test fun navigationIsSuppressedAtCaptureTimeIncludingBufferedFramesAndTheAcousticTail() {
    val gate = VoiceExternalAudioGate()
    gate.update(true, 1_000_000_000L); gate.update(false, 2_000_000_000L)
    assertFalse(gate.suppressed(800_000_000L)); assertTrue(gate.suppressed(900_000_000L))
    assertTrue(gate.suppressed(2_600_000_000L)); assertFalse(gate.suppressed(2_800_000_000L))
    gate.update(false, 3_000_000_000L); assertFalse(gate.suppressed(3_100_000_000L))
  }
  @Test fun repeatedUnrelatedCallbacksDoNotExtendTheSuppressionForever() {
    val gate = VoiceExternalAudioGate(); gate.update(true, 1_000_000_000L); gate.update(false, 2_000_000_000L)
    repeat(20) { gate.update(false, 3_000_000_000L + it) }; assertFalse(gate.suppressed(3_000_000_000L))
  }
  @Test fun taskSummaryReturnsToWakeOnlyAfterPlaybackAndPreservesNewUserSpeech() {
    val quiet = VoiceSessionController(); quiet.ready(); quiet.listen(); val token = quiet.begin("reply")
    assertTrue(quiet.prepare("reply")); quiet.render("reply", token, true); assertEquals("speaking", quiet.phase)
    quiet.complete("reply", token, true); assertEquals("wake", quiet.phase)
    val busy = VoiceSessionController(); busy.ready(); busy.listen("user"); val other = busy.begin("answer")
    busy.prepare("answer"); busy.candidate("new-user"); busy.hearing("new-user"); busy.partial("new-user", "等等")
    busy.complete("answer", other, true); assertEquals("等等", busy.snapshot.draft); assertNotEquals("wake", busy.phase)
  }
  @Test fun consecutivePlaybackKindsKeepTheirCaptureIntervalsAndReleaseAfterTheTail() {
    val gate = VoiceExternalAudioGate()
    gate.update(true, 1_000_000_000L, "navigation")
    gate.update(true, 2_000_000_000L, "external_speech")
    assertEquals("navigation", gate.state(1_500_000_000L).reason)
    assertEquals("external_speech", gate.state(2_100_000_000L).reason)
    gate.update(false, 3_000_000_000L)
    assertTrue(gate.state(3_500_000_000L).tail)
    gate.update(false, 4_000_000_000L)
    assertFalse(gate.state(4_000_000_000L).suppressed)
  }
  @Test fun externalPlaybackDoesNotInterruptOutputOrEraseTheInputDraft() {
    val session = VoiceSessionController(); session.ready(); session.listen()
    val generation = session.begin("answer"); session.prepare("answer"); session.render("answer", generation, true)
    session.externalAudio(true, "navigation", true)
    assertEquals("speaking", session.phase); assertEquals("answer", session.turnId)
    assertEquals(generation, session.generation); assertFalse(session.snapshot.held)
    session.candidate("user"); session.partial("user", "先去刚才的地方")
    session.externalAudio(false, "none", true)
    assertEquals("先去刚才的地方", session.snapshot.draft); assertFalse(session.snapshot.inputSuppressed)
  }
}
