package uncover.running

/** Hardware step evidence only; resets and paused-period counter totals are not distance. */
internal class StepEvidence {
  private var baseline: Int? = null
  private var lastAt = 0L
  private var startedAt = 0L
  fun reset(at: Long) { baseline = null; lastAt = 0; startedAt = at }
  fun accept(counter: Boolean, value: Float, at: Long, now: Long): Int {
    if (!value.isFinite() || value < 0 || value > Int.MAX_VALUE.toDouble() || value.toDouble() != value.toInt().toDouble()) return 0
    if (at < startedAt || at <= lastAt || now - at !in 0..5_000_000_000L) return 0
    val oldAt = lastAt; lastAt = at
    val steps = if (counter) {
      val current = value.toInt(); val previous = baseline; baseline = current
      if (previous == null) 0 else current - previous
    } else if (value == 1f) 1 else 0
    val maximum = if (oldAt == 0L) 1 else (6 * ((at - oldAt) / 1_000_000_000.0 + 1)).toInt()
    return if (steps in 1..maximum) steps else 0
  }
}
