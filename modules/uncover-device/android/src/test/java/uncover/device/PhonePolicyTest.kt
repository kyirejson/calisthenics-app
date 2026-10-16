package uncover.device

import org.junit.Assert.*
import org.junit.Test

class PhonePolicyTest {
  @Test fun applicationNamesAreNotAThreeAppWhitelist() {
    for (name in listOf("com.tencent.mm", "com.android.chrome", "com.autonavi.minimap", "com.example.unseen_app", "android")) assertEquals(name, PhonePolicy.packageName(name))
    for (name in listOf("", "a/b", "com..example", "com.example;am start", "1com.bad")) assertThrows(PhoneFailure::class.java) { PhonePolicy.packageName(name) }
  }
  @Test fun publicLinksAreNotExecutableIntentsOrPrivateFileAccess() {
    for (uri in listOf("https://example.com/a?q=中文", "geo:0,0?q=公园", "custom-app://public/item/2")) assertEquals(uri, PhonePolicy.launchUri(uri))
    for (uri in listOf("file:///data/private", "content://private/1", "javascript:alert(1)", "intent://a#Intent;end", "https://user:pass@example.com")) assertThrows(PhoneFailure::class.java) { PhonePolicy.launchUri(uri) }
  }
  @Test fun retainingMessagesDoesNotCapTheCurrentModelsToolSteps() {
    val history = (0 until 1000).map { "current" to it.toLong() } + (0 until 50).map { "old-$it" to it.toLong() }
    val kept = PhonePolicy.retainedRequests(history, "current")
    assertEquals(32, kept.size); assertTrue("current" in kept); assertTrue("old-49" in kept); assertFalse("old-0" in kept)
  }
  @Test fun gesturesUseActualScreenBoundsAndRejectNonFiniteCoordinates() {
    PhonePolicy.point(10.0, 20.0, 0, 0, 100, 200)
    for ((x, y) in listOf(-1.0 to 0.0, 100.0 to 0.0, Double.NaN to 0.0, 0.0 to Double.POSITIVE_INFINITY)) assertThrows(PhoneFailure::class.java) { PhonePolicy.point(x, y, 0, 0, 100, 200) }
  }
  @Test fun observationsSettleFromEventsOrBoundedNoEventFallback() {
    assertFalse(PhonePolicy.ready(100, 0, 50, true, true)); assertTrue(PhonePolicy.ready(180, 0, 50, true, true))
    assertFalse(PhonePolicy.ready(220, 0, 0, false, true)); assertTrue(PhonePolicy.ready(280, 0, 0, false, true))
    assertTrue(PhonePolicy.ready(100, 0, 0, false, false))
  }
}
