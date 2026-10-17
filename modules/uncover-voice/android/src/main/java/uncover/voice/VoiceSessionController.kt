package uncover.voice

/** The service's main event queue is the only writer. Workers read one immutable snapshot. */
internal class VoiceSessionController(private val clock: () -> Long = { System.nanoTime() / 1_000_000 }) {
  enum class Input { WAKE, LISTENING, CANDIDATE, HEARING, ASSESSING, BLOCKED }
  enum class Output { IDLE, GENERATING, SYNTHESIZING, PLAYING, BUFFERING }
  enum class Tick { NONE, RESUME, IDLE }
  data class Snapshot(
    val ready: Boolean = false, val stopped: Boolean = false,
    val input: Input = Input.WAKE, val output: Output = Output.IDLE,
    val turnId: String? = null, val generation: Int = 0,
    val segmentId: String? = null, val draft: String = "", val held: Boolean = false,
    val activityAt: Long = 0,
    val inputSuppressed: Boolean = false, val externalPlayback: String = "none", val externalMetadataAvailable: Boolean = false,
  ) {
    val captureAvailable get() = ready && !stopped && input != Input.BLOCKED
    val phase get() = when {
      stopped -> "stopped"
      input == Input.BLOCKED -> "blocked"
      !ready -> "starting"
      held || output == Output.IDLE -> when (input) {
        Input.WAKE -> "wake"
        Input.ASSESSING -> "assessing"
        else -> "listening"
      }
      output == Output.GENERATING -> "processing"
      output == Output.SYNTHESIZING -> "synthesizing"
      output == Output.BUFFERING -> "buffering"
      else -> "speaking"
    }
  }
  @Volatile var snapshot = Snapshot(activityAt = clock()); private set
  val phase get() = snapshot.phase
  val turnId get() = snapshot.turnId
  val generation get() = snapshot.generation
  val stopped get() = snapshot.stopped
  val captureAvailable get() = snapshot.captureAvailable
  private fun owns(id: String, token: Int) = snapshot.captureAvailable && snapshot.turnId == id && snapshot.generation == token
  private fun inputIsCurrent(segment: String) = captureAvailable && snapshot.segmentId == segment
  fun accepts(segment: String) = inputIsCurrent(segment) && snapshot.input != Input.WAKE
  fun ready() { if (!stopped) snapshot = snapshot.copy(ready = true, activityAt = clock()) }
  fun externalAudio(suppressed: Boolean, reason: String, available: Boolean) {
    if (!stopped) snapshot = snapshot.copy(inputSuppressed = suppressed, externalPlayback = reason, externalMetadataAvailable = available)
  }
  fun listen(segment: String? = null) {
    if (captureAvailable) snapshot = snapshot.copy(input = Input.LISTENING, segmentId = segment, draft = "", activityAt = clock())
  }
  fun candidate(segment: String) {
    if (captureAvailable && snapshot.input != Input.WAKE) snapshot = snapshot.copy(input = Input.CANDIDATE, segmentId = segment, activityAt = clock())
  }
  fun partial(segment: String, text: String): Boolean {
    if (!inputIsCurrent(segment)) return false
    snapshot = snapshot.copy(draft = text, activityAt = clock()); return true
  }
  fun hearing(segment: String): Boolean {
    if (!inputIsCurrent(segment)) return false
    snapshot = snapshot.copy(input = Input.HEARING, held = turnId != null, activityAt = clock()); return true
  }
  fun assessing(segment: String): Boolean {
    if (!inputIsCurrent(segment)) return false
    snapshot = snapshot.copy(input = Input.ASSESSING, activityAt = clock()); return true
  }
  fun settle(segment: String, action: String): Boolean {
    if (!inputIsCurrent(segment)) return false
    // A semantic wait preserves the draft and the reversible hold, not a second chat turn.
    snapshot = snapshot.copy(input = Input.LISTENING, held = snapshot.held && (action == "wait" || (action == "noise" && snapshot.draft.isNotBlank())),
      draft = if (action == "ignore") "" else snapshot.draft, activityAt = clock()); return true
  }
  fun block(value: Boolean): String? {
    if (stopped) return null
    val cancelled = if (value) cancel() else null
    snapshot = snapshot.copy(input = if (value) Input.BLOCKED else Input.LISTENING,
      held = false, segmentId = null, draft = "", activityAt = clock())
    return cancelled
  }
  fun begin(id: String): Int {
    check(captureAvailable && turnId == null) { "A voice turn must be cancelled before replacement." }
    snapshot = snapshot.copy(generation = generation + 1, turnId = id, input = Input.LISTENING,
      output = Output.GENERATING, segmentId = null, draft = "", held = false, activityAt = clock())
    return generation
  }
  fun active(id: String): Boolean {
    val state = snapshot
    return state.captureAvailable && state.turnId == id && state.output == Output.GENERATING
  }
  fun prepare(id: String): Boolean {
    if (!active(id)) return false
    snapshot = snapshot.copy(output = Output.SYNTHESIZING); return true
  }
  fun render(id: String, token: Int, playing: Boolean): Boolean {
    if (!owns(id, token) || snapshot.output == Output.GENERATING) return false
    snapshot = snapshot.copy(output = if (playing) Output.PLAYING else Output.BUFFERING); return true
  }
  fun complete(id: String, token: Int, standbyAfterReply: Boolean = false): Boolean {
    if (!owns(id, token)) return false
    val idle = standbyAfterReply && !snapshot.held && snapshot.input == Input.LISTENING && snapshot.draft.isBlank()
    snapshot = snapshot.copy(turnId = null, output = Output.IDLE, held = false, activityAt = clock(),
      input = if (idle) Input.WAKE else snapshot.input, segmentId = if (idle) null else snapshot.segmentId); return true
  }
  fun standby(id: String): Boolean {
    if (!active(id)) return false
    // Do not erase speech that began while the model was deciding to leave.
    if (snapshot.held || snapshot.input != Input.LISTENING || snapshot.draft.isNotBlank()) {
      complete(id, generation); return false
    }
    snapshot = snapshot.copy(generation = generation + 1, turnId = null, input = Input.WAKE,
      output = Output.IDLE, held = false, segmentId = null, draft = "", activityAt = clock())
    return true
  }
  fun cancel(id: String? = null, preserveInput: Boolean = false): String? {
    val current = turnId ?: return null
    if (id != null && id != current) return null
    snapshot = snapshot.copy(generation = generation + 1, turnId = null, output = Output.IDLE, held = false,
      input = if (preserveInput || snapshot.input == Input.BLOCKED) snapshot.input else Input.LISTENING,
      segmentId = if (preserveInput) snapshot.segmentId else null,
      draft = if (preserveInput) snapshot.draft else "", activityAt = clock())
    return current
  }
  fun tick(): Tick {
    if (!captureAvailable || clock() - snapshot.activityAt < 30000) return Tick.NONE
    if (snapshot.held) {
      snapshot = snapshot.copy(held = false, input = Input.LISTENING); return Tick.RESUME
    }
    if (turnId == null && snapshot.input != Input.WAKE) {
      snapshot = snapshot.copy(input = Input.WAKE, segmentId = null, draft = ""); return Tick.IDLE
    }
    return Tick.NONE
  }
  fun stop() {
    cancel(); snapshot = snapshot.copy(stopped = true, ready = false, held = false, segmentId = null, draft = "")
  }
}
