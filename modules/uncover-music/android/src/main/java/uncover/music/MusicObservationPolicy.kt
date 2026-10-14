package uncover.music

/** Only timing/observation facts, never song intent or navigation decisions. */
internal object MusicObservationPolicy {
  const val QUIET_MS = 80L
  const val NO_EVENT_GRACE_MS = 220L
  const val DEADLINE_MS = 1400L
  fun ready(now: Long, started: Long, lastEvent: Long, changed: Boolean, afterAction: Boolean): Boolean =
    now - lastEvent >= QUIET_MS && (!afterAction || changed || now - started >= NO_EVENT_GRACE_MS)
}
