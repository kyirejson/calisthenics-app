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
import com.k2fsa.sherpa.onnx.*
import android.content.ContextWrapper
import java.io.File
import java.util.UUID
import org.json.JSONObject

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
  fun testTtsFileSynthesisReconnectsOnceAndCompletesOnlyOnce() {
    VoiceFixtureTtsService.failures.set(1); VoiceFixtureTtsService.requests.set(0)
    val done = CountDownLatch(1); var completions = 0; var failure: String? = null; var spokenEnd = 0
    lateinit var speaker: VoiceSpeaker
    instrumentation.runOnMainSync {
      speaker = VoiceSpeaker(activity, VoiceRenderReference(), instrumentation.context.packageName) { _, _, end -> spokenEnd = end }
      speaker.speak("第一句。第二句。") { error -> completions++; failure = error; done.countDown() }
    }
    try {
      assertTrue("System synthesis + retry + actual PCM playback must finish", done.await(25, TimeUnit.SECONDS))
      assertNull(failure); assertEquals(1, completions); assertEquals("第一句。第二句。".length, spokenEnd)
      assertEquals("One failed synthesis then exactly two successful chunks", 3, VoiceFixtureTtsService.requests.get())
    } finally { instrumentation.runOnMainSync { speaker.close() } }
  }
  fun testCandidatePauseKeepsPlaybackAndResumesRemainingSamples() {
    val player = VoicePcmPlayer(VoiceRenderReference(), AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANT).build())
    val started = CountDownLatch(1); val complete = CountDownLatch(1); val active = AtomicBoolean(true); var played = -1; var failure: Throwable? = null
    val thread = Thread { try { played = player.play(ShortArray(32000) { 1500 }, { active.get() }) { started.countDown() } } catch (error: Throwable) { failure = error } finally { complete.countDown() } }
    try {
      player.pause(); thread.start()
      assertFalse("Paused candidate cannot start or discard the answer", started.await(200, TimeUnit.MILLISECONDS))
      player.resume(); assertTrue(started.await(3, TimeUnit.SECONDS)); player.pause()
      assertFalse("Temporary pause is not completion/cancellation", complete.await(250, TimeUnit.MILLISECONDS))
      player.resume(); assertTrue(complete.await(5, TimeUnit.SECONDS)); assertNull(failure); assertEquals(32000, played)
    } finally { active.set(false); player.stop(); thread.join(1000) }
  }
  fun testRealSpeakerModelAcceptsHeldOutOwnerSpeechAndRejectsAnotherSpeaker() {
    val extractor = SpeakerEmbeddingExtractor(instrumentation.targetContext.assets, SpeakerEmbeddingExtractorConfig(model = "black-voice/speaker/campplus.onnx", numThreads = 1))
    fun audio(name: String): FloatArray {
      val pcm = VoicePcm.read(instrumentation.context.assets.open("voice-speaker-fixtures/$name").use { it.readBytes() })
      assertEquals(16000, pcm.sampleRate); return FloatArray(pcm.samples.size) { pcm.samples[it] / 32768f }
    }
    fun embedding(samples: FloatArray): FloatArray {
      val stream = extractor.createStream()
      try { stream.acceptWaveform(samples, 16000); stream.inputFinished(); assertTrue(extractor.isReady(stream)); return extractor.compute(stream) }
      finally { stream.release() }
    }
    try {
      val a = audio("speaker1_a_cn_16k.wav")
      val b = audio("speaker1_b_cn_16k.wav")
      val stranger = audio("speaker2_a_cn_16k.wav")
      val profile = VoiceIdentity.enroll(listOf(embedding(a.copyOfRange(0, 48000)), embedding(a.copyOfRange(8000, 56000)), embedding(FloatArray(a.size) { a[it] * .7f })))
      val ownEmbedding = embedding(b); val strangerEmbedding = embedding(stranger)
      val quiet = FloatArray(b.size) { b[it] * .5f + .001f * kotlin.math.sin(it * .87).toFloat() }
      val quietEmbedding = embedding(quiet)
      fun scores(vector: FloatArray) = profile.embeddings.map { VoiceIdentity.similarity(it, VoiceIdentity.normalized(vector)) }
      val metrics = "threshold=${VoiceIdentity.THRESHOLD}; held-out=${scores(ownEmbedding)}; stranger=${scores(strangerEmbedding)}; gain/noise=${scores(quietEmbedding)}"
      android.util.Log.i("VoiceSpeakerFixture", metrics)
      assertTrue("Held-out recording must match enrolled speaker: $metrics", VoiceIdentity.accepts(profile, ownEmbedding, b.size / 16L))
      assertFalse("Different actual speaker must not enter the Agent: $metrics", VoiceIdentity.accepts(profile, strangerEmbedding, stranger.size / 16L))
      assertTrue("Moderate gain/noise must not change owner identity: $metrics", VoiceIdentity.accepts(profile, quietEmbedding, quiet.size / 16L))
    } finally { extractor.release() }
  }
  fun testOwnerStoreEncryptsEmbeddingsAndCancelledEnrollmentCannotReplaceThem() {
    val directory = File(instrumentation.targetContext.noBackupFilesDir, "owner-fixture-${UUID.randomUUID()}").apply { mkdirs() }
    val context = object : ContextWrapper(instrumentation.targetContext) { override fun getNoBackupFilesDir() = directory }
    val store = VoiceOwnerStore(context)
    val profile = VoiceIdentity.enroll(listOf(floatArrayOf(1f, .1f), floatArrayOf(1f, .12f), floatArrayOf(1f, .08f)))
    try {
      val enrolled = VoiceIdentity.complete(profile, List(3) { listOf(profile.embeddings.first()) }, List(3) { profile.embeddings.first() }, profile.embeddings.first(), 400)
      store.commitEnrollment(enrolled, store.beginEnrollment()); assertTrue(store.exists()); assertNotNull(store.read())
      val bytes = File(directory, "black-owner-v1.sealed").readBytes()
      assertFalse("Plain embeddings must never be persisted", bytes.toString(Charsets.UTF_8).contains("embeddings"))
      val cancelled = store.beginEnrollment(); store.cancelEnrollment()
      try { store.commitEnrollment(enrolled, cancelled); fail("Cancelled enrollment must not commit") } catch (_: IllegalStateException) {}
      assertNotNull(store.read()); assertFalse(File(directory, "black-owner-v1.pending").exists())
      store.clear(); assertFalse(store.exists()); assertNull(store.read())
      val deleted = store.beginEnrollment(); store.clear()
      try { store.commitEnrollment(enrolled, deleted); fail("Deleted owner must not return") } catch (_: IllegalStateException) {}
    } finally { store.clear(); directory.listFiles()?.forEach { it.delete() }; directory.delete() }
  }
  fun testRealModelVerifiesEachShortPacketWithoutIdentityInheritance() {
    val extractor = SpeakerEmbeddingExtractor(instrumentation.targetContext.assets, SpeakerEmbeddingExtractorConfig(model = "black-voice/speaker/campplus.onnx", numThreads = 1))
    val biometrics = VoiceBiometrics(extractor)
    fun audio(name: String): FloatArray {
      val pcm = VoicePcm.read(instrumentation.context.assets.open("voice-speaker-fixtures/$name").use { it.readBytes() })
      assertEquals(16000, pcm.sampleRate); return FloatArray(pcm.samples.size) { pcm.samples[it] / 32768f }
    }
    try {
      val enrollment = audio("speaker1_a_cn_16k.wav")
      val owner = audio("speaker1_b_cn_16k.wav"); val other = audio("speaker2_a_cn_16k.wav")
      val references = listOf(enrollment.copyOfRange(0, 48000), enrollment.copyOfRange(8000, 56000), FloatArray(enrollment.size) { enrollment[it] * .7f })
      val base = VoiceIdentity.enroll(references.map { biometrics.embedding(it)!! })
      val profile = base.copy(shortGroups = references.map(biometrics::shortViews))
      var comparisons = 0
      val packets = VoicePacketGate { frames, voiced -> comparisons++; VoiceIdentity.accepts(profile, biometrics.embedding(frames)!!, voiced) }
      fun append(samples: FloatArray, start: Int, count: Int) { repeat(count) { index -> packets.append(VoiceAudioFrame(samples.copyOfRange(start + index * 512, start + (index + 1) * 512), true)) } }
      // Separate recording, different words: two independent 640 ms owner clips.
      for (start in listOf(8192, 16384)) { append(owner, start, 20); assertTrue("Held-out short owner packet at $start", packets.resolve(false)!!.accepted) }
      append(other, 8192, 10)
      assertFalse("A stranger immediately following the owner cannot inherit permission", packets.resolve(true)!!.accepted)
      val before = comparisons; append(other, 8192, 6)
      assertFalse("An unverifiable 192 ms tail stays out instead of borrowing old owner PCM", packets.resolve(true)!!.accepted)
      assertEquals(before, comparisons); assertFalse(packets.pending)
    } finally { extractor.release() }
  }
  fun testPersonalWakeRegistrationRequiresHeldOutKeywordAndRejectsOtherVoice() {
    val assets = instrumentation.targetContext.assets
    val extractor = SpeakerEmbeddingExtractor(assets, SpeakerEmbeddingExtractorConfig(model = "black-voice/speaker/campplus.onnx", numThreads = 1))
    val biometrics = VoiceBiometrics(extractor)
    val kws = KeywordSpotter(assets, KeywordSpotterConfig(modelConfig = OnlineModelConfig(
      transducer = OnlineTransducerModelConfig("black-voice/kws/encoder.onnx", "black-voice/kws/decoder.onnx", "black-voice/kws/joiner.onnx"),
      tokens = "black-voice/kws/tokens.txt", modelType = "zipformer2", numThreads = 1), keywordsFile = "black-voice/keywords.txt", keywordsScore = 1f, keywordsThreshold = .5f, numTrailingBlanks = 1))
    val vad = Vad(assets, VadModelConfig(sileroVadModelConfig = SileroVadModelConfig(model = "black-voice/vad/silero_vad.onnx", windowSize = 512), numThreads = 1))
    fun audio(name: String): FloatArray {
      val wav = VoicePcm.read(instrumentation.context.assets.open("voice-speaker-fixtures/" + name + ".wav").use { it.readBytes() })
      val pcm = VoiceEcho(512).use { it.resample(wav.samples, wav.sampleRate) }
      return FloatArray(pcm.size + 16000) { if (it < pcm.size) pcm[it] / 32768f else 0f }
    }
    fun keyword(samples: FloatArray): VoiceWakeClip {
      val stream = kws.createStream(); val window = VoiceWakeWindow(); vad.reset()
      try {
        for (start in samples.indices step 512) {
          val block = FloatArray(512) { samples.getOrElse(start + it) { 0f } }
          window.append(VoiceAudioFrame(block, vad.compute(block) >= .55f)); stream.acceptWaveform(block, 16000)
          while (kws.isReady(stream)) {
            kws.decode(stream); val result = kws.getResult(stream)
            if (result.keyword.isNotBlank()) return window.clip(result.timestamps) ?: error("Keyword timestamp window unavailable")
          }
        }
        error("Synthetic BLACK was not detected")
      } finally { stream.release() }
    }
    try {
      val clips = (1..3).map { audio("owner-enroll-" + it) }
      val long = clips.map { biometrics.embedding(it)!! }
      val groups = clips.map(biometrics::shortViews)
      val wakes = clips.map { biometrics.embedding(keyword(it).frames)!! }
      val heldOut = keyword(audio("owner-wake-check")); val vector = biometrics.embedding(heldOut.frames)!!
      val voiced = heldOut.frames.count { it.speech } * 32L
      val profile = VoiceIdentity.complete(VoiceIdentity.enroll(long), groups, wakes, vector, voiced)
      assertTrue(VoiceIdentity.acceptsWake(profile, vector, voiced))
      val other = keyword(audio("other-wake"))
      assertFalse("Correct word spoken by a different voice must not wake the Agent", VoiceIdentity.acceptsWake(profile, biometrics.embedding(other.frames)!!, other.frames.count { it.speech } * 32L))
      assertTrue("Test must exercise short speech rather than only a long sentence", heldOut.frames.size * 32L < 1600)
    } finally { vad.release(); kws.release(); extractor.release() }
  }
  fun testAndroidPublicWebSearchUsesRealNetworkAndRejectsPrivateTargets() {
    val reader = uncover.web.UncoverWebModule()
    val page = JSONObject(reader.readPublicPage("https://www.bing.com/search?format=rss&q=Android+TextToSpeech+documentation&count=10"))
    assertTrue(page.getString("text").contains("<rss")); assertTrue(page.getString("text").contains("<item>"))
    try { reader.readPublicPage("http://127.0.0.1/"); fail("Private address must not be contacted") } catch (_: IllegalArgumentException) {}
  }
}

class VoicePlaybackActivity : Activity()
