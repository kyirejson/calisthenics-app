package uncover.voice

/** New input revokes an assessment; wait never repeatedly bills an unchanged draft. */
internal class VoiceTurnControl {
  @Volatile private var pending: String? = null
  @Volatile private var submitted: String? = null
  private var nextProbeAt = 0L
  private var deadline = 0L
  private var failures = 0
  private var draft = ""
  @Volatile var hasDraft = false; private set
  @Synchronized fun revise(text: String): String? {
    if (text == draft) return null
    val revoked = pending
    draft = text; pending = null; submitted = null; nextProbeAt = 0; failures = 0; hasDraft = text.isNotBlank()
    return revoked
  }
  @Synchronized fun issue(id: String, now: Long): Boolean {
    if (!hasDraft || pending != null || now < nextProbeAt) return false
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
  @Synchronized fun reset(): String? {
    val revoked = pending
    pending = null; submitted = null; hasDraft = false; draft = ""; failures = 0; nextProbeAt = 0
    return revoked
  }
}
