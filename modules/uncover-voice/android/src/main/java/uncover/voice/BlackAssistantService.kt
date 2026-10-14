package uncover.voice

import android.content.Intent
import android.os.Bundle
import android.service.voice.VoiceInteractionService
import android.service.voice.VoiceInteractionSession
import android.service.voice.VoiceInteractionSessionService
import android.speech.RecognitionService
import android.speech.SpeechRecognizer

/** The OS binds the user's selected assistant; no root, watchdog or hidden permission changes. */
class BlackAssistantService : VoiceInteractionService() {
  override fun onReady() {
    super.onReady()
    if (VoiceState.enabled(this)) runCatching { BlackVoiceService.start(this) }
      .onFailure { VoiceState.error(this, "assistant_restart_failed", it.message ?: "系统未允许恢复语音监听。") }
  }
  override fun onShutdown() { BlackVoiceService.stop(this); super.onShutdown() }
}
class BlackSessionService : VoiceInteractionSessionService() {
  override fun onNewSession(args: Bundle?): VoiceInteractionSession = object : VoiceInteractionSession(this) {
    override fun onShow(args: Bundle?, showFlags: Int) {
      super.onShow(args, showFlags)
      setUiEnabled(false)
      if (VoiceState.enabled(this@BlackSessionService)) runCatching { BlackVoiceService.start(this@BlackSessionService); BlackVoiceService.instance?.wake() }
      finish()
    }
  }
}
// Required by the assistant contract, but deliberately not advertised as the system dictation provider.
class BlackRecognitionService : RecognitionService() {
  override fun onStartListening(intent: Intent?, listener: Callback?) { listener?.error(SpeechRecognizer.ERROR_CLIENT) }
  override fun onCancel(listener: Callback?) {}
  override fun onStopListening(listener: Callback?) {}
}
