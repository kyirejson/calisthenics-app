package uncover.voice

import org.junit.Assert.*
import org.junit.Test

class VoiceOutputProgressTest {
  private val chunk = VoiceSpeechChunk("可以开始训练。", 4, 12)
  @Test fun reportsQueueWaitSeparatelyFromInference() {
    val progress = VoiceOutputProgress(2, 1000, 2000)
    assertNull(progress.timeout(2999)); assertTrue(progress.timeout(3000)!!.contains("synthesis_queue_timeout"))
  }
  @Test fun inferenceDeadlineStartsWhenWorkActuallyStarts() {
    val progress = VoiceOutputProgress(2, 1000, 2000)
    progress.synthesis(1, chunk, 1, 2999)
    assertNull(progress.timeout(3000)); assertNull(progress.timeout(4998))
    assertTrue(progress.timeout(4999)!!.contains("synthesis_timeout")); assertEquals(1999L, progress.state.queueMs)
  }
  @Test fun coldInitializationIsNeitherQueueWaitNorFirstSegmentInference() {
    val progress = VoiceOutputProgress(2, 1000, 2000)
    progress.preparing(2000)
    assertNull(progress.timeout(3000)); assertTrue(progress.timeout(4000)!!.contains("synthesis_prepare_timeout"))
    progress.synthesis(1, chunk, 1, 4000)
    assertNull(progress.timeout(5999)); assertTrue(progress.timeout(6000)!!.contains("synthesis_timeout"))
    assertEquals(1000L, progress.state.queueMs)
  }
  @Test fun initializationFailureNeverClaimsAFictitiousSegmentZero() {
    val progress = VoiceOutputProgress(2, 1000)
    progress.preparing(1100)
    val message = progress.failure(IllegalStateException("initialization fixture failure"))
    assertTrue(message.contains("synthesis_prepare_failed")); assertFalse(message.contains("0/2"))
  }
  @Test fun playbackAndBackpressureDoNotUseAnInferenceDeadline() {
    val progress = VoiceOutputProgress(2, 1000, 2000)
    progress.synthesis(1, chunk, 1, 1100); progress.buffered(1200)
    assertNull(progress.timeout(100000))
    progress.ended(100001); assertNull(progress.timeout(200000))
  }
  @Test fun eachActualAttemptHasItsOwnDeadline() {
    val progress = VoiceOutputProgress(2, 1000, 2000)
    progress.synthesis(1, chunk, 1, 1100); progress.synthesis(1, chunk, 2, 2900)
    assertNull(progress.timeout(3100)); assertTrue(progress.timeout(4900)!!.contains("synthesis_timeout"))
  }
  @Test fun failureIdentifiesTheUnspokenSegmentWithoutClaimingSuccess() {
    val progress = VoiceOutputProgress(3, 1000)
    progress.synthesis(2, chunk, 2, 1200)
    val message = progress.failure(VoiceSynthesisException("synthesis_empty", "引擎没有返回音频。"))
    assertTrue(message.contains("2/3")); assertTrue(message.contains("synthesis_empty")); assertTrue(message.contains("已重试 1 次"))
    assertTrue(progress.details(1300).contains("range=4:12")); assertFalse(message.contains(chunk.text))
  }
  @Test fun unknownFailuresKeepTheirActualCause() {
    val progress = VoiceOutputProgress(1, 0)
    progress.synthesis(1, chunk, 1, 1)
    assertTrue(progress.failure(IllegalStateException("native fixture failure")).contains("native fixture failure"))
  }
}
