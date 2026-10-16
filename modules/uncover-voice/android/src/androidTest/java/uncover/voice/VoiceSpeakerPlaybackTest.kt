package uncover.voice

import android.app.Activity
import android.content.Intent
import android.media.AudioAttributes
import android.test.InstrumentationTestCase
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

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
