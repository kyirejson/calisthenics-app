package uncover.voice

/** One acknowledgement per activation. Already-awake requests stop/listen instead of replaying the cue. */
internal object VoiceActivation {
  enum class Action { WAIT, ACKNOWLEDGE, LISTEN, IGNORE }
  fun decide(ready: Boolean, phase: String): Action = when {
    !ready -> Action.WAIT
    phase == "acknowledging" -> Action.IGNORE
    phase in listOf("listening", "speaking", "processing") -> Action.LISTEN
    else -> Action.ACKNOWLEDGE
  }
}
