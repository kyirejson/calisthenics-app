package uncover.voice

import android.media.AudioFormat
import android.speech.tts.SynthesisCallback
import android.speech.tts.SynthesisRequest
import android.speech.tts.TextToSpeech
import android.speech.tts.TextToSpeechService
import android.speech.tts.Voice
import java.util.Locale
import java.util.concurrent.atomic.AtomicInteger

/** Instrumentation-only engine: real system TTS binder/file callbacks, deterministic failure injection. */
class VoiceFixtureTtsService : TextToSpeechService() {
  companion object { val failures = AtomicInteger(0); val requests = AtomicInteger(0) }
  override fun onStop() {}
  override fun onGetLanguage() = arrayOf("zho", "CHN", "")
  override fun onIsLanguageAvailable(language: String?, country: String?, variant: String?) = if (language in listOf("zh", "zho")) TextToSpeech.LANG_COUNTRY_VAR_AVAILABLE else TextToSpeech.LANG_NOT_SUPPORTED
  override fun onLoadLanguage(language: String?, country: String?, variant: String?) = onIsLanguageAvailable(language, country, variant)
  override fun onGetVoices(): MutableList<Voice> = mutableListOf(Voice("fixture-zh", Locale.SIMPLIFIED_CHINESE, Voice.QUALITY_NORMAL, Voice.LATENCY_NORMAL, false, emptySet()))
  override fun onGetDefaultVoiceNameFor(language: String?, country: String?, variant: String?) = if (language in listOf("zh", "zho")) "fixture-zh" else null
  override fun onIsValidVoiceName(name: String?) = if (name == "fixture-zh") TextToSpeech.SUCCESS else TextToSpeech.ERROR
  override fun onLoadVoice(name: String?) = onIsValidVoiceName(name)
  override fun onSynthesizeText(request: SynthesisRequest?, callback: SynthesisCallback) {
    requests.incrementAndGet()
    if (failures.getAndUpdate { if (it > 0) it - 1 else 0 } > 0) { callback.error(TextToSpeech.ERROR_SERVICE); return }
    callback.start(16000, AudioFormat.ENCODING_PCM_16BIT, 1)
    val bytes = ByteArray(6400)
    for (i in 0 until bytes.size / 2) { val sample = (1500 * kotlin.math.sin(i * .1)).toInt(); bytes[i * 2] = sample.toByte(); bytes[i * 2 + 1] = (sample shr 8).toByte() }
    callback.audioAvailable(bytes, 0, bytes.size); callback.done()
  }
}
