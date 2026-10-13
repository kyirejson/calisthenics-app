package uncover.music

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Base64
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONObject

/** Exercises the production bridge, not an alternate implementation; protected by the shell's DUMP permission. */
class MusicQaReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val pending = goAsync()
    CoroutineScope(Dispatchers.Main).launch {
      val result = try {
        val input = JSONObject(String(Base64.decode(intent.getStringExtra("input"), Base64.DEFAULT), Charsets.UTF_8))
        when (input.getString("op")) {
          "capabilities" -> MusicController.capabilities(context, input.getString("provider"))
          "playback" -> MusicController.playback(context, input.getString("provider"))
          "screen" -> { delay(450); (MusicAccessibilityService.instance ?: error("Accessibility not connected")).screen(input.getString("provider"), input.optInt("offset")) }
          "execute" -> (UncoverMusicModule.instance ?: error("React music module not loaded")).executeRequest(input.getString("requestId"), input.getJSONObject("command").toString(), input.optString("executionId", input.getString("requestId")))
          "consent" -> { MusicLedger.setConsent(context, input.getString("kind"), input.getBoolean("value")); JSONObject().put("ok", true) }
          "receipts" -> JSONObject().put("ok", true).put("receipts", MusicLedger.receipts(context, input.getString("requestId")))
          "cancel" -> { MusicLedger.cancel(input.getString("executionId")); JSONObject().put("ok", true) }
          "finish" -> { (UncoverMusicModule.instance ?: error("React music module not loaded")).finishRequest(input.getString("requestId"), input.getString("executionId")); JSONObject().put("ok", true) }
          "clear" -> { (UncoverMusicModule.instance ?: error("React music module not loaded")).clearState(); JSONObject().put("ok", true) }
          else -> error("Unknown QA operation")
        }
      } catch (error: Exception) { JSONObject().put("ok", false).put("code", (error as? MusicFailure)?.code ?: "qa_error").put("message", error.message) }
      pending.resultCode = 200
      pending.resultData = Base64.encodeToString(result.toString().toByteArray(Charsets.UTF_8), Base64.NO_WRAP)
      pending.finish()
    }
  }
}
