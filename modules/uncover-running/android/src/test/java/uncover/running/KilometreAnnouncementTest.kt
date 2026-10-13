package uncover.running

import org.junit.Assert.*
import org.junit.Test

class KilometreAnnouncementTest {
  @Test fun oneKilometreContainsActualMinutesAndSeconds() {
    assertEquals(KilometreAnnouncement.Announcement(1, "您已跑了1公里，用时6分20秒。"), KilometreAnnouncement.next(1000.0, 380000, 0))
    assertEquals("您已跑了2公里，用时12分钟。", KilometreAnnouncement.next(2000.0, 720000, 1)?.text)
  }
  @Test fun jitterAndTimeAloneNeverAnnounceOrRepeatDistance() {
    assertNull(KilometreAnnouncement.next(1999.0, 720000, 1))
    assertNull(KilometreAnnouncement.next(2000.0, 720000, 2))
    for (distance in listOf(null, Double.NaN, Double.POSITIVE_INFINITY, -1.0, 999.0)) assertNull(KilometreAnnouncement.next(distance, 900000, 0))
  }
  @Test fun estimatesAndPartialRoutesRemainTruthful() {
    assertTrue(KilometreAnnouncement.next(1000.0, 380000, 0, indoor = true)!!.text.contains("计步估算"))
    assertTrue(KilometreAnnouncement.next(1000.0, 380000, 0, partial = true)!!.text.contains("定位路段"))
  }
}
