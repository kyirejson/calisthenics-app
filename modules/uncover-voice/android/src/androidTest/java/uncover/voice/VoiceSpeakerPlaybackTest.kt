package uncover.voice

import android.app.Activity
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.test.InstrumentationTestCase
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

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
    val audio = VoicePcm.read(instrumentation.targetContext.assets.open("black-voice/iam.wav").use { it.readBytes() })
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

  fun testPackagedAcknowledgementActuallyPlaysAndCanPlayAgain() {
    val speaker = AtomicReference<VoiceSpeaker>()
    instrumentation.runOnMainSync {
      speaker.set(VoiceSpeaker(instrumentation.targetContext, VoiceRenderReference()) { _, _, _ -> })
    }
    try {
      repeat(2) {
        val complete = CountDownLatch(1)
        val error = AtomicReference<String?>()
        instrumentation.runOnMainSync {
          try { speaker.get().acknowledge { value -> error.set(value); complete.countDown() } }
          catch (failure: Exception) { error.set(failure.message ?: failure.javaClass.simpleName); complete.countDown() }
        }
        assertTrue("AudioTrack must finish rendering, not just enter listening", complete.await(10, TimeUnit.SECONDS))
        assertNull("Acknowledgement failed: ${error.get()}", error.get())
      }
    } finally { instrumentation.runOnMainSync { speaker.get().close() } }
  }
}

class VoicePlaybackActivity : Activity()
