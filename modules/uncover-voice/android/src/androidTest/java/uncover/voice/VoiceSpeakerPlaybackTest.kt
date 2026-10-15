package uncover.voice

import android.app.Activity
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.test.InstrumentationTestCase
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/** Real Android AudioTrack, not a mocked player or the service's fall-through listening state. */
@Suppress("DEPRECATION")
class VoiceSpeakerPlaybackTest : InstrumentationTestCase() {
  private lateinit var activity: Activity
  override fun setUp() {
    super.setUp()
    // Android 15 requires the foreground app or a real FGS to obtain audio focus.
    // This test-only activity grants neither microphone consent nor a service exemption.
    activity = instrumentation.startActivitySync(Intent(instrumentation.targetContext, VoicePlaybackActivity::class.java)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    instrumentation.waitForIdleSync()
  }
  override fun tearDown() {
    instrumentation.runOnMainSync { activity.finish() }
    super.tearDown()
  }
  fun testStaticTrackNeedsAudioBeforeItBecomesReady() {
    val audio = VoicePcm(ShortArray(8000) { (2000 * kotlin.math.sin(it * .1)).toInt().toShort() }, 16000)
    val output = AudioTrack.Builder().setAudioAttributes(AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_ASSISTANT).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
      .setAudioFormat(AudioFormat.Builder().setSampleRate(audio.sampleRate)
        .setEncoding(AudioFormat.ENCODING_PCM_16BIT).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
      .setTransferMode(AudioTrack.MODE_STATIC).setBufferSizeInBytes(audio.samples.size * 2).build()
    try {
      assertEquals(AudioTrack.STATE_NO_STATIC_DATA, output.state)
      assertEquals(audio.samples.size, output.write(audio.samples, 0, audio.samples.size))
      assertEquals(AudioTrack.STATE_INITIALIZED, output.state)
    } finally { output.release() }
  }

  fun testProductionPcmPlayerActuallyPlaysAndCanPlayAgain() {
    val player = VoicePcmPlayer(VoiceRenderReference(), AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_ASSISTANT).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
    try {
      repeat(2) {
        var started = false
        val pcm = ShortArray(8000) { (2000 * kotlin.math.sin(it * .1)).toInt().toShort() }
        val played = player.play(pcm, { true }) { started = true }
        assertTrue("Actual playback head must advance", started)
        assertEquals("Actual rendered frames, not service listening state", pcm.size, played)
      }
    } finally { player.stop() }
  }
  fun testPcmCancellationStopsRealPlaybackWithoutCompletingTheQueue() {
    val player = VoicePcmPlayer(VoiceRenderReference(), AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_ASSISTANT).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
    val active = AtomicBoolean(true); val begun = CountDownLatch(1); val complete = CountDownLatch(1)
    var played = -1; var error: Throwable? = null
    val worker = Thread {
      try { played = player.play(ShortArray(160000) { 2000 }, { active.get() }) { begun.countDown() } }
      catch (failure: Throwable) { error = failure }
      finally { complete.countDown() }
    }
    try {
      worker.start(); assertTrue(begun.await(5, TimeUnit.SECONDS))
      active.set(false); player.stop()
      assertTrue("Stop must not wait for the ten-second PCM", complete.await(1, TimeUnit.SECONDS))
      assertNull(error); assertTrue(played in 1 until 160000)
    } finally { active.set(false); player.stop(); worker.join(1000) }
  }
  fun testProductionEchoJniPreservesIndependentInputAndResamples() {
    VoiceEcho(512).use { echo ->
      var power = 0.0
      repeat(20) { frame ->
        val input = ShortArray(512) { (5000 * kotlin.math.sin((frame * 512 + it) * .12)).toInt().toShort() }
        echo.process(input, ShortArray(512)).forEach { power += it * it }
      }
      assertTrue("No render reference must not mute independent microphone PCM", power > 1)
      for (rate in listOf(8000, 22050, 24000, 44100, 48000)) {
        val resampled = echo.resample(ShortArray(rate) { 1000 }, rate)
        assertEquals("Complete output duration at $rate Hz", 16000, resampled.size)
        assertTrue("Filter tail must not erase the last samples", resampled.last() > 0)
      }
    }
  }
}

class VoicePlaybackActivity : Activity()
