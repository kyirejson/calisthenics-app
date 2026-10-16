package uncover.music

import uncover.device.PhoneAccessibilityService
import uncover.device.PhoneFailure
import uncover.device.PhoneUiTarget
import org.json.JSONObject

/** Stable Android binding preserves existing grants. UI mechanics live only in uncover-device. */
class MusicAccessibilityService : PhoneAccessibilityService() {
  companion object { @Volatile var instance: MusicAccessibilityService? = null; private set }
  override fun legacyPackages() = if (MusicLedger.consent(this, "screen")) MusicPolicy.packages.values.toList() else emptyList()
  override fun onServiceConnected() { super.onServiceConnected(); instance = this }
  override fun onInterrupt() { super.onInterrupt(); MusicExecutionService.cancelActive(); MusicBackground.close() }
  override fun onDestroy() { MusicExecutionService.cancelActive(); MusicBackground.close(); if (instance === this) instance = null; super.onDestroy() }
  internal fun forgetScreens() = phoneUi.clear()
  internal fun revision(provider: String) = phoneUi.revision(MusicPolicy.packageFor(provider))
  private fun target(provider: String): PhoneUiTarget {
    val displayId = if (MusicBackground.enabled(this)) MusicBackground.target(this, provider) else 0
    return PhoneUiTarget(scope = "music:$provider", packageName = MusicPolicy.packageFor(provider), displayId = displayId, strictContext = false,
      validate = {
        if (!MusicLedger.consent(this, "screen")) throw MusicFailure("screen_consent_required", "请先在音乐设置中同意让模型读取音乐界面。")
        val current = if (MusicBackground.enabled(this)) MusicBackground.target(this, provider) else 0
        if (current != displayId) throw MusicFailure("stale_display", "音乐执行模式或虚拟屏幕已变化，请重新读取。")
        if (displayId > 0) MusicDisplayPolicy.requireDisplay(current, displayId)
      },
      tap = if (displayId > 0) ({ x, y -> MusicBackground.tap(this, provider, x, y) }) else null,
      back = if (displayId > 0) ({ MusicBackground.key(this, provider, "back") }) else null,
      submit = if (displayId > 0) ({ MusicBackground.key(this, provider, "submit") }) else null)
  }
  private fun converted(error: PhoneFailure): MusicFailure {
    val background = MusicBackground.enabled(this)
    val code = when (error.code) {
      "wrong_app" -> if (background) "background_external_window" else "needs_open_app"
      "screen_unavailable" -> if (background) "background_screen_unavailable" else "screen_unavailable"
      "wrong_request" -> "wrong_provider"
      else -> error.code
    }
    return MusicFailure(code, error.message ?: "音乐界面操作不可用。")
  }
  private fun shape(provider: String, result: JSONObject) = result.put("provider", provider).put("mode", if (result.optInt("displayId") > 0) "background" else "foreground")
  internal suspend fun awaitScreen(provider: String, offset: Int, before: Long? = null, cancelled: () -> Boolean = { false }): JSONObject = try {
    shape(provider, phoneUi.awaitScreen(target(provider), offset, before, cancelled, MusicObservationPolicy.DEADLINE_MS, MusicObservationPolicy::ready))
  } catch (error: PhoneFailure) { throw converted(error) }
  internal fun screen(provider: String, offset: Int): JSONObject = try { shape(provider, phoneUi.screen(target(provider), offset)) } catch (error: PhoneFailure) { throw converted(error) }
  internal fun prepareAction(provider: String, command: JSONObject): () -> Boolean = try {
    val prepared = phoneUi.prepareAction(target(provider), command)
    val perform: () -> Boolean = { try { prepared() } catch (error: PhoneFailure) { throw converted(error) } }
    perform
  } catch (error: PhoneFailure) { throw converted(error) }
  internal fun isMusicForeground() = phoneUi.foregroundRoot()?.packageName?.toString() in MusicPolicy.packages.values
}
