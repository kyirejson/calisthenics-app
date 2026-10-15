package uncover.voice

/** Linearizes consent cancellation, deletion and the final disk commit, not just service teardown. */
internal class VoiceRegistrationGate {
  private var sequence = 0L
  private var active: Long? = null
  @Synchronized fun begin(): Long = (++sequence).also { active = it }
  @Synchronized fun isActive(ticket: Long) = active == ticket
  @Synchronized fun cancel() { active = null; sequence++ }
  @Synchronized fun <T> commit(ticket: Long, write: () -> T): T {
    check(active == ticket) { "声音登记已取消，未替换主人声纹。" }
    return write().also { active = null }
  }
  @Synchronized fun invalidate(remove: () -> Unit) { active = null; sequence++; remove() }
}
