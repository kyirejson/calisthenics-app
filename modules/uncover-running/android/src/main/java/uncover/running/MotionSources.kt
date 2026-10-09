package uncover.running

/** Do not mix simultaneous provider streams into one stationary/moving interval. */
internal class MotionSources {
  private val gate = MotionGate()
  private var selected: String? = null
  private var lastGoodAt = 0L
  fun reset() { gate.reset(); selected = null; lastGoodAt = 0 }
  fun update(provider: String, at: Long, speed: Double?, accuracy: Double, speedAccuracy: Double?, autoPaused: Boolean): String? {
    if (provider !in listOf("gps", "fused")) return null
    if (at <= lastGoodAt) return null
    val usable = speed != null && speed.isFinite() && speed in 0.0..12.0 && accuracy.isFinite() && accuracy in 0.0..20.0 &&
      (speedAccuracy == null || speedAccuracy.isFinite() && speedAccuracy in 0.0..0.75)
    if (!usable) {
      if (provider == selected) { gate.reset(); lastGoodAt = 0 }
      return null
    }
    // Fresh reliable GPS takes precedence; poor fused callbacks must not erase it.
    if (provider == "fused" && selected == "gps" && lastGoodAt > 0 && at - lastGoodAt in 0..4000) return null
    if (provider != selected) { gate.reset(); selected = provider }
    lastGoodAt = at
    return gate.update(at, speed, accuracy, speedAccuracy, autoPaused)
  }
}
