package uncover.voice

/** Only independently verified owner audio changes the draft revision or revokes an assessment. */
internal class VoiceTurnControl {
  @Volatile private var pending: String? = null
  @Volatile private var submitted: String? = null
  private var lastOwnerAt = 0L
  private var nextProbeAt = 0L
  private var deadline = 0L
  private var failures = 0
  @Volatile var hasOwner = false; private set
  @Synchronized fun owner(now: Long) { pending = null; submitted = null; lastOwnerAt = now; nextProbeAt = 0; failures = 0; hasOwner = true }
  @Synchronized fun issue(id: String, now: Long): Boolean {
    if (!hasOwner || pending != null || now < nextProbeAt) return false
    pending = id; submitted = null; deadline = now + 15000; return true
  }
  @Synchronized fun active(id: String) = pending == id && submitted != id
  @Synchronized fun submit(id: String): Boolean { if (!active(id)) return false; submitted = id; return true }
  @Synchronized fun consume(id: String, action: String, now: Long): Boolean {
    if (pending != id || submitted != id) return false
    pending = null; submitted = null
    when (action) {
      "wait" -> nextProbeAt = Long.MAX_VALUE
      "error" -> { failures++; nextProbeAt = if (failures < 2) now + 1200 else Long.MAX_VALUE }
    }
    return true
  }
  @Synchronized fun timeout(now: Long): Boolean {
    if (pending == null || now < deadline) return false
    pending = null; submitted = null; failures++; nextProbeAt = if (failures < 2) now + 1200 else Long.MAX_VALUE; return true
  }
  @Synchronized fun expired(now: Long) = hasOwner && now - lastOwnerAt >= 20000
  @Synchronized fun reset() { pending = null; submitted = null; hasOwner = false; failures = 0; nextProbeAt = 0; lastOwnerAt = 0 }
}
