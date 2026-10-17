package uncover.device

import org.junit.Assert.*
import org.junit.Test

class ReminderPolicyTest {
  private fun time(value: String) = ReminderPolicy.instant(value)
  @Test fun oneShotUsesTheExplicitInstantAndNeverChangesTheUserDate() {
    val at = time("2026-10-18T11:30:00+08:00")
    assertEquals(at, ReminderPolicy.next(at, "Asia/Shanghai", emptyList(), at - 1))
    assertNull(ReminderPolicy.next(at, "Asia/Shanghai", emptyList(), at))
  }
  @Test fun repeatingUsesLocalWallClockAndSkipsAnAlreadyFiredOccurrence() {
    val first = time("2026-10-19T11:30:00+08:00")
    assertEquals(time("2026-10-21T11:30:00+08:00"), ReminderPolicy.next(first, "Asia/Shanghai", listOf(1, 3, 5), first))
  }
  @Test fun recurrenceCanStartMoreThanAWeekIntoTheFuture() {
    val first = time("2026-11-02T11:30:00+08:00")
    assertEquals(first, ReminderPolicy.next(first, "Asia/Shanghai", listOf(1), time("2026-10-17T00:00:00+08:00")))
  }
  @Test fun weeklyRemindersPreserveLocalTimeAcrossDaylightSaving() {
    val first = time("2026-10-25T11:30:00-04:00")
    assertEquals(time("2026-11-01T11:30:00-05:00"), ReminderPolicy.next(first, "America/New_York", listOf(7), first))
  }
  @Test fun ambiguousDatesAndInvalidRecurrenceAreRejectedAsProtocolErrors() {
    for (input in listOf("11:30", "2026-10-18T11:30:00")) try { time(input); fail("missing offset accepted") } catch (e: PhoneFailure) { assertEquals("invalid_reminder_time", e.code) }
    try { ReminderPolicy.days(listOf(1, 8)); fail("invalid day accepted") } catch (e: PhoneFailure) { assertEquals("invalid_repeat_days", e.code) }
  }
}
