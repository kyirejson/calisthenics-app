package uncover.music

import android.annotation.SuppressLint
import android.content.AttributionSource
import android.content.Context
import android.content.ContextWrapper
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.hardware.input.InputManager
import android.media.ImageReader
import android.os.Binder
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.Process
import android.os.SystemClock
import android.view.InputEvent
import android.view.InputDevice
import android.view.KeyEvent
import android.view.MotionEvent
import org.json.JSONObject

/** Runs only as an explicitly authorized Shizuku UserService, never as an exported app service.
 * Display/focus/IME platform approach researched in Genymobile/scrcpy (Apache-2.0);
 * this implementation has no mirror, screen recording, socket or unrestricted shell interface.
 */
@SuppressLint("PrivateApi", "DiscouragedPrivateApi")
class MusicDisplayService(context: Context) : IMusicDisplay.Stub() {
  private val ownerUid = context.applicationInfo.uid
  private val shell = object : ContextWrapper(context.createPackageContext("com.android.shell", 0)) {
    override fun getPackageName() = "com.android.shell"
    override fun getOpPackageName() = "com.android.shell"
    override fun getAttributionSource(): AttributionSource = AttributionSource.Builder(Process.myUid()).setPackageName(packageName).build()
  }
  private val worker = HandlerThread("UncoverMusicDisplay").apply { start() }
  private val handler = Handler(worker.looper)
  private var display: VirtualDisplay? = null
  private var frames: ImageReader? = null
  private var provider: String? = null
  private val idle = Runnable { synchronized(this) { releaseDisplay() } }
  private fun <T> authorized(block: () -> T): T {
    if (Binder.getCallingUid() != ownerUid) throw SecurityException("Music display belongs to another application.")
    val identity = Binder.clearCallingIdentity()
    try { return synchronized(this) { block() } } finally { Binder.restoreCallingIdentity(identity) }
  }
  private fun service(name: String, type: String): Any {
    val binder = Class.forName("android.os.ServiceManager").getMethod("getService", String::class.java).invoke(null, name)
    return Class.forName("$type\$Stub").getMethod("asInterface", android.os.IBinder::class.java).invoke(null, binder)
  }
  private fun ensureDisplay(): Int {
    if (Build.VERSION.SDK_INT < MusicDisplayPolicy.MIN_API) throw MusicFailure("background_unsupported", "不抢主屏的后台点歌需要 Android 14 或以上。")
    display?.let { return it.display.displayId }
    val reader = ImageReader.newInstance(MusicDisplayPolicy.WIDTH, MusicDisplayPolicy.HEIGHT, PixelFormat.RGBA_8888, 2)
    // Drain frames locally; never read pixels, persist them or send another app's screen to a server.
    reader.setOnImageAvailableListener({ image -> runCatching { image.acquireLatestImage()?.close() } }, handler)
    try {
      val ctor = DisplayManager::class.java.getDeclaredConstructor(Context::class.java).apply { isAccessible = true }
      val manager = ctor.newInstance(shell)
      // PUBLIC | PRESENTATION | OWN_CONTENT_ONLY | SUPPORTS_TOUCH | DESTROY_CONTENT_ON_REMOVAL
      // | TRUSTED | OWN_FOCUS | DEVICE_DISPLAY_GROUP. Do not bypass the device lock.
      val flags = 1 or 2 or 8 or (1 shl 6) or (1 shl 8) or (1 shl 10) or (1 shl 14) or (1 shl 15)
      val created = manager.createVirtualDisplay("Uncover Music", MusicDisplayPolicy.WIDTH, MusicDisplayPolicy.HEIGHT, MusicDisplayPolicy.DENSITY, reader.surface, flags)
        ?: error("系统未创建音乐虚拟屏幕。")
      display = created
      frames = reader
      MusicDisplayPolicy.requireDisplay(created.display.displayId, created.display.displayId)
      val windows = service("window", "android.view.IWindowManager")
      // IME_POLICY_HIDE: even a music search field must not pop a keyboard on the real screen.
      windows.javaClass.getMethod("setDisplayImePolicy", Int::class.javaPrimitiveType, Int::class.javaPrimitiveType).invoke(windows, created.display.displayId, 2)
      touchIdle()
      return created.display.displayId
    } catch (error: Exception) { releaseDisplay(); reader.close(); throw error }
  }
  private fun touchIdle() { handler.removeCallbacks(idle); handler.postDelayed(idle, MusicDisplayPolicy.IDLE_MS) }
  private fun releaseDisplay() {
    handler.removeCallbacks(idle)
    val oldDisplay = display; display = null
    val oldFrames = frames; frames = null
    provider = null
    try { oldDisplay?.release() } finally { oldFrames?.close() }
  }
  override fun state(): String = authorized {
    if (display != null) touchIdle()
    JSONObject().put("ok", true).put("displayId", display?.display?.displayId ?: -1).put("provider", provider ?: JSONObject.NULL).put("mode", "background").toString()
  }
  override fun open(provider: String, uri: String, query: String, title: String, artist: String, focus: String): String = authorized {
    val command = JSONObject().put("uri", uri).put("query", query).put("title", title).put("artist", artist).put("focus", focus)
    val (intent, status) = MusicController.prepareOpen(shell, provider, command)
    var stage = "create_display"
    try {
      val id = ensureDisplay()
      stage = "launch_activity"
      val result = MusicActivityLauncher.start(provider, intent, id, ownerUid)
      this.provider = provider
      touchIdle()
      JSONObject().put("ok", true).put("status", status).put("displayId", id).put("mode", "background").put("activityResult", result).put("verifiedPlaying", false).toString()
    } catch (error: Exception) {
      runCatching { releaseDisplay() }
      val cause = generateSequence(error as Throwable) { it.cause }.last()
      val failure = cause as? MusicFailure ?: error as? MusicFailure
      JSONObject().put("ok", false).put("code", failure?.code ?: if (stage == "launch_activity") "activity_launch_failed" else "virtual_display_failed")
        .put("provider", provider).put("stage", stage).put("processUid", Process.myUid()).put("ownerUid", ownerUid).put("callingPackage", "com.android.shell")
        .put("exception", cause.javaClass.simpleName).put("platformMessage", cause.message ?: JSONObject.NULL)
        .put("message", "${if (stage == "launch_activity") "打开音乐软件" else "创建音乐虚拟屏幕"}失败：${cause.message ?: cause.javaClass.simpleName}；未改为主屏操作。").toString()
    }
  }
  private fun activeId(provider: String): Int {
    MusicPolicy.packageFor(provider)
    if (this.provider != provider) throw MusicFailure("wrong_provider", "当前虚拟屏幕不属于选定的音乐软件。")
    val id = display?.display?.displayId ?: throw MusicFailure("display_expired", "音乐虚拟屏幕已释放，请重新打开音乐。")
    MusicDisplayPolicy.requireDisplay(id, id)
    touchIdle()
    return id
  }
  private fun inject(event: InputEvent, id: Int): Boolean {
    MusicDisplayPolicy.requireDisplay(id, display?.display?.displayId ?: -1)
    InputEvent::class.java.getMethod("setDisplayId", Int::class.javaPrimitiveType).invoke(event, id)
    val manager = shell.getSystemService(Context.INPUT_SERVICE) as InputManager
    return InputManager::class.java.getMethod("injectInputEvent", InputEvent::class.java, Int::class.javaPrimitiveType).invoke(manager, event, 2) as Boolean
  }
  override fun tap(provider: String, x: Float, y: Float): Boolean = authorized {
    MusicDisplayPolicy.requirePoint(x, y)
    val id = activeId(provider)
    val time = SystemClock.uptimeMillis()
    fun event(action: Int): MotionEvent = MotionEvent.obtain(time, SystemClock.uptimeMillis(), action, x, y, 0).apply { source = InputDevice.SOURCE_TOUCHSCREEN }
    val down = event(MotionEvent.ACTION_DOWN)
    val up = event(MotionEvent.ACTION_UP)
    try { val accepted = inject(down, id); inject(up, id) && accepted } finally { down.recycle(); up.recycle() }
  }
  override fun key(provider: String, keyCode: Int): Boolean = authorized {
    if (keyCode !in setOf(KeyEvent.KEYCODE_BACK, KeyEvent.KEYCODE_ENTER)) throw MusicFailure("unsupported_key", "音乐桥仅接受返回或搜索提交。")
    val id = activeId(provider)
    val time = SystemClock.uptimeMillis()
    fun event(action: Int) = KeyEvent(time, time, action, keyCode, 0, 0, KeyEvent.KEYCODE_UNKNOWN, 0, 0, InputDevice.SOURCE_KEYBOARD)
    val accepted = inject(event(KeyEvent.ACTION_DOWN), id)
    inject(event(KeyEvent.ACTION_UP), id) && accepted
  }
  override fun release() = authorized { releaseDisplay() }
  override fun destroy() {
    val caller = Binder.getCallingUid()
    if (caller != ownerUid && caller != Process.myUid()) throw SecurityException("Unauthorized music service teardown.")
    try { synchronized(this) { releaseDisplay() } } finally { worker.quitSafely() }
    kotlin.system.exitProcess(0)
  }
}
