package uncover.voice

/** ASR segment boundaries are not conversation boundaries. No keyword intent or fixed word budget. */
internal class VoiceTurnBuffer {
  private val segments = mutableListOf<String>()
  var partial: String = ""; private set
  var wake: Boolean = false; private set
  val onlyWake get() = wake && segments.isEmpty() && partial.isBlank()
  val text get() = (segments + partial).filter { it.isNotBlank() }.joinToString(" ").trim().ifBlank { if (wake) "BLACK" else "" }
  fun activate() { wake = true }
  fun update(text: String) { partial = text.trim() }
  fun seal() { if (partial.isNotBlank()) segments.add(partial); partial = "" }
  fun clear() { segments.clear(); partial = ""; wake = false }
}
