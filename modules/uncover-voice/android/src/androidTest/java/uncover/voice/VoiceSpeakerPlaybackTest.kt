package uncover.voice

import android.app.Activity
import android.content.Intent
import android.media.AudioAttributes
import android.test.InstrumentationTestCase
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.LinkedBlockingQueue

/** Actual local model and Android audio backend; no system TTS fixture or enrolled identity. */
@Suppress("DEPRECATION")
class VoiceSpeakerPlaybackTest : InstrumentationTestCase() {
  private lateinit var activity: Activity
  override fun setUp() {
    super.setUp()
    activity = instrumentation.startActivitySync(Intent(instrumentation.targetContext, VoicePlaybackActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    instrumentation.waitForIdleSync()
  }
  override fun tearDown() { instrumentation.runOnMainSync { activity.finish() }; super.tearDown() }
  private fun player() = VoicePcmPlayer(VoiceRenderReference(), AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANT).build())
  fun testProductionPcmPlayerActuallyPlaysAndCanPlayAgain() {
    val player = player()
    try { repeat(2) {
      var started = false; val pcm = ShortArray(8000) { (2000 * kotlin.math.sin(it * .1)).toInt().toShort() }
      val played = player.play(pcm, { true }) { started = true }
      assertTrue(started); assertEquals(pcm.size, played)
    } } finally { player.stop() }
  }
  fun testSubThresholdPcmStartsWithoutWaitingForMoreSpeech() {
    val player = player()
    try {
      var started = false
      assertEquals(80, player.play(ShortArray(80) { 1200 }, { true }) { started = true })
      assertTrue(started)
      assertEquals(160, player.play(ShortArray(160) { 800 }, { true }) {})
    } finally { player.stop() }
  }
  fun testPcmCancellationStopsRealPlaybackWithoutCompletingTheQueue() {
    val player = player(); val active = AtomicBoolean(true); val begun = CountDownLatch(1); val done = CountDownLatch(1)
    var played = -1; var error: Throwable? = null
    val worker = Thread {
      try { played = player.play(ShortArray(160000) { 1200 }, { active.get() }) { begun.countDown() } }
      catch (failure: Throwable) { error = failure } finally { done.countDown() }
    }
    try {
      worker.start(); assertTrue(begun.await(5, TimeUnit.SECONDS)); active.set(false); player.stop()
      assertTrue(done.await(2, TimeUnit.SECONDS)); assertNull(error); assertTrue(played in 1 until 160000)
    } finally { active.set(false); player.stop(); worker.join(1000) }
  }
  fun testCandidatePauseKeepsPlaybackAndResumesRemainingSamples() {
    val player = player(); val active = AtomicBoolean(true); val begun = CountDownLatch(1); val done = CountDownLatch(1)
    var played = -1
    val worker = Thread { try { played = player.play(ShortArray(16000) { 1200 }, { active.get() }) { begun.countDown() } } finally { done.countDown() } }
    try {
      player.pause(); worker.start(); assertFalse(begun.await(200, TimeUnit.MILLISECONDS)); player.resume()
      assertTrue(begun.await(3, TimeUnit.SECONDS)); player.pause(); assertFalse(done.await(200, TimeUnit.MILLISECONDS))
      player.resume(); assertTrue(done.await(4, TimeUnit.SECONDS)); assertEquals(16000, played)
    } finally { active.set(false); player.stop(); worker.join(1000) }
  }
  fun testCoordinatorWaitsForActualAudioAndResumesTheSameHeldAnswer() {
    val generating = CountDownLatch(1); val release = CountDownLatch(1)
    val began = CountDownLatch(1); val done = CountDownLatch(1)
    var generated = 0; var spoken = 0; var error: String? = null
    val controller = VoiceSessionController(); lateinit var speaker: VoiceSpeaker
    val synth = object : VoiceSynthesizer {
      override fun prepare() {}
      override fun generate(text: String): VoicePcm {
        generated++; generating.countDown(); check(release.await(5, TimeUnit.SECONDS))
        return VoicePcm(ShortArray(24000) { (2000 * kotlin.math.sin(it * .1)).toInt().toShort() }, 16000)
      }
      override fun close() {}
    }
    instrumentation.runOnMainSync {
      controller.ready(); controller.listen(); val token = controller.begin("answer"); controller.prepare("answer")
      speaker = VoiceSpeaker(activity, VoiceRenderReference(), synth) { _, _, end -> spoken = end }
      speaker.speak("完整回答。", playback = { playing ->
        controller.render("answer", token, playing); if (playing) began.countDown()
      }) { failure -> error = failure; controller.complete("answer", token); done.countDown() }
    }
    try {
      assertTrue(generating.await(3, TimeUnit.SECONDS)); assertEquals("synthesizing", controller.phase)
      assertFalse(began.await(150, TimeUnit.MILLISECONDS)); release.countDown(); assertTrue(began.await(5, TimeUnit.SECONDS))
      instrumentation.runOnMainSync {
        controller.candidate("input"); controller.partial("input", "对旁人说话"); controller.hearing("input")
        speaker.hold(controller.snapshot.held)
      }
      assertEquals("listening", controller.phase); assertFalse(done.await(250, TimeUnit.MILLISECONDS))
      instrumentation.runOnMainSync { controller.settle("input", "ignore"); speaker.hold(controller.snapshot.held) }
      assertTrue(done.await(5, TimeUnit.SECONDS)); assertNull(error); assertEquals(1, generated)
      assertEquals("完整回答。".length, spoken); assertEquals("listening", controller.phase)
    } finally { release.countDown(); instrumentation.runOnMainSync { speaker.close() } }
  }
  fun testInputHoldBeforeFirstAudioSurvivesSynthesisHandoff() {
    val release = CountDownLatch(1); val began = CountDownLatch(1); val done = CountDownLatch(1)
    val controller = VoiceSessionController(); lateinit var speaker: VoiceSpeaker
    var error: String? = null
    val synth = object : VoiceSynthesizer {
      override fun prepare() {}
      override fun generate(text: String): VoicePcm {
        check(release.await(5, TimeUnit.SECONDS)); return VoicePcm(ShortArray(8000) { 1200 }, 16000)
      }
      override fun close() {}
    }
    instrumentation.runOnMainSync {
      controller.ready(); val token = controller.begin("answer")
      controller.candidate("input"); controller.hearing("input"); controller.prepare("answer")
      speaker = VoiceSpeaker(activity, VoiceRenderReference(), synth) { _, _, _ -> }
      speaker.speak("回答。", playback = { playing ->
        controller.render("answer", token, playing); if (playing) began.countDown()
      }) { failure -> error = failure; controller.complete("answer", token); done.countDown() }
      speaker.hold(controller.snapshot.held)
    }
    try {
      release.countDown(); assertFalse(began.await(300, TimeUnit.MILLISECONDS)); assertEquals("listening", controller.phase)
      instrumentation.runOnMainSync { controller.settle("input", "ignore"); speaker.hold(controller.snapshot.held) }
      assertTrue(began.await(3, TimeUnit.SECONDS)); assertTrue(done.await(3, TimeUnit.SECONDS)); assertNull(error)
    } finally { release.countDown(); instrumentation.runOnMainSync { speaker.close() } }
  }
  fun testPlaybackGapIsBufferingAndCancelledCallbacksCannotSpeakForANewTurn() {
    val firstEnded = CountDownLatch(1); val buffering = CountDownLatch(1); val release = CountDownLatch(1); val done = CountDownLatch(1)
    val controller = VoiceSessionController(); lateinit var speaker: VoiceSpeaker
    var oldCompletions = 0; var error: String? = null; var staleState = 0
    val synth = object : VoiceSynthesizer {
      override fun prepare() {}
      override fun generate(text: String): VoicePcm {
        if (text == "后一句。") check(release.await(5, TimeUnit.SECONDS))
        return VoicePcm(ShortArray(8000) { 1200 }, 16000)
      }
      override fun close() {}
    }
    instrumentation.runOnMainSync {
      controller.ready(); val token = controller.begin("old"); controller.prepare("old")
      speaker = VoiceSpeaker(activity, VoiceRenderReference(), synth) { _, _, end -> if (end == "前一句。".length) firstEnded.countDown() }
      speaker.speak("前一句。后一句。", playback = { playing ->
        if (!controller.render("old", token, playing)) staleState++
        if (!playing) buffering.countDown()
      }) { oldCompletions++ }
    }
    try {
      assertTrue(firstEnded.await(3, TimeUnit.SECONDS)); assertTrue(buffering.await(3, TimeUnit.SECONDS)); assertEquals("buffering", controller.phase)
      instrumentation.runOnMainSync {
        controller.cancel(); speaker.stop(); val token = controller.begin("new"); controller.prepare("new")
        speaker.speak("新回答。", playback = { controller.render("new", token, it) }) { failure -> error = failure; controller.complete("new", token); done.countDown() }
      }
      release.countDown(); assertTrue(done.await(5, TimeUnit.SECONDS)); assertNull(error)
      assertEquals(0, oldCompletions); assertEquals(0, staleState); assertEquals("listening", controller.phase)
    } finally { release.countDown(); instrumentation.runOnMainSync { speaker.close() } }
  }
  fun testRealRecognitionHoldsBeforeSemanticSubmissionAndPreservesSlowContinuation() {
    // The actual AEC/VAD/ASR pipeline reads public synthesized speech, not a user microphone.
    val synth = LocalVoiceSynthesizer(instrumentation.targetContext)
    val clips = try {
      synth.prepare(); VoiceEcho(512).use { resampler ->
        listOf("等一下，我想先说一件事情。", "帮我播放我喜欢的歌曲。")
          .map { synth.generate(it).let { pcm -> resampler.resample(pcm.samples, pcm.sampleRate) } }
      }
    } finally { synth.close() }
    val frames = LinkedBlockingQueue<CapturedVoiceFrame>(); var frameIndex = 0L
    val start = System.nanoTime()
    fun feed(pcm: ShortArray) {
      for (offset in pcm.indices step 512) {
        val frame = ShortArray(512)
        pcm.copyInto(frame, endIndex = minOf(offset + 512, pcm.size), startIndex = offset)
        frames.add(CapturedVoiceFrame(frame, start + frameIndex++ * 32_000_000))
      }
    }
    val ready = CountDownLatch(1); val firstProbe = CountDownLatch(1); val finished = CountDownLatch(1)
    val heard = mutableListOf<String>(); val probes = mutableListOf<String>(); var failure: Throwable? = null
    val order = mutableListOf<String>(); lateinit var engine: VoiceAudioEngine
    val events = object : VoiceAudioEvents {
      override fun ready() { ready.countDown() }
      override fun armed(segment: String) {}
      override fun partial(segment: String, text: String) { synchronized(heard) { heard.add(text) } }
      override fun candidate(segment: String) { synchronized(order) { order.add("candidate") } }
      override fun hearing(segment: String, referenceEpoch: Long) { synchronized(order) { order.add("hearing") } }
      override fun probe(segment: String, id: String, text: String, wake: Boolean, silenceMs: Long) {
        synchronized(order) { order.add("probe") }; probes.add(text)
        engine.decide(id, if (probes.size == 1) "wait" else "respond")
      }
      override fun revoked(id: String) {}
      override fun utterance(text: String, wake: Boolean) { heard.add(text); finished.countDown() }
      override fun settled(segment: String, action: String) { if (action == "wait") firstProbe.countDown() }
      override fun assessmentError(message: String) { failure = IllegalStateException(message); finished.countDown(); firstProbe.countDown() }
      override fun microphoneState(silenced: Boolean) {}
      override fun failure(error: Throwable) { failure = error; ready.countDown(); finished.countDown(); firstProbe.countDown() }
    }
    engine = VoiceAudioEngine(instrumentation.targetContext, VoiceRenderReference(), events) { _, _ -> object : VoiceFrameSource {
      override fun start(ready: () -> Unit) { ready() }
      override fun next(): CapturedVoiceFrame? = frames.poll(100, TimeUnit.MILLISECONDS)
      override fun stop() { frames.clear() }
    } }
    try {
      engine.arm(); engine.start(); assertTrue(ready.await(30, TimeUnit.SECONDS)); assertNull(failure)
      feed(ShortArray(16000)); feed(clips[0]); feed(ShortArray(32000))
      assertTrue("First real recognition never reached semantic assessment: $heard", firstProbe.await(20, TimeUnit.SECONDS)); assertNull(failure)
      assertEquals(1, probes.size); assertFalse(finished.await(150, TimeUnit.MILLISECONDS))
      feed(clips[1]); feed(ShortArray(32000))
      assertTrue("Continuation never committed: $heard", finished.await(20, TimeUnit.SECONDS)); assertNull(failure)
      assertEquals(2, probes.size); assertTrue(probes[1].startsWith(probes[0])); assertTrue(probes[1].length > probes[0].length)
      assertTrue("Speech was not held before semantic submission: $order", order.indexOf("hearing") in 0 until order.indexOf("probe"))
    } finally { engine.stop() }
  }
  private data class AcousticResult(val holds: Int, val firstHoldAt: Int?, val partials: List<String>, val probes: List<String>, val submissions: List<String>)
  private fun acousticFixture(far: ShortArray, mic: ShortArray, clocked: Boolean = true, armed: Boolean = true, captureClocked: Boolean = true): AcousticResult {
    val base = System.nanoTime(); val size = 512
    val reference = VoiceRenderReference()
    val clip = reference.begin(far, base)
    if (clocked) reference.clock(clip, 0, base)
    val finished = CountDownLatch(1); val ready = CountDownLatch(1)
    val controller = VoiceSessionController(); controller.ready(); val token = controller.begin("answer")
    controller.prepare("answer"); controller.render("answer", token, true)
    val partials = mutableListOf<String>(); val probes = mutableListOf<String>(); val submissions = mutableListOf<String>()
    var holds = 0; var firstHoldAt: Int? = null; var failure: Throwable? = null; var offset = 0
    lateinit var engine: VoiceAudioEngine
    val events = object : VoiceAudioEvents {
      override fun ready() { ready.countDown() }
      override fun armed(segment: String) { controller.listen(segment) }
      override fun candidate(segment: String) { controller.candidate(segment) }
      override fun hearing(segment: String, referenceEpoch: Long) {
        if (!reference.isCurrent(referenceEpoch)) return
        holds++; if (firstHoldAt == null) firstHoldAt = offset - size; controller.hearing(segment)
      }
      override fun partial(segment: String, text: String) { if (text.isNotBlank()) partials.add(text); controller.partial(segment, text) }
      override fun probe(segment: String, id: String, text: String, wake: Boolean, silenceMs: Long) { probes.add(text); engine.decide(id, "respond") }
      override fun utterance(text: String, wake: Boolean) { submissions.add(text) }
      override fun settled(segment: String, action: String) { controller.settle(segment, action) }
      override fun revoked(id: String) {}
      override fun assessmentError(message: String) { failure = IllegalStateException(message); finished.countDown() }
      override fun microphoneState(silenced: Boolean) {}
      override fun failure(error: Throwable) { failure = error; finished.countDown(); ready.countDown() }
    }
    engine = VoiceAudioEngine(instrumentation.targetContext, reference, events) { _, _ -> object : VoiceFrameSource {
      override fun start(ready: () -> Unit) { ready() }
      override fun next(): CapturedVoiceFrame? {
        if (offset >= mic.size) { finished.countDown(); Thread.sleep(10); return null }
        val start = offset; offset += size
        return CapturedVoiceFrame(ShortArray(size) { i -> mic.getOrElse(start + i) { 0 } }, base + start * 1_000_000_000L / 16000, captureClocked)
      }
      override fun stop() {}
    } }
    try {
      if (armed) engine.arm()
      engine.start(); assertTrue(ready.await(30, TimeUnit.SECONDS))
      assertTrue("Acoustic fixture did not finish", finished.await(60, TimeUnit.SECONDS)); assertNull(failure)
      return AcousticResult(holds, firstHoldAt, partials.toList(), probes.toList(), submissions.toList())
    } finally { engine.stop() }
  }
  private fun acousticSpeech(): List<ShortArray> {
    val synth = LocalVoiceSynthesizer(instrumentation.targetContext)
    return try {
      synth.prepare(); VoiceEcho(512).use { resampler ->
        listOf("BLACK，今天已经跑了三公里。现在告诉你今天的训练安排。", "等一下，我想先听音乐，帮我播放我喜欢的歌曲。")
          .map { text -> synth.generate(text).let { resampler.resample(it.samples, it.sampleRate) } }
      }
    } finally { synth.close() }
  }
  private fun reflected(far: ShortArray, delay: Int, clip: Boolean = false, noise: Boolean = false): ShortArray = ShortArray(far.size + 32000) { i ->
    val echo = far.getOrElse(i - delay) { 0 } * .55 + far.getOrElse(i - delay - 432) { 0 } * .12
    val shaped = if (clip) echo.coerceIn(-1800.0, 1800.0) else echo
    (shaped + if (noise) kotlin.math.sin(i * 2.37) * 18 else 0.0).coerceIn(-32768.0, 32767.0).toInt().toShort()
  }
  fun testEchoOnlyCannotHoldTranscribeWakeOrSubmitEvenWhenItContainsBlack() {
    val own = acousticSpeech()[0]
    val far = ShortArray(6400 + own.size * 3 + 8000) { i -> if (i in 6400 until 6400 + own.size * 3) own[(i - 6400) % own.size] else 0 }
    val room = reflected(far, 1280)
    val louder = ShortArray(room.size) { i -> (room[i] * if (i < room.size / 2) 1.0 else 1.8).coerceIn(-32768.0, 32767.0).toInt().toShort() }
    val delayed = reflected(far, 3200)
    val shifted = ShortArray(room.size) { i -> if (i < room.size / 2) room[i] else delayed[i] }
    val compressed = ShortArray(room.size) { i -> (kotlin.math.tanh(room[i] / 32768.0 * 5) / 5 * 32768).toInt().toShort() }
    for ((label, mic) in listOf("early" to reflected(far, 320), "room" to reflected(far, 1280, noise = true),
      "long-delay-clipped" to reflected(far, 5120, clip = true), "gain-change" to louder,
      "delay-change" to shifted, "compression" to compressed)) {
      val result = acousticFixture(far, mic)
      assertEquals("$label self-pause: $result", 0, result.holds)
      assertTrue("$label echo reached ASR/model: $result", result.partials.isEmpty() && result.probes.isEmpty() && result.submissions.isEmpty())
    }
    val wake = acousticFixture(far, reflected(far, 1280), armed = false)
    assertTrue("Assistant woke itself: $wake", wake.partials.isEmpty() && wake.probes.isEmpty() && wake.submissions.isEmpty())
  }
  fun testUnreliablePlaybackClockCannotAuthorizeAnInterruptionOrFeedTheModel() {
    val own = acousticSpeech()[0]
    val far = ShortArray(6400 + own.size + 16000) { i -> own.getOrElse(i - 6400) { 0 } }
    for (captureClocked in listOf(true, false)) {
      val result = acousticFixture(far, reflected(far, 2560), clocked = !captureClocked, captureClocked = captureClocked)
      assertEquals(0, result.holds); assertTrue(result.partials.isEmpty()); assertTrue(result.probes.isEmpty()); assertTrue(result.submissions.isEmpty())
    }
  }
  fun testIndependentUserSpeechDuringPlaybackStillHoldsAndReachesTheModel() {
    val speech = acousticSpeech(); val own = speech[0]; val user = speech[1]; val at = 128000
    val far = ShortArray(at + user.size + 32000) { own[it % own.size] }
    val mic = reflected(far, 1280)
    for (i in user.indices) mic[at + i] = (mic[at + i] + user[i] * .8).coerceIn(-32768.0, 32767.0).toInt().toShort()
    val result = acousticFixture(far, mic)
    assertTrue("Double-talk could not interrupt: $result", result.holds > 0)
    assertTrue("Held before user speech, or too late to be useful: $result", (result.firstHoldAt ?: -1) in at until at + 24000)
    assertTrue("Real user was lost before semantic submission: $result", result.probes.isNotEmpty() && result.submissions.isNotEmpty())
    assertTrue("The submitted text was not the actual user command: $result", result.submissions.any { it.contains("音乐") || it.contains("播放") })
  }
  fun testBundledChineseModelActuallySynthesizesWithoutPhoneTts() {
    val synth = LocalVoiceSynthesizer(instrumentation.targetContext)
    try {
      synth.prepare()
      for (text in listOf("我在。", "今天已经跑了三公里。")) {
        val audio = synth.generate(text)
        assertEquals(44100, audio.sampleRate); assertTrue(audio.samples.size > 5000)
        assertTrue(audio.samples.any { it != 0.toShort() })
      }
    } finally { synth.close() }
  }
  fun testLocalSynthesisAndPlaybackCompleteExactlyOnce() {
    val done = CountDownLatch(1); var completions = 0; var error: String? = null; var spoken = 0
    lateinit var speaker: VoiceSpeaker
    instrumentation.runOnMainSync {
      speaker = VoiceSpeaker(activity, VoiceRenderReference()) { _, _, end -> spoken = end }
      speaker.speak("我在。可以开始训练。") { failure -> error = failure; completions++; done.countDown() }
    }
    try {
      assertTrue(done.await(60, TimeUnit.SECONDS)); assertNull(error); assertEquals(1, completions); assertEquals("我在。可以开始训练。".length, spoken)
    } finally { instrumentation.runOnMainSync { speaker.close() } }
  }
  fun testSynthesisFailurePreservesOneRealErrorWithoutSystemFallback() {
    val done = CountDownLatch(1); var error: String? = null
    val failing = object : VoiceSynthesizer {
      override fun prepare() {}
      override fun generate(text: String): VoicePcm = throw IllegalStateException("fixture synthesis failure")
      override fun close() {}
    }
    lateinit var speaker: VoiceSpeaker
    instrumentation.runOnMainSync {
      speaker = VoiceSpeaker(activity, VoiceRenderReference(), failing) { _, _, _ -> }
      speaker.speak("测试。") { failure -> error = failure; done.countDown() }
    }
    try { assertTrue(done.await(5, TimeUnit.SECONDS)); assertTrue(error!!.contains("fixture synthesis failure")); assertFalse(error!!.contains("-4")) }
    finally { instrumentation.runOnMainSync { speaker.close() } }
  }
  fun testLaterSynthesisFailureDoesNotCutOffAlreadyPlayingSentence() {
    val began = CountDownLatch(1); val done = CountDownLatch(1)
    var spoken = 0; var completions = 0; var error: String? = null
    val first = "第一句需要完整播放。"
    val synth = object : VoiceSynthesizer {
      override fun prepare() {}
      override fun generate(text: String): VoicePcm {
        if (text == first) return VoicePcm(ShortArray(24000) { (2000 * kotlin.math.sin(it * .1)).toInt().toShort() }, 16000)
        check(began.await(5, TimeUnit.SECONDS)) { "first sentence did not start" }
        throw IllegalStateException("later segment failed")
      }
      override fun close() {}
    }
    lateinit var speaker: VoiceSpeaker
    instrumentation.runOnMainSync {
      speaker = VoiceSpeaker(activity, VoiceRenderReference(), synth) { _, _, end ->
        spoken = end; if (end == 0) began.countDown()
      }
      speaker.speak(first + "第二句合成失败。") { failure -> error = failure; completions++; done.countDown() }
    }
    try {
      assertTrue(done.await(8, TimeUnit.SECONDS)); assertTrue(error!!.contains("later segment failed"))
      assertEquals(1, completions); assertEquals("Failure in a later segment cut off the first sentence", first.length, spoken)
    } finally { instrumentation.runOnMainSync { speaker.close() } }
  }
  fun testBundledModelReadsParagraphsAndMarkdownToTheEnd() {
    val text = "**我在。**\n\n## 今日训练\n可以开始训练。\n\n今天跑了三公里。\n**"
    val done = CountDownLatch(1); var error: String? = null; var completions = 0; var spoken = 0
    lateinit var speaker: VoiceSpeaker
    instrumentation.runOnMainSync {
      speaker = VoiceSpeaker(activity, VoiceRenderReference()) { _, _, end -> spoken = end }
      speaker.speak(text) { failure -> error = failure; completions++; done.countDown() }
    }
    try {
      assertTrue(done.await(90, TimeUnit.SECONDS)); assertNull(error)
      assertEquals(1, completions); assertEquals(text.length, spoken)
    } finally { instrumentation.runOnMainSync { speaker.close() } }
  }
  fun testFormattingOnlyReplyDoesNotCallSynthesis() {
    val done = CountDownLatch(1); var calls = 0; var error: String? = null
    val synth = object : VoiceSynthesizer {
      override fun prepare() {}
      override fun generate(text: String): VoicePcm { calls++; error("Formatting must not reach synthesis") }
      override fun close() {}
    }
    lateinit var speaker: VoiceSpeaker
    instrumentation.runOnMainSync {
      speaker = VoiceSpeaker(activity, VoiceRenderReference(), synth) { _, _, _ -> }
      speaker.speak("\n**\n🎵\n") { failure -> error = failure; done.countDown() }
    }
    try { assertTrue(done.await(3, TimeUnit.SECONDS)); assertNull(error); assertEquals(0, calls) }
    finally { instrumentation.runOnMainSync { speaker.close() } }
  }
  fun testTransientEmptyAudioRetriesOnlyTheUnplayedSegment() {
    val done = CountDownLatch(1); var calls = 0; var error: String? = null; var spoken = 0
    val synth = object : VoiceSynthesizer {
      override fun prepare() {}
      override fun generate(text: String): VoicePcm {
        calls++
        if (calls == 1) throw VoiceSynthesisException("synthesis_empty", "empty fixture")
        return VoicePcm(ShortArray(4000) { 1000 }, 16000)
      }
      override fun close() {}
    }
    lateinit var speaker: VoiceSpeaker
    instrumentation.runOnMainSync {
      speaker = VoiceSpeaker(activity, VoiceRenderReference(), synth) { _, _, end -> spoken = end }
      speaker.speak("测试。") { failure -> error = failure; done.countDown() }
    }
    try { assertTrue(done.await(5, TimeUnit.SECONDS)); assertNull(error); assertEquals(2, calls); assertEquals(3, spoken) }
    finally { instrumentation.runOnMainSync { speaker.close() } }
  }
  fun testRepeatedEmptyAudioReportsTheSegmentAndStopsRetrying() {
    val done = CountDownLatch(1); var calls = 0; var error: String? = null; var spoken = 0
    val synth = object : VoiceSynthesizer {
      override fun prepare() {}
      override fun generate(text: String): VoicePcm { calls++; throw VoiceSynthesisException("synthesis_empty", "empty fixture") }
      override fun close() {}
    }
    lateinit var speaker: VoiceSpeaker
    instrumentation.runOnMainSync {
      speaker = VoiceSpeaker(activity, VoiceRenderReference(), synth) { _, _, end -> spoken = end }
      speaker.speak("测试。") { failure -> error = failure; done.countDown() }
    }
    try {
      assertTrue(done.await(5, TimeUnit.SECONDS)); assertEquals(2, calls); assertEquals(0, spoken)
      assertTrue(error!!.contains("1/1")); assertTrue(error!!.contains("synthesis_empty")); assertTrue(error!!.contains("已重试 1 次"))
    } finally { instrumentation.runOnMainSync { speaker.close() } }
  }
  fun testInitializationFailureIsNotReportedAsEmptyAudioOrSegmentZero() {
    val done = CountDownLatch(1); var error: String? = null
    val synth = object : VoiceSynthesizer {
      override fun prepare() { throw IllegalStateException("initialization fixture failure") }
      override fun generate(text: String): VoicePcm = error("Failed initialization must not generate")
      override fun close() {}
    }
    lateinit var speaker: VoiceSpeaker
    instrumentation.runOnMainSync {
      speaker = VoiceSpeaker(activity, VoiceRenderReference(), synth) { _, _, _ -> }
      speaker.speak("测试。") { failure -> error = failure; done.countDown() }
    }
    try {
      assertTrue(done.await(5, TimeUnit.SECONDS)); assertTrue(error!!.contains("synthesis_prepare_failed"))
      assertFalse(error!!.contains("0/1")); assertFalse(error!!.contains("synthesis_empty"))
    } finally { instrumentation.runOnMainSync { speaker.close() } }
  }
  fun testHealthyPlaybackDoesNotExpireWhileLaterAudioIsBeingPrepared() {
    val done = CountDownLatch(1); var error: String? = null; var spoken = 0
    val synth = object : VoiceSynthesizer {
      override fun prepare() {}
      override fun generate(text: String): VoicePcm {
        if (text == "后一句。") Thread.sleep(600)
        return VoicePcm(ShortArray(16000) { 1000 }, 16000)
      }
      override fun close() {}
    }
    lateinit var speaker: VoiceSpeaker
    instrumentation.runOnMainSync {
      speaker = VoiceSpeaker(activity, VoiceRenderReference(), synth, outputTimeoutMs = 300) { _, _, end -> spoken = end }
      speaker.speak("前一句。后一句。") { failure -> error = failure; done.countDown() }
    }
    try { assertTrue(done.await(6, TimeUnit.SECONDS)); assertNull(error); assertEquals(8, spoken) }
    finally { instrumentation.runOnMainSync { speaker.close() } }
  }
  fun testCancelledNativeResultCannotSpeakOrCompleteTheReplacement() {
    val entered = CountDownLatch(1); val release = CountDownLatch(1); val done = CountDownLatch(1)
    var oldCompletions = 0; var error: String? = null; var spoken = 0
    val synth = object : VoiceSynthesizer {
      override fun prepare() {}
      override fun generate(text: String): VoicePcm {
        if (text == "旧回答。") { entered.countDown(); check(release.await(5, TimeUnit.SECONDS)) }
        return VoicePcm(ShortArray(4000) { 1000 }, 16000)
      }
      override fun close() {}
    }
    lateinit var speaker: VoiceSpeaker
    instrumentation.runOnMainSync {
      speaker = VoiceSpeaker(activity, VoiceRenderReference(), synth) { _, _, end -> spoken = end }
      speaker.speak("旧回答。") { oldCompletions++ }
    }
    try {
      assertTrue(entered.await(5, TimeUnit.SECONDS))
      instrumentation.runOnMainSync { speaker.speak("新回答。") { failure -> error = failure; done.countDown() } }
      release.countDown()
      assertTrue(done.await(5, TimeUnit.SECONDS)); assertNull(error); assertEquals(0, oldCompletions); assertEquals(4, spoken)
    } finally { release.countDown(); instrumentation.runOnMainSync { speaker.close() } }
  }
  fun testQueuedAndRunningTimeoutsHaveDifferentErrors() {
    val entered = CountDownLatch(1); val release = CountDownLatch(1)
    val firstDone = CountDownLatch(1); val nextDone = CountDownLatch(1)
    var firstError: String? = null; var nextError: String? = null; var spoken = 0
    val synth = object : VoiceSynthesizer {
      override fun prepare() {}
      override fun generate(text: String): VoicePcm {
        entered.countDown(); check(release.await(8, TimeUnit.SECONDS))
        return VoicePcm(ShortArray(4000) { 1000 }, 16000)
      }
      override fun close() {}
    }
    lateinit var speaker: VoiceSpeaker
    instrumentation.runOnMainSync {
      speaker = VoiceSpeaker(activity, VoiceRenderReference(), synth, outputTimeoutMs = 700) { _, _, end -> spoken = end }
      speaker.speak("正在合成。") { error -> firstError = error; firstDone.countDown() }
    }
    try {
      assertTrue(entered.await(5, TimeUnit.SECONDS)); assertTrue(firstDone.await(4, TimeUnit.SECONDS))
      assertTrue(firstError!!.contains("synthesis_timeout"))
      instrumentation.runOnMainSync { speaker.speak("排队等待。") { error -> nextError = error; nextDone.countDown() } }
      assertTrue(nextDone.await(4, TimeUnit.SECONDS)); assertTrue(nextError!!.contains("synthesis_queue_timeout")); assertEquals(0, spoken)
    } finally { release.countDown(); instrumentation.runOnMainSync { speaker.close() } }
  }
  fun testProductionEchoJniPreservesIndependentInputAndResamples() {
    VoiceEcho(512).use { echo ->
      var power = 0.0
      repeat(20) { frame ->
        val input = ShortArray(512) { (5000 * kotlin.math.sin((frame * 512 + it) * .12)).toInt().toShort() }
        echo.process(input, ShortArray(512)).forEach { power += it * it }
      }
      assertTrue(power > 1)
      for (rate in listOf(8000, 22050, 24000, 44100, 48000)) {
        val pcm = echo.resample(ShortArray(rate) { 1000 }, rate)
        assertEquals(16000, pcm.size); assertTrue(pcm.last() > 0)
      }
    }
  }
  fun testDelayedEchoIsReducedAndSimultaneousNearEndIsNotFrameMuted() {
    // Real Chinese speech with a deterministic two-tap acoustic path. A steady
    // tone is not a speech-preservation fixture: suppression can classify it as
    // stationary interference. No user microphone or enrolled identity is used.
    val synth = LocalVoiceSynthesizer(instrumentation.targetContext)
    val sources = try {
      synth.prepare()
      VoiceEcho(512).use { resampler ->
        listOf("今天已经跑了三公里，现在告诉你今天的训练安排。", "等一下，我想先听音乐，帮我播放我喜欢的歌曲。")
          .map { text -> synth.generate(text).let { resampler.resample(it.samples, it.sampleRate) } }
      }
    } finally { synth.close() }
    val size = 512; val frames = 400
    val far = ShortArray(size * frames) { sources[0][it % sources[0].size] }
    val near = ShortArray(far.size) { if (it >= 250 * size) (sources[1][(it - 250 * size) % sources[1].size] * .5).toInt().toShort() else 0 }
    val output = FloatArray(far.size)
    var echoInput = 0.0; var echoOutput = 0.0
    VoiceEcho(size).use { echo ->
      repeat(frames) { frame ->
        val start = frame * size
        val rendered = far.copyOfRange(start, start + size)
        val captured = ShortArray(size) { offset ->
          val i = start + offset
          val reflected = (if (i >= 800) far[i - 800] * .55 else 0.0) + (if (i >= 1440) far[i - 1440] * .18 else 0.0)
          (reflected + near[i]).coerceIn(-32768.0, 32767.0).toInt().toShort()
        }
        val clean = echo.process(captured, rendered)
        clean.copyInto(output, start)
        if (frame in 180 until 250) for (i in clean.indices) {
          echoInput += captured[i].toDouble() * captured[i]
          echoOutput += clean[i].toDouble() * clean[i] * 32768.0 * 32768.0
        }
      }
    }
    val echoRatio = echoOutput / echoInput
    fun nearGain(step: Int): Double {
      var gain = 0.0
      // Alignment includes AEC's fixed internal framing latency. Measure the
      // retained independent speech, not just residual echo energy in the output.
      for (delay in 0..1024 step step) {
        var cross = 0.0; var power = 0.0
        for (i in 300 * size until near.size) {
          cross += output[i] * 32768.0 * near[i - delay]
          power += near[i - delay].toDouble() * near[i - delay]
        }
        if (power > 0) gain = maxOf(gain, cross / power)
      }
      return gain
    }
    // Finer alignment is diagnostic only: do not loosen the original acceptance assertion.
    val nearGain = nearGain(16); val sampleAlignedGain = nearGain(1)
    android.util.Log.i("BLACK-EchoTest", "speech echo energy ratio=$echoRatio; double-talk near gain=$nearGain; sample-aligned gain=$sampleAlignedGain")
    assertTrue("Delayed echo was not reduced: $echoRatio", echoRatio < .2)
    assertTrue("Independent near-end speech was suppressed: $nearGain", nearGain > .2)
  }
}
class VoicePlaybackActivity : Activity()
