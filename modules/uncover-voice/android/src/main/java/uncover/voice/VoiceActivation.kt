package uncover.voice

/** A wake is input to the model, never a second local reply. */
internal object VoiceActivation {
  enum class Action { WAIT, REQUEST, LISTEN }
  fun decide(ready: Boolean, phase: String): Action = when {
    !ready -> Action.WAIT
    phase in listOf("listening", "speaking", "processing") -> Action.LISTEN
    else -> Action.REQUEST
  }
}
