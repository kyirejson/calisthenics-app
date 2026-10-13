package uncover.music

import android.annotation.SuppressLint
import android.app.ActivityOptions
import android.content.Intent
import android.os.IBinder
import android.os.Process

/** Only called inside the authorized UserService after Binder.clearCallingIdentity().
 * A ContextWrapper does not replace ContextImpl's internal caller package/thread.
 * Use the actual shell identity, a null application thread and an explicit private display.
 * This retains Android UID/permission checks; it does not alter or bypass them.
 */
@SuppressLint("PrivateApi", "DiscouragedPrivateApi")
internal object MusicActivityLauncher {
  fun start(provider: String, intent: Intent, displayId: Int, ownerUid: Int): Int {
    MusicDisplayPolicy.requireDisplay(displayId, displayId)
    val packageName = MusicPolicy.packageFor(provider)
    if (intent.`package` != packageName && intent.component?.packageName != packageName) throw MusicFailure("invalid_music_target", "音乐启动目标不属于选定软件。")
    if (intent.`package` != null && intent.`package` != packageName || intent.component != null && intent.component?.packageName != packageName) throw MusicFailure("invalid_music_target", "音乐启动目标存在软件冲突。")
    if (intent.data != null && !MusicPolicy.acceptsUri(provider, intent.data.toString())) throw MusicFailure("invalid_music_uri", "音乐启动链接不属于选定软件。")
    val api = Class.forName("android.app.IActivityTaskManager")
    val binder = Class.forName("android.os.ServiceManager").getMethod("getService", String::class.java).invoke(null, "activity_task") as? IBinder
      ?: throw MusicFailure("activity_service_unavailable", "系统尚未提供 ActivityTaskManager 服务。")
    val manager = Class.forName("android.app.IActivityTaskManager\$Stub").getMethod("asInterface", IBinder::class.java).invoke(null, binder)
    val method = api.methods.firstOrNull { it.name == "startActivityAsUser" && it.parameterTypes.map { type -> type.name } == MusicLaunchPolicy.signature }
      ?: throw MusicFailure("activity_api_unsupported", "当前系统没有兼容的后台音乐启动接口，未改为主屏操作。")
    val options = ActivityOptions.makeBasic().setLaunchDisplayId(displayId).toBundle()
    val arguments = MusicLaunchPolicy.arguments(method.parameterTypes.map { it.name }, Process.myUid(), ownerUid, intent, intent.type, options)
    val result = method.invoke(manager, *arguments) as Int
    if (!MusicLaunchPolicy.accepted(result)) throw MusicFailure("activity_launch_rejected", "系统未接受虚拟屏幕启动（ActivityTaskManager result=$result），未改为主屏操作。")
    return result
  }
}
