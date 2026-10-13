package uncover.music

/** Exact platform-call layout: never attach a normal app's IApplicationThread to a shell launch. */
internal object MusicLaunchPolicy {
  private val common = listOf("android.app.IApplicationThread", "java.lang.String")
  private val suffix = listOf("android.content.Intent", "java.lang.String", "android.os.IBinder", "java.lang.String", "int", "int", "android.app.ProfilerInfo", "android.os.Bundle", "int")
  val signature = common + "java.lang.String" + suffix // Android 14–16 IActivityTaskManager.
  fun arguments(types: List<String>, processUid: Int, ownerUid: Int, intent: Any, resolvedType: String?, options: Any): Array<Any?> {
    if (processUid !in setOf(0, 2000)) throw MusicFailure("background_identity_invalid", "后台服务不是已授权的系统调试进程（UID=$processUid），未启动音乐。")
    if (ownerUid < 0) throw MusicFailure("background_identity_invalid", "无法确定音乐请求所属用户，未启动音乐。")
    if (types != signature) throw MusicFailure("activity_api_unsupported", "当前系统的音乐启动接口签名不兼容，未改为主屏操作。")
    val values = mutableListOf<Any?>(null, "com.android.shell", null)
    values.addAll(listOf(intent, resolvedType, null, null, 0, 0, null, options, ownerUid / 100_000))
    return values.toTypedArray()
  }
  fun accepted(result: Int): Boolean = result in setOf(0, 2, 3) // START_SUCCESS / TASK_TO_FRONT / DELIVERED_TO_TOP, not START_ABORTED.
}
