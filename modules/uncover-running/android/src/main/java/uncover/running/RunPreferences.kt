package uncover.running

import android.content.Context
import org.json.JSONObject

internal object RunPreferences {
  private fun file(context: Context) = context.getSharedPreferences("running-options-v1", Context.MODE_PRIVATE)
  fun read(context: Context): JSONObject = clean(JSONObject(file(context).getString("options", null) ?: "{\"autoPause\":false,\"voice\":true,\"stepTracking\":false}"))
  fun write(context: Context, raw: String) {
    RunStore.load(context)
    check(RunStore.phase() == "idle") { "请先结束本次跑步，再调整记录设置。" }
    val clean = clean(JSONObject(raw))
    store(context, clean)
    RunStore.stepIssue = ""; RunStore.speechIssue = ""
  }
  internal fun store(context: Context, options: JSONObject) {
    check(file(context).edit().putString("options", clean(options).toString()).commit()) { "跑步设置保存失败，请重试。" }
  }
  fun clean(source: JSONObject): JSONObject {
    for (key in listOf("autoPause", "voice", "stepTracking")) require(source.opt(key) is Boolean) { "跑步设置无效。" }
    val clean = JSONObject().put("autoPause", source.getBoolean("autoPause")).put("voice", source.getBoolean("voice")).put("stepTracking", source.getBoolean("stepTracking"))
    if (source.has("stepLengthM") && !source.isNull("stepLengthM")) {
      val length = source.getDouble("stepLengthM")
      require(length.isFinite() && length in .3..2.0) { "校准步长应为 0.3–2 米/步。" }
      clean.put("stepLengthM", length)
    }
    return clean
  }
}
