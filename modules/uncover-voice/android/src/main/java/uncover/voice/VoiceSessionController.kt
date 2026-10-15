package uncover.voice

/** Accessed on the service's single event queue. Input and output are not mutually exclusive. */
internal class VoiceSessionController {
  enum class Input { WAKE, LISTENING, CANDIDATE, BLOCKED }
  enum class Output { IDLE, GENERATING, PLAYING }
  @Volatile var input = Input.WAKE; private set
  @Volatile var output = Output.IDLE; private set
  @Volatile var ready = false; private set
  @Volatile var stopped = false; private set
  @Volatile var turnId: String? = null; private set
  @Volatile var generation = 0; private set
  val phase get() = when {
    stopped -> "stopped"
    input == Input.BLOCKED -> "blocked"
    !ready -> "starting"
    output == Output.PLAYING -> "speaking"
    output == Output.GENERATING -> "processing"
    input == Input.WAKE -> "wake"
    else -> "listening"
  }
  fun ready() { if (!stopped) ready = true }
  fun listen() { if (!stopped) input = Input.LISTENING }
  fun candidate() { if (ready && !stopped) input = Input.CANDIDATE }
  fun dismiss() { if (input == Input.CANDIDATE) input = Input.LISTENING }
  fun idle() { if (output == Output.IDLE) input = Input.WAKE }
  fun block(value: Boolean) { input = if (value) Input.BLOCKED else Input.WAKE }
  fun begin(id: String): Int { check(ready && !stopped); generation++; turnId = id; input = Input.LISTENING; output = Output.GENERATING; return generation }
  fun active(id: String) = ready && !stopped && input != Input.BLOCKED && turnId == id && output == Output.GENERATING
  fun play(id: String): Boolean { if (!active(id)) return false; output = Output.PLAYING; return true }
  fun complete(id: String, token: Int): Boolean {
    if (stopped || turnId != id || generation != token) return false
    turnId = null; output = Output.IDLE; input = Input.LISTENING; return true
  }
  fun cancel(id: String? = null): String? {
    val current = turnId ?: return null
    if (id != null && id != current) return null
    generation++; turnId = null; output = Output.IDLE
    if (input != Input.BLOCKED) input = Input.LISTENING
    return current
  }
  fun stop() { cancel(); stopped = true; ready = false }
}
