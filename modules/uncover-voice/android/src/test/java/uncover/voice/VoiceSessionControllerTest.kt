package uncover.voice

import org.junit.Assert.*
import org.junit.Test

class VoiceSessionControllerTest {
  @Test fun inputAndOutputRemainIndependent() {
    val c = VoiceSessionController(); c.ready(); c.listen(); val token = c.begin("one")
    assertTrue(c.play("one")); c.candidate()
    assertEquals(VoiceSessionController.Output.PLAYING, c.output)
    assertEquals(VoiceSessionController.Input.CANDIDATE, c.input)
    c.dismiss(); assertTrue(c.complete("one", token)); assertEquals("listening", c.phase)
  }
  @Test fun idleCancellationCannotArmCaptureAndStaleResultsCannotSpeak() {
    val c = VoiceSessionController(); c.ready(); assertNull(c.cancel()); assertEquals("wake", c.phase)
    val old = c.begin("old"); assertEquals("old", c.cancel("old")); val current = c.begin("current")
    assertFalse(c.play("old")); assertFalse(c.complete("old", old)); assertNull(c.cancel("old"))
    assertTrue(c.active("current")); assertTrue(c.complete("current", current))
  }
  @Test fun waitOnlyReevaluatesAfterNewInputAndStaleDecisionCannotCommit() {
    val c = VoiceTurnControl(); c.revise("帮我播放"); assertTrue(c.issue("first", 900)); c.submit("first"); c.consume("first", "wait", 1000)
    c.revise("帮我播放"); assertFalse(c.issue("unchanged", 10000))
    c.revise("帮我播放我喜欢的歌"); assertTrue(c.issue("new", 12000))
    c.submit("new"); c.revise("帮我播放我喜欢的歌单"); assertFalse(c.consume("new", "respond", 12200))
  }
  @Test fun blockingOrStoppingInvalidatesOutput() {
    val c = VoiceSessionController(); c.ready(); val token = c.begin("t"); c.cancel(); c.block(true)
    assertFalse(c.active("t")); assertFalse(c.complete("t", token)); assertEquals("blocked", c.phase)
    c.stop(); assertEquals("stopped", c.phase)
  }
}
