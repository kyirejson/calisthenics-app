package uncover.music

import org.junit.Assert.*
import org.junit.Test

class MusicObservationPolicyTest {
  @Test fun settledReadNeedsNoFixedDelay() {
    assertTrue(MusicObservationPolicy.ready(10000, 10000, 5000, false, false))
  }
  @Test fun changedActionWaitsForQuietNot450Milliseconds() {
    assertFalse(MusicObservationPolicy.ready(10050, 10000, 10020, true, true))
    assertTrue(MusicObservationPolicy.ready(10100, 10000, 10020, true, true))
  }
  @Test fun noEventUsesExplicitBoundedFallback() {
    assertFalse(MusicObservationPolicy.ready(10100, 10000, 5000, false, true))
    assertTrue(MusicObservationPolicy.ready(10220, 10000, 5000, false, true))
  }
  @Test fun newEventsDelayObservationEvenPastFallback() {
    assertFalse(MusicObservationPolicy.ready(10300, 10000, 10280, false, true))
  }
}
