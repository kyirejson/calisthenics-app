package uncover.music

import android.content.ComponentName
import android.content.Context
import android.content.ServiceConnection
import android.content.pm.PackageManager
import android.os.Build
import android.os.IBinder
import android.view.KeyEvent
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.withTimeout
import org.json.JSONObject
import rikka.shizuku.Shizuku

/** Opt-in routing shared by native tools. Failure never launches music on the physical screen. */
internal object MusicBackground {
  @Volatile private var remote: IMusicDisplay? = null
  private var binding: CompletableDeferred<IMusicDisplay>? = null
  private var args: Shizuku.UserServiceArgs? = null
  @Volatile private var displayId = -1
  private var currentProvider: String? = null
  @Volatile private var lastFailure: JSONObject? = null
  private val connection = object : ServiceConnection {
    override fun onServiceConnected(name: ComponentName, binder: IBinder) {
      if (args == null || binding == null) { runCatching { IMusicDisplay.Stub.asInterface(binder).release() }; return }
      remote = IMusicDisplay.Stub.asInterface(binder)
      binding?.complete(remote!!)
    }
    override fun onServiceDisconnected(name: ComponentName) { reset() }
  }
  private fun reset() { remote = null; displayId = -1; currentProvider = null; binding?.completeExceptionally(MusicFailure("shizuku_disconnected", "Shizuku 已断开，未切换主屏幕。")); binding = null }
  private val dead = Shizuku.OnBinderDeadListener { reset() }
  fun initialize() { Shizuku.addBinderDeadListener(dead) }
  fun enabled(context: Context) = MusicLedger.consent(context, "background")
  fun granted() = runCatching { Shizuku.pingBinder() && Shizuku.checkSelfPermission() == PackageManager.PERMISSION_GRANTED }.getOrDefault(false)
  fun capability(context: Context): JSONObject = JSONObject().put("backgroundEnabled", enabled(context)).put("backgroundSupported", Build.VERSION.SDK_INT >= MusicDisplayPolicy.MIN_API)
    .put("shizukuInstalled", runCatching { context.packageManager.getPackageInfo("moe.shizuku.privileged.api", 0); true }.getOrDefault(false))
    .put("shizukuRunning", runCatching { Shizuku.pingBinder() }.getOrDefault(false)).put("shizukuGranted", granted())
    .put("backgroundDisplayId", displayId).put("androidApi", Build.VERSION.SDK_INT).put("executionMode", if (enabled(context)) "background" else "foreground")
  fun requireReady(context: Context) {
    if (!enabled(context)) throw MusicFailure("background_consent_required", "请先在音乐设置中启用后台点歌。")
    if (Build.VERSION.SDK_INT < MusicDisplayPolicy.MIN_API) throw MusicFailure("background_unsupported", "不抢主屏的后台点歌需要 Android 14 或以上；当前版本请选择前台方式。")
    if (!MusicLedger.consent(context, "screen")) throw MusicFailure("screen_consent_required", "请先在音乐设置中同意模型操作音乐界面。")
    if (!runCatching { Shizuku.pingBinder() }.getOrDefault(false)) throw MusicFailure("shizuku_not_running", "Shizuku 当前未运行；已保存的 App 授权仍保留，只需手动启动 Shizuku。")
    if (!granted()) throw MusicFailure("shizuku_required", "Shizuku 正在运行，但本应用未获其授权；请在 Shizuku 中授权一次。")
    if ((context.getSystemService(Context.KEYGUARD_SERVICE) as android.app.KeyguardManager).isKeyguardLocked) throw MusicFailure("device_locked", "手机已锁屏，请解锁后再选歌；不会绕过锁屏。")
  }
  fun requestPermission(context: Context) {
    if (!enabled(context)) throw MusicFailure("background_consent_required", "请先同意后台点歌授权说明。")
    if (!Shizuku.pingBinder()) throw MusicFailure("shizuku_not_running", "请先安装并启动 Shizuku，再返回授权；不需要连接电脑。")
    if (granted()) return
    Shizuku.requestPermission(4302)
  }
  suspend fun connect(context: Context) {
    requireReady(context)
    if (remote?.asBinder()?.pingBinder() == true) return
    val pending = binding ?: CompletableDeferred<IMusicDisplay>().also {
      binding = it
      args = Shizuku.UserServiceArgs(ComponentName(context, MusicDisplayService::class.java)).daemon(false).processNameSuffix("music_display").tag("uncover_music_display").version(2)
      try { Shizuku.bindUserService(args!!, connection) } catch (error: Exception) { reset(); throw error }
    }
    try { withTimeout(10_000) { pending.await() } } catch (error: Exception) { close(); throw MusicFailure("background_connect_failed", "后台音乐服务连接失败：${error.message ?: error.javaClass.simpleName}；未切换主屏幕。") }
    finally { if (binding === pending) binding = null }
  }
  fun open(context: Context, provider: String, command: JSONObject): Boolean {
    requireReady(context)
    val result = JSONObject((remote ?: throw MusicFailure("background_not_connected", "请重新发起点歌以连接 Shizuku。")).open(provider, command.optString("uri"), command.optString("query"), command.optString("title"), command.optString("artist"), command.optString("focus")))
    if (!result.optBoolean("ok")) { displayId = -1; currentProvider = null; lastFailure = result; throw MusicFailure(result.optString("code", "virtual_display_failed"), result.optString("message", "虚拟屏幕点歌失败；未改为主屏操作。"), result) }
    lastFailure = null
    displayId = result.getInt("displayId"); MusicDisplayPolicy.requireDisplay(displayId, displayId); currentProvider = provider
    return result.optBoolean("ok")
  }
  fun target(context: Context, provider: String): Int {
    requireReady(context)
    val actual = JSONObject((remote ?: throw MusicFailure("background_not_connected", "音乐后台服务尚未连接，请先打开音乐。")).state())
    val id = actual.optInt("displayId", -1)
    if (id <= 0) {
      displayId = -1; currentProvider = null
      lastFailure?.takeIf { it.optString("provider") == provider }?.let { throw MusicFailure(it.optString("code", "activity_launch_failed"), "上次后台启动失败：${it.optString("message")}；请根据原始启动错误处理，虚拟屏幕释放只是后续结果。", it) }
      throw MusicFailure("display_expired", "音乐虚拟屏幕已释放，请重新打开音乐；未改为主屏操作。")
    }
    if (currentProvider != provider || actual.optString("provider") != provider) throw MusicFailure("needs_open_app", "请先在虚拟屏幕打开选定的音乐软件。")
    MusicDisplayPolicy.requireDisplay(id, displayId)
    return id
  }
  fun tap(context: Context, provider: String, x: Float, y: Float): Boolean { target(context, provider); return remote!!.tap(provider, x, y) }
  fun key(context: Context, provider: String, action: String): Boolean { target(context, provider); return remote!!.key(provider, if (action == "back") KeyEvent.KEYCODE_BACK else KeyEvent.KEYCODE_ENTER) }
  fun close() {
    lastFailure = null
    runCatching { remote?.release() }
    val old = args; args = null
    if (old != null) runCatching { Shizuku.unbindUserService(old, connection, true) }
    reset()
  }
  fun dispose() { close(); Shizuku.removeBinderDeadListener(dead) }
}
