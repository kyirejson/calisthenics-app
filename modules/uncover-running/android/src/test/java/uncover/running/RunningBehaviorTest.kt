package uncover.running

import org.junit.Assert.*
import org.junit.Test

class RunningBehaviorTest {
  @Test fun simultaneousWeakOrGoodFusedFixesCannotBreakReliableGpsIntervals() {
    for (weak in listOf(true, false)) {
      val source = MotionSources()
      for (second in 1L..8) {
        assertNull(source.update("gps", second * 1000, 0.0, 5.0, .1, false))
        assertNull(source.update("fused", second * 1000 + 1, if (weak) null else 3.0, if (weak) 100.0 else 5.0, .1, false))
      }
      assertEquals("pause", source.update("gps", 9000, 0.0, 5.0, .1, false))
    }
    val fallback = MotionSources()
    assertNull(fallback.update("gps", 1000, 0.0, 5.0, .1, false))
    for (second in 6L..13) assertNull(fallback.update("fused", second * 1000, 0.0, 5.0, .1, false))
    assertEquals("pause", fallback.update("fused", 14000, 0.0, 5.0, .1, false))
  }
  @Test fun stepCounterBaselinesResetAndNeverCountThePausedInterval() {
    val steps = StepEvidence(); steps.reset(1000000000)
    assertEquals(0, steps.accept(true, 100f, 1000000000, 1000000000))
    assertEquals(3, steps.accept(true, 103f, 2000000000, 2000000000))
    steps.reset(5000000000)
    assertEquals(0, steps.accept(true, 130f, 5000000000, 5000000000))
    assertEquals(2, steps.accept(true, 132f, 6000000000, 6000000000))
    assertEquals(0, steps.accept(true, 0f, 7000000000, 7000000000))
    assertEquals(1, steps.accept(true, 1f, 8000000000, 8000000000))
  }
  @Test fun staleDuplicateFractionalAndImplausibleStepEvidenceIsRejected() {
    val steps = StepEvidence(); steps.reset(1000000000)
    assertEquals(0, steps.accept(false, 1f, 999999999, 1000000000))
    assertEquals(1, steps.accept(false, 1f, 1000000000, 1000000000))
    assertEquals(0, steps.accept(false, 1f, 1000000000, 1000000000))
    assertEquals(0, steps.accept(false, 1f, 2000000000, 8000000000))
    assertEquals(0, steps.accept(true, 3.5f, 9000000000, 9000000000))
    assertEquals(0, steps.accept(true, 100f, 10000000000, 10000000000))
    assertEquals(0, steps.accept(true, 200f, 11000000000, 11000000000))
    assertEquals(2, steps.accept(true, 202f, 12000000000, 12000000000))
  }
  @Test fun stationaryMustBeContinuousAndResumeRequiresThreeSeconds() {
    val gate = MotionGate()
    for (second in 0L..7) assertNull(gate.update(second * 1000, .2, 5.0, .1, false))
    assertEquals("pause", gate.update(8000, .2, 5.0, .1, false))
    for (second in 9L..11) assertNull(gate.update(second * 1000, 2.0, 5.0, .1, true))
    assertEquals("resume", gate.update(12000, 2.0, 5.0, .1, true))
  }
  @Test fun noSpeedWeakPrecisionUncertaintyOrGapsNeverPause() {
    for (kind in 0..2) {
      val gate = MotionGate()
      for (second in 0L..20) assertNull(gate.update(second * 1000, if (kind == 0) null else 0.0, if (kind == 1) 44.0 else 5.0, if (kind == 2) 2.0 else .1, false))
    }
  }
  @Test fun gapsAndManualResetRequireNewEvidence() {
    val gate = MotionGate()
    for (second in 0L..7) assertNull(gate.update(second * 1000, .2, 5.0, .1, false))
    assertNull(gate.update(20000, .2, 5.0, .1, false))
    gate.reset()
    assertNull(gate.update(23000, 2.0, 5.0, .1, true))
    assertNull(gate.update(24000, 2.0, 5.0, .1, true))
  }
  private fun point(metres: Double, seconds: Long, segment: Int = 0, accuracy: Double = 5.0, provider: String = "gps") =
    RunDistance.Point(metres / 111195.08, 0.0, accuracy, (seconds + 1) * 1000000000, seconds * 1000, segment, provider)
  @Test fun nativeDistanceAndTrackedTimeMatchTheJavascriptFixtures() {
    val distance = RunDistance()
    for (i in 0..210) distance.add(point(i * 10.0, i * 3L))
    assertEquals(2100.0, distance.metres, .01)
    assertEquals(630000L, distance.trackedMs)
    val split = RunDistance()
    split.add(point(0.0, 0)); split.add(point(10.0, 3)); split.add(point(1000.0, 4, 1)); split.add(point(1010.0, 7, 1))
    assertEquals(20.0, split.metres, .01)
    assertEquals(6000L, split.trackedMs)
  }
  @Test fun nativeDistanceRejectsJitterWeakFixesTeleportAndSourceHandover() {
    val still = RunDistance()
    for (i in 0..99) still.add(point(kotlin.math.sin(i.toDouble()) * 2, i.toLong()))
    assertEquals(0.0, still.metres, .01)
    val distance = RunDistance()
    listOf(point(0.0, 0), point(10.0, 3), point(10000.0, 4), point(20.0, 6), point(2000.0, 8, accuracy = 120.0), point(3000.0, 9, provider = "network"), point(5000.0, 12), point(5010.0, 15)).forEach(distance::add)
    assertEquals(30.0, distance.metres, .01)
    val handover = RunDistance()
    listOf(point(0.0, 0), point(10.0, 3), point(1000.0, 6, provider = "fused"), point(1010.0, 9, provider = "fused")).forEach(handover::add)
    assertEquals(20.0, handover.metres, .01)
  }
}
