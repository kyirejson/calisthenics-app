package uncover.running

import kotlin.math.*

/** Incremental native counterpart of analyseRun, for screen-off kilometre announcements. */
internal class RunDistance {
  data class Point(val lat: Double, val lon: Double, val accuracy: Double, val at: Long, val elapsed: Long, val segment: Int, val provider: String)
  private var anchor: Point? = null
  private var observed: Point? = null
  private var broken = true
  var metres = 0.0; private set
  var trackedMs = 0L; private set
  fun add(p: Point) {
    if (!p.lat.isFinite() || !p.lon.isFinite() || p.lat !in -90.0..90.0 || p.lon !in -180.0..180.0 ||
      !p.accuracy.isFinite() || p.accuracy !in 0.0..35.0 || p.provider !in listOf("gps", "fused") || p.elapsed < 0) {
      broken = true; observed = null; return
    }
    val previous = observed ?: anchor
    if (previous != null && (p.elapsed < previous.elapsed || p.at <= previous.at)) return
    val a = anchor
    val gap = if (a == null) 0 else p.elapsed - a.elapsed
    if (a == null || broken || p.segment != a.segment || p.provider != a.provider || gap > 30000) {
      anchor = p; observed = p; broken = false; return
    }
    val r = Math.PI / 180
    val h = (sin((p.lat - a.lat) * r / 2).pow(2) + cos(a.lat * r) * cos(p.lat * r) * sin((p.lon - a.lon) * r / 2).pow(2)).coerceIn(0.0, 1.0)
    val distance = 6371008.8 * 2 * atan2(sqrt(h), sqrt(1 - h))
    if (gap <= 0 || distance / (gap / 1000.0) > 12) return
    observed?.let { if (p.elapsed > it.elapsed && p.elapsed - it.elapsed <= 30000) trackedMs += p.elapsed - it.elapsed }
    observed = p
    if (distance < ((a.accuracy + p.accuracy) * .5).coerceIn(4.0, 12.0)) return
    metres += distance; anchor = p
  }
}
