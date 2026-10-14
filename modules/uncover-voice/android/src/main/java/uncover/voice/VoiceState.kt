package uncover.voice

import android.Manifest
import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import android.service.voice.VoiceInteractionService
import org.json.JSONObject

internal object VoiceState {
  private fun preferences(context: Context) = context.getSharedPreferences("black_voice_v1", Context.MODE_PRIVATE)
  fun enabled(context: Context) = preferences(context).getBoolean("enabled", false)
  fun setEnabled(context: Context, value: Boolean) {
    check(preferences(context).edit().putBoolean("enabled", value).commit()) { "语音监听设置未能保存。" }
  }
  fun error(context: Context, code: String, message: String) {
    preferences(context).edit().putString("error", code).putString("message", message).apply()
    UncoverVoiceModule.instance?.status()
  }
  fun clearError(context: Context) { preferences(context).edit().remove("error").remove("message").apply() }
  fun snapshot(context: Context): JSONObject = JSONObject()
    .put("name", "BLACK").put("enabled", enabled(context)).put("running", BlackVoiceService.instance?.listening == true)
    .put("phase", BlackVoiceService.instance?.phase ?: "stopped")
    .put("assistant", VoiceInteractionService.isActiveService(context, ComponentName(context, BlackAssistantService::class.java)))
    .put("microphone", context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED)
    .put("error", preferences(context).getString("error", null) ?: JSONObject.NULL)
    .put("message", preferences(context).getString("message", "喊 BLACK 唤醒，回答“我在”后即可说话。") ?: "")
}
