package uncover.voice

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

class VoiceAgentTaskService : HeadlessJsTaskService() {
  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
    val requestId = intent?.getStringExtra("requestId") ?: return null
    val text = intent.getStringExtra("text") ?: return null
    val sessionId = intent.getStringExtra("sessionId") ?: return null
    if (BlackVoiceService.instance?.active(requestId) != true) return null
    return HeadlessJsTaskConfig("UncoverVoiceAgent", Arguments.createMap().apply {
      putString("requestId", requestId); putString("text", text); putString("sessionId", sessionId)
    }, 0, true) // No artificial tool-round cap; service cancellation still terminates requests.
  }
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    super.onStartCommand(intent, flags, startId)
    return START_NOT_STICKY // Never silently redeliver a user's mutating voice request after process death.
  }
}
