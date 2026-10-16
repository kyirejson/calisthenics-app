package uncover.voice

import org.junit.Assert.*
import org.junit.Test

class VoiceSessionControllerTest {
  @Test fun receivingTextIsNotEvidenceOfAudiblePlayback() {
    val c = VoiceSessionController(); c.ready(); c.begin("answer")
    assertTrue(c.prepare("answer"))
    assertNotEquals("No audio has reached the player yet", "speaking", c.phase)
    assertEquals("synthesizing", c.phase)
    assertTrue(c.render("answer", c.generation, true)); assertEquals("speaking", c.phase)
    assertTrue(c.render("answer", c.generation, false)); assertEquals("buffering", c.phase)
  }
  @Test fun finishingOutputMustNotEraseConcurrentInput() {
    val c = VoiceSessionController(); c.ready(); val token = c.begin("answer"); c.candidate("input")
    assertTrue(c.complete("answer", token))
    assertEquals(VoiceSessionController.Input.CANDIDATE, c.snapshot.input)
  }
  @Test fun inputAndOutputRemainIndependent() {
    val c = VoiceSessionController(); c.ready(); c.listen(); val token = c.begin("one")
    assertTrue(c.prepare("one")); assertTrue(c.render("one", token, true)); c.candidate("input")
    assertEquals(VoiceSessionController.Output.PLAYING, c.snapshot.output)
    assertEquals(VoiceSessionController.Input.CANDIDATE, c.snapshot.input)
    assertEquals("speaking", c.phase) // A suspected sound alone is not an interruption.
    c.settle("input", "ignore"); assertTrue(c.complete("one", token)); assertEquals("listening", c.phase)
  }
  @Test fun idleCancellationCannotArmCaptureAndStaleResultsCannotSpeak() {
    val c = VoiceSessionController(); c.ready(); assertNull(c.cancel()); assertEquals("wake", c.phase)
    val old = c.begin("old"); assertEquals("old", c.cancel("old")); val current = c.begin("current")
    assertFalse(c.prepare("old")); assertFalse(c.render("old", old, true)); assertFalse(c.complete("old", old)); assertNull(c.cancel("old"))
    assertTrue(c.active("current")); assertTrue(c.complete("current", current))
  }
  @Test fun waitOnlyReevaluatesAfterNewInputAndStaleDecisionCannotCommit() {
    val c = VoiceTurnControl(); c.revise("帮我播放"); assertTrue(c.issue("first", 900)); c.submit("first"); c.consume("first", "wait", 1000)
    c.revise("帮我播放"); assertFalse(c.issue("unchanged", 10000))
    c.revise("帮我播放我喜欢的歌"); assertTrue(c.issue("new", 12000))
    c.submit("new"); c.revise("帮我播放我喜欢的歌单"); assertFalse(c.consume("new", "respond", 12200))
  }
  @Test fun blockingOrStoppingInvalidatesOutput() {
    val c = VoiceSessionController(); c.ready(); val token = c.begin("t"); assertEquals("t", c.block(true))
    assertFalse(c.active("t")); assertFalse(c.complete("t", token)); assertEquals("blocked", c.phase)
    assertNull(c.turnId); assertEquals(VoiceSessionController.Output.IDLE, c.snapshot.output)
    c.stop(); assertEquals("stopped", c.phase)
  }
  @Test fun confirmedSpeechHoldsRatherThanDestroysTheReplyAndWaitPreservesInput() {
    val c = VoiceSessionController(); c.ready(); val token = c.begin("answer"); c.prepare("answer"); c.render("answer", token, true)
    c.candidate("input"); c.partial("input", "我还想"); c.hearing("input")
    assertTrue(c.snapshot.held); assertEquals("listening", c.phase); assertEquals("answer", c.turnId)
    c.assessing("input"); assertEquals("assessing", c.phase)
    c.settle("input", "wait"); assertTrue(c.snapshot.held); assertEquals("我还想", c.snapshot.draft)
    c.partial("input", "我还想补充一句"); assertEquals("answer", c.turnId)
    c.cancel(preserveInput = true); assertEquals("我还想补充一句", c.snapshot.draft)
    assertFalse(c.render("answer", token, true)); assertFalse(c.complete("answer", token))
    c.begin("next"); assertEquals("processing", c.phase); assertFalse(c.snapshot.held); assertEquals("", c.snapshot.draft)
  }
  @Test fun unrelatedSpeechOrFailedAssessmentResumesTheSameTurnWithoutRegeneratingIt() {
    for (action in listOf("ignore", "error")) {
      val c = VoiceSessionController(); c.ready(); val token = c.begin("answer"); c.prepare("answer"); c.render("answer", token, true)
      c.candidate("input"); c.hearing("input"); c.partial("input", "识别草稿")
      c.settle("input", action)
      assertFalse(c.snapshot.held); assertEquals("speaking", c.phase); assertEquals(token, c.generation)
      assertEquals(if (action == "ignore") "" else "识别草稿", c.snapshot.draft)
    }
  }
  @Test fun oneClockOwnsIdleAndExpiredHoldsAndNeverSleepsAnActiveReply() {
    var now = 0L; val c = VoiceSessionController { now }; c.ready(); c.listen("input")
    now = 30001; assertEquals(VoiceSessionController.Tick.IDLE, c.tick()); assertEquals("wake", c.phase)
    c.listen(); c.begin("answer"); c.prepare("answer"); c.render("answer", c.generation, true)
    now += 50000; assertEquals(VoiceSessionController.Tick.NONE, c.tick()); assertEquals("speaking", c.phase)
    c.candidate("new"); c.hearing("new"); now += 29999; assertEquals(VoiceSessionController.Tick.NONE, c.tick())
    c.partial("new", "继续说"); now += 29999; assertEquals(VoiceSessionController.Tick.NONE, c.tick())
    now += 2; assertEquals(VoiceSessionController.Tick.RESUME, c.tick()); assertEquals("speaking", c.phase)
    assertEquals("继续说", c.snapshot.draft)
  }
  @Test fun retiredInputAndPlaybackCallbacksCannotChangeANewTurnOrBlockedState() {
    val c = VoiceSessionController(); c.ready(); c.listen("old-input"); c.candidate("old-input"); c.hearing("old-input")
    val old = c.begin("old"); c.cancel(); val current = c.begin("new")
    assertFalse(c.partial("old-input", "迟到的输入")); assertFalse(c.settle("old-input", "ignore"))
    c.prepare("new"); assertFalse(c.render("old", old, true)); assertTrue(c.render("new", current, true))
    c.cancel(); c.block(true); assertFalse(c.partial("old-input", "不能解除静音")); assertFalse(c.complete("new", current))
    assertEquals("blocked", c.phase); assertFalse(c.captureAvailable)
  }
  @Test fun unrecognizedNoiseCannotLeavePlaybackQuietOrDiscardAnEarlierDraft() {
    val c = VoiceSessionController(); c.ready(); c.listen("input"); c.partial("input", "我还想")
    c.candidate("input"); c.settle("input", "noise")
    assertEquals(VoiceSessionController.Input.LISTENING, c.snapshot.input)
    assertEquals("我还想", c.snapshot.draft); assertFalse(c.snapshot.held)
    c.begin("answer"); c.prepare("answer"); c.render("answer", c.generation, true)
    c.candidate("next"); c.settle("next", "noise"); assertEquals("speaking", c.phase)
  }
  @Test fun aConfirmedSoundWithoutWordsResumesImmediatelyInsteadOfHoldingForThirtySeconds() {
    val c = VoiceSessionController(); c.ready(); val token = c.begin("answer"); c.prepare("answer"); c.render("answer", token, true)
    c.candidate("sound"); c.hearing("sound"); assertTrue(c.snapshot.held)
    c.settle("sound", "noise")
    assertFalse(c.snapshot.held); assertEquals("speaking", c.phase); assertEquals(token, c.generation)
    assertEquals("answer", c.turnId)
  }
  @Test fun modelStandbyRetiresOnlyItsOwnTurnAndKeepsWakeCaptureReady() {
    val c = VoiceSessionController(); c.ready(); c.listen("exit-input"); val token = c.begin("exit")
    assertTrue(c.standby("exit")); assertEquals("wake", c.phase)
    assertTrue(c.captureAvailable); assertFalse(c.stopped); assertNull(c.turnId)
    assertEquals("", c.snapshot.draft); assertNull(c.snapshot.segmentId)
    assertFalse(c.prepare("exit")); assertFalse(c.render("exit", token, true)); assertFalse(c.complete("exit", token))
    assertFalse(c.accepts("exit-input")); assertFalse(c.standby("exit"))
    c.listen("fresh-wake"); assertTrue(c.accepts("fresh-wake")); c.begin("new")
    assertTrue(c.active("new")); assertEquals("processing", c.phase)
  }
  @Test fun lateStandbyCannotEndANewTurnOrUnblockTheMicrophone() {
    val c = VoiceSessionController(); c.ready(); c.begin("old"); c.cancel(); val current = c.begin("new")
    assertFalse(c.standby("old")); assertTrue(c.active("new")); assertEquals(current, c.generation)
    c.block(true); assertFalse(c.standby("new")); assertEquals("blocked", c.phase)
    c.stop(); assertFalse(c.standby("new")); assertEquals("stopped", c.phase)
  }
  @Test fun speechArrivingDuringAnExitDecisionWinsAndItsDraftSurvives() {
    for (confirmed in listOf(false, true)) {
      val c = VoiceSessionController(); c.ready(); c.begin("exit"); c.candidate("new-input")
      if (confirmed) { c.hearing("new-input"); c.partial("new-input", "等等我还有一件事") }
      assertFalse(c.standby("exit")); assertEquals("listening", c.phase)
      assertTrue(c.captureAvailable); assertTrue(c.accepts("new-input")); assertNull(c.turnId)
      assertEquals(if (confirmed) "等等我还有一件事" else "", c.snapshot.draft)
      assertTrue(c.partial("new-input", "等等我还有一件事要说")); c.begin("new")
      assertTrue(c.active("new"))
    }
  }
  @Test fun standbyRejectsLateTranscriptsAndOnlyANewWakeCanArmInput() {
    var now = 0L; val c = VoiceSessionController { now }; c.ready(); c.listen("old")
    assertTrue(c.accepts("old")); now = 30000; assertEquals(VoiceSessionController.Tick.IDLE, c.tick())
    assertFalse(c.accepts("old")); c.candidate("old")
    assertEquals("wake", c.phase); assertFalse(c.partial("old", "迟到的识别")); assertFalse(c.settle("old", "wait"))
    c.listen("new"); assertTrue(c.accepts("new")); assertFalse(c.accepts("old"))
  }
  @Test fun ordinaryIdleStillUsesThirtySecondsAndNeverExpiresModelWorkOrPlayback() {
    for (output in VoiceSessionController.Output.values().filter { it != VoiceSessionController.Output.IDLE }) {
      var now = 0L; val c = VoiceSessionController { now }; c.ready(); val token = c.begin("answer")
      if (output != VoiceSessionController.Output.GENERATING) c.prepare("answer")
      if (output == VoiceSessionController.Output.PLAYING) c.render("answer", token, true)
      if (output == VoiceSessionController.Output.BUFFERING) c.render("answer", token, false)
      now = 60000; assertEquals(output, c.snapshot.output); assertEquals(VoiceSessionController.Tick.NONE, c.tick())
      assertTrue(c.complete("answer", token)); now += 29999
      assertEquals(VoiceSessionController.Tick.NONE, c.tick()); now++
      assertEquals(VoiceSessionController.Tick.IDLE, c.tick()); assertEquals("wake", c.phase)
    }
  }
}
