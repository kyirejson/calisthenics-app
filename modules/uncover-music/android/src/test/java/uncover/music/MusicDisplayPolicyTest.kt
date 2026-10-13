package uncover.music

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class MusicDisplayPolicyTest {
  @Test fun noInputMayTargetPhysicalOrStaleDisplays() {
    MusicDisplayPolicy.requireDisplay(7, 7)
    for ((actual, expected) in listOf(0 to 0, 0 to 7, 7 to 0, -1 to -1, 8 to 7)) {
      assertEquals("wrong_display", assertThrows(MusicFailure::class.java) { MusicDisplayPolicy.requireDisplay(actual, expected) }.code)
    }
  }
  @Test fun coordinatesMustBeFiniteAndInsideThePrivateSurface() {
    MusicDisplayPolicy.requirePoint(360f, 640f)
    for ((x, y) in listOf(Float.NaN to 1f, 1f to Float.POSITIVE_INFINITY, -1f to 0f, 720f to 0f, 0f to 1280f)) {
      assertEquals("invalid_point", assertThrows(MusicFailure::class.java) { MusicDisplayPolicy.requirePoint(x, y) }.code)
    }
  }
  @Test fun independentFocusIsRequiredAndIdleDisplaysAreBounded() {
    assertEquals(34, MusicDisplayPolicy.MIN_API)
    assertEquals(120_000L, MusicDisplayPolicy.IDLE_MS)
  }
}
