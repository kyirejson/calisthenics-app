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
    var nearGain = 0.0
    // Alignment includes AEC's fixed internal framing latency. Measure the
    // retained independent speech, not just residual echo energy in the output.
    for (delay in 0..1024 step 16) {
      var cross = 0.0; var power = 0.0
      for (i in 300 * size until near.size) {
        cross += output[i] * 32768.0 * near[i - delay]
        power += near[i - delay].toDouble() * near[i - delay]
      }
      if (power > 0) nearGain = maxOf(nearGain, cross / power)
    }
    android.util.Log.i("BLACK-EchoTest", "speech echo energy ratio=$echoRatio; double-talk near gain=$nearGain")
    assertTrue("Delayed echo was not reduced: $echoRatio", echoRatio < .2)
    assertTrue("Independent near-end speech was suppressed: $nearGain", nearGain > .2)
  }
}
class VoicePlaybackActivity : Activity()
