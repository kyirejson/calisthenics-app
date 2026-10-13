package uncover.music

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class MusicJournalPolicyTest {
  @Test fun currentMessageKeepsAllItsSteps() {
    assertEquals(emptySet<String>(), MusicJournalPolicy.expiredRequests((0L..1000L).map { "current" to it }, "current"))
  }
  @Test fun oldestDistinctMessagesExpireRatherThanIndividualSteps() {
    val rows = (0L..40L).flatMap { listOf("r$it" to it, "r$it" to it) } + (0L..1000L).map { "current" to it }
    assertEquals((0L..9L).map { "r$it" }.toSet(), MusicJournalPolicy.expiredRequests(rows, "current"))
  }
  @Test fun currentRetryIsRetainedEvenIfOlderThanOtherRequests() {
    val expired = MusicJournalPolicy.expiredRequests((0L..40L).map { "r$it" to it }, "r0")
    assertFalse("r0" in expired)
    assertEquals(9, expired.size)
  }
}
