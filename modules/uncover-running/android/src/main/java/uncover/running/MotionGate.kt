package uncover.running

/** No coordinate arrival, bad precision or missing speed is not evidence of standing still. */
internal class MotionGate {
  private var stationarySince: Long? = null
  private var movingSince: Long? = null
  private var lastAt: Long? = null
  fun reset() { stationarySince = null; movingSince = null; lastAt = null }
  fun update(at: Long, speed: Double?, accuracy: Double, speedAccuracy: Double?, autoPaused: Boolean): String? {
    if (lastAt != null && at <= lastAt!!) return null
    if (lastAt != null && at - lastAt!! > 4000) reset()
    lastAt = at
    if (speed == null || !speed.isFinite() || speed !in 0.0..12.0 || !accuracy.isFinite() || accuracy !in 0.0..20.0 ||
      speedAccuracy != null && (!speedAccuracy.isFinite() || speedAccuracy !in 0.0..0.75)) {
      stationarySince = null; movingSince = null; return null
    }
    if (!autoPaused) {
      movingSince = null
      if (speed <= 0.5) {
        if (stationarySince == null) stationarySince = at
        if (at - stationarySince!! >= 8000) { reset(); return "pause" }
      } else stationarySince = null
    } else {
      stationarySince = null
      if (speed >= 1.2) {
        if (movingSince == null) movingSince = at
        if (at - movingSince!! >= 3000) { reset(); return "resume" }
      } else movingSince = null
    }
    return null
  }
}
