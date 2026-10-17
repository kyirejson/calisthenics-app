package uncover.device

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.graphics.Rect
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.view.accessibility.AccessibilityNodeInfo
import android.view.accessibility.AccessibilityWindowInfo
import android.view.WindowManager
import android.hardware.display.DisplayManager
import android.util.DisplayMetrics
import kotlinx.coroutines.delay
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeout
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest
import java.util.UUID
import kotlin.coroutines.resume

/** Guard and display routing are supplied by the owner; the engine knows no app/provider workflow. */
data class PhoneUiTarget(val scope: String, val packageName: String? = null, val displayId: Int = 0,
  val strictContext: Boolean = true, val validate: () -> Unit,
  val tap: ((Float, Float) -> Boolean)? = null, val back: (() -> Boolean)? = null, val submit: (() -> Boolean)? = null)

class PhoneUi(private val service: AccessibilityService) {
  private data class Anchor(val path: List<Int>, val fingerprint: String)
  private data class Snapshot(val scope: String, val packageName: String, val windowId: Int, val displayId: Int,
    val context: String, val bounds: Rect, val anchors: Map<String, Anchor>, var visualRevision: Long? = null)
  private data class Visual(val scope: String, val packageName: String, val windowId: Int, val context: String,
    val bounds: Rect, val revision: Long, val at: Long, val result: JSONObject)
  private data class Change(val revision: Long, val at: Long)
  private val snapshots = linkedMapOf<String, Snapshot>()
  private val changes = mutableMapOf<String, Change>()
  private var visual: Visual? = null
  fun changed(packageName: String) { changes[packageName] = Change((changes[packageName]?.revision ?: 0L) + 1, SystemClock.elapsedRealtime()) }
  fun revision(packageName: String) = changes[packageName]?.revision ?: 0L
  fun clear() { snapshots.clear(); changes.clear(); visual = null }
  fun foregroundRoot(): AccessibilityNodeInfo? {
    val visible = service.windows
    val active = service.rootInActiveWindow
    val keyboard = visible.any { it.type == AccessibilityWindowInfo.TYPE_INPUT_METHOD && (active == null || it.id == active.windowId || it.isActive) }
    if (!keyboard) return active
    val apps = visible.filter { it.type == AccessibilityWindowInfo.TYPE_APPLICATION }
    return (apps.filter { it.isFocused || it.isActive }.maxByOrNull { it.layer } ?: apps.maxByOrNull { it.layer })?.root ?: active
  }
  private fun root(target: PhoneUiTarget): AccessibilityNodeInfo {
    target.validate()
    if (Build.VERSION.SDK_INT >= 33) service.clearCache()
    val node = if (target.displayId == 0) {
      val active = foregroundRoot()
      val candidates = service.windows.filter { it.type == AccessibilityWindowInfo.TYPE_APPLICATION }
        .filter { target.packageName == null || it.root?.packageName?.toString() == target.packageName }
      val preferred = candidates.filter { it.isActive || it.isFocused }.maxByOrNull { it.layer }
      if (active != null && (target.packageName == null || active.packageName?.toString() == target.packageName) && !bounds(active).isEmpty) active
      else preferred?.root ?: candidates.maxByOrNull { it.layer }?.root ?: active
    } else {
      if (Build.VERSION.SDK_INT < 30) throw PhoneFailure("display_unsupported", "系统不支持独立显示器读取。")
      val windows = service.windowsOnAllDisplays.get(target.displayId).orEmpty().filter { it.type == AccessibilityWindowInfo.TYPE_APPLICATION }
      val window = windows.filter { it.isFocused || it.isActive }.maxByOrNull { it.layer } ?: windows.maxByOrNull { it.layer }
        ?: throw PhoneFailure("screen_unavailable", "系统尚未返回指定显示器的应用窗口。")
      if (window.displayId != target.displayId) throw PhoneFailure("stale_display", "显示器已变化，请重新观察。")
      window.root
    } ?: throw PhoneFailure("screen_unavailable", "系统尚未返回当前界面；受保护的页面需要本人处理。")
    if (target.packageName != null && node.packageName?.toString() != target.packageName)
      throw PhoneFailure("wrong_app", "当前真实窗口不是预期应用，请重新观察或打开目标应用。")
    return node
  }
  private fun label(node: AccessibilityNodeInfo, depth: Int = 0): String {
    if (node.isPassword) return ""
    val own = listOfNotNull(node.text?.toString(), node.contentDescription?.toString()).filter { it.isNotBlank() }.distinct().joinToString(" · ")
    if (own.isNotBlank() || depth >= 3 || node.isScrollable) return own
    return (0 until node.childCount).mapNotNull(node::getChild).map { label(it, depth + 1) }.filter { it.isNotBlank() }.distinct().take(8).joinToString(" · ")
  }
  private fun fingerprint(node: AccessibilityNodeInfo) = listOf(node.viewIdResourceName ?: "", node.className?.toString() ?: "", label(node), node.isPassword.toString()).joinToString("\u0001")
  private fun bounds(node: AccessibilityNodeInfo) = Rect().also(node::getBoundsInScreen)
  internal fun viewport(root: AccessibilityNodeInfo, displayId: Int): Pair<Rect, String> {
    val node = bounds(root)
    if (!node.isEmpty) return node to "root"
    val windows = if (Build.VERSION.SDK_INT >= 30) service.windowsOnAllDisplays.get(displayId).orEmpty() else service.windows
    windows.firstOrNull { it.id == root.windowId }?.let { window ->
      val area = Rect().also(window::getBoundsInScreen)
      if (!area.isEmpty) return area to "window"
    }
    if (displayId == 0 && Build.VERSION.SDK_INT >= 30) {
      val area = runCatching { (service.getSystemService(AccessibilityService.WINDOW_SERVICE) as WindowManager).currentWindowMetrics.bounds }.getOrNull()
      if (area != null && !area.isEmpty) return Rect(area) to "display"
      val metrics = DisplayMetrics()
      @Suppress("DEPRECATION")
      val actualDisplay = (service.getSystemService(AccessibilityService.DISPLAY_SERVICE) as DisplayManager).getDisplay(0)
      @Suppress("DEPRECATION")
      actualDisplay?.getRealMetrics(metrics)
      if (metrics.widthPixels > 0 && metrics.heightPixels > 0) return Rect(0, 0, metrics.widthPixels, metrics.heightPixels) to "display"
    }
    throw PhoneFailure("window_bounds_unavailable", "系统未返回此显示器的有效范围，无法读取画面；并非截图时页面改变。")
  }
  private fun context(root: AccessibilityNodeInfo): String {
    val viewport = bounds(root); val headerBottom = viewport.top + minOf(viewport.height() / 4, (200 * service.resources.displayMetrics.density).toInt())
    val values = mutableListOf<String>(); val pending = ArrayDeque<AccessibilityNodeInfo>(); pending.add(root); var visited = 0
    while (pending.isNotEmpty() && visited++ < 10000) {
      val node = pending.removeFirst(); if (node.isPassword) continue
      for (index in 0 until node.childCount) node.getChild(index)?.let(pending::addLast)
      if (node.isVisibleToUser && !node.isEditable && bounds(node).top < headerBottom) {
        val own = listOfNotNull(node.text?.toString(), node.contentDescription?.toString()).filter { it.isNotBlank() }.joinToString(" · ")
        if (own.isNotBlank()) values.add("${node.viewIdResourceName}|$own")
      }
    }
    return MessageDigest.getInstance("SHA-256").digest(values.joinToString("\n").toByteArray()).joinToString("") { "%02x".format(it) }
  }
  fun screen(target: PhoneUiTarget, offset: Int = 0): JSONObject {
    require(offset >= 0)
    val root = root(target); val anchors = linkedMapOf<String, Anchor>(); val nodes = JSONArray()
    val pending = ArrayDeque<Pair<AccessibilityNodeInfo, List<Int>>>(); pending.add(root to emptyList()); var visited = 0
    while (pending.isNotEmpty() && visited++ < 10000) {
      val (node, path) = pending.removeFirst(); if (node.isPassword) continue
      for (index in 0 until node.childCount) node.getChild(index)?.let { pending.add(it to (path + index)) }
      if (!node.isVisibleToUser) continue
      val text = node.text?.toString().orEmpty(); val description = node.contentDescription?.toString().orEmpty()
      val passive = setOf(AccessibilityNodeInfo.ACTION_FOCUS, AccessibilityNodeInfo.ACTION_CLEAR_FOCUS, AccessibilityNodeInfo.ACTION_ACCESSIBILITY_FOCUS, AccessibilityNodeInfo.ACTION_CLEAR_ACCESSIBILITY_FOCUS,
        AccessibilityNodeInfo.AccessibilityAction.ACTION_SHOW_ON_SCREEN.id)
      if (text.isBlank() && description.isBlank() && !node.isClickable && !node.isEditable && !node.isScrollable && node.actionList.none { it.id !in passive }) continue
      val id = "n${anchors.size}"; val area = bounds(node); anchors[id] = Anchor(path, fingerprint(node))
      val actions = JSONArray(); node.actionList.forEach { actions.put(JSONObject().put("id", it.id).put("label", it.label?.toString() ?: JSONObject.NULL)) }
      nodes.put(JSONObject().put("nodeId", id).put("text", text).put("description", description).put("label", label(node))
        .put("resourceId", node.viewIdResourceName ?: "").put("className", node.className?.toString() ?: "")
        .put("clickable", node.isClickable).put("editable", node.isEditable).put("scrollable", node.isScrollable)
        .put("enabled", node.isEnabled).put("selected", node.isSelected).put("focused", node.isFocused).put("focusable", node.isFocusable)
        .put("showingHint", if (Build.VERSION.SDK_INT >= 26) node.isShowingHintText else false).put("actions", actions)
        .put("bounds", JSONArray().put(area.left).put(area.top).put(area.right).put(area.bottom)))
    }
    val id = UUID.randomUUID().toString(); val (area, boundsSource) = viewport(root, target.displayId); val packageName = root.packageName?.toString().orEmpty()
    snapshots[id] = Snapshot(target.scope, packageName, root.windowId, target.displayId, context(root), area, anchors)
    while (snapshots.size > 16) snapshots.remove(snapshots.keys.first())
    val end = minOf(nodes.length().toLong(), offset.toLong() + PhonePolicy.PAGE_SIZE).toInt(); val page = JSONArray()
    for (index in offset until end) page.put(nodes.getJSONObject(index))
    return JSONObject().put("ok", true).put("snapshotId", id).put("packageName", packageName).put("windowId", root.windowId)
      .put("displayId", target.displayId).put("nodes", page).put("total", nodes.length()).put("nextOffset", if (end < nodes.length()) end else JSONObject.NULL)
      .put("revision", revision(packageName))
      .put("truncated", pending.isNotEmpty()).put("source", "accessibility").put("externalData", true)
      .put("bounds", JSONArray().put(area.left).put(area.top).put(area.right).put(area.bottom))
      .put("boundsSource", boundsSource).put("emptyTree", nodes.length() == 0)
      .put("diagnostics", if (nodes.length() == 0) "系统返回空控件树；可请求 visualText 本机识字。空树不等于无授权，不要重复授权。" else JSONObject.NULL)
  }
  suspend fun awaitScreen(target: PhoneUiTarget, offset: Int = 0, before: Long? = null, cancelled: () -> Boolean = { false },
    deadlineMs: Long = PhonePolicy.DEADLINE_MS, ready: (Long, Long, Long, Boolean, Boolean) -> Boolean = PhonePolicy::ready): JSONObject {
    val started = SystemClock.elapsedRealtime()
    while (true) {
      if (cancelled()) throw PhoneFailure("cancelled", "手机操作请求已取消。")
      target.validate()
      val now = SystemClock.elapsedRealtime(); val expired = now - started >= deadlineMs
      try {
        val current = root(target); val change = changes[current.packageName?.toString()]
        val changed = before != null && (change?.revision ?: 0L) > before
        if (expired || ready(now, started, change?.at ?: 0L, changed, before != null)) return screen(target, offset)
          .put("observation", JSONObject().put("changed", changed).put("timedOut", expired).put("waitMs", now - started)
            .put("reason", if (expired) "deadline" else if (changed) "event_settled" else if (before == null) "already_ready" else "no_event_fallback"))
      } catch (error: PhoneFailure) {
        if (expired || error.code !in setOf("screen_unavailable", "wrong_app")) throw error
      }
      delay(40)
    }
  }
  private fun checkedSnapshot(target: PhoneUiTarget, id: String): Pair<Snapshot, AccessibilityNodeInfo> {
    val snapshot = snapshots[id] ?: throw PhoneFailure("stale_screen", "界面引用已过期，请重新读取，不要重复旧操作。")
    if (snapshot.scope != target.scope) throw PhoneFailure("wrong_request", "界面引用不属于本次任务。")
    if (snapshot.displayId != target.displayId) throw PhoneFailure("stale_display", "操作显示器已变化，请重新读取。")
    val current = root(target)
    if (snapshot.packageName != current.packageName?.toString() || snapshot.windowId != current.windowId ||
      target.strictContext && snapshot.context != context(current)) throw PhoneFailure("stale_screen", "当前应用、窗口或页面上下文已变化，未执行旧操作，请重新观察。")
    if (snapshot.bounds != viewport(current, target.displayId).first)
      throw PhoneFailure("stale_screen", "屏幕方向、窗口或键盘布局已改变，未使用旧范围操作；请重新观察。")
    return snapshot to current
  }
  suspend fun visualText(target: PhoneUiTarget, id: String): JSONObject {
    val (snapshot, root) = checkedSnapshot(target, id)
    if (target.displayId != 0) throw PhoneFailure("ocr_display_unsupported", "本机识字仅用于当前授权的主屏幕。")
    val observedRevision = revision(snapshot.packageName)
    visual?.takeIf { it.scope == snapshot.scope && it.packageName == snapshot.packageName && it.windowId == snapshot.windowId &&
      it.context == snapshot.context && it.bounds == snapshot.bounds && it.revision == observedRevision && SystemClock.elapsedRealtime() - it.at < 750 }?.let {
      snapshot.visualRevision = observedRevision
      return JSONObject(it.result.toString()).put("reused", true)
    }
    val passwords = mutableListOf<Rect>(); val pending = ArrayDeque<AccessibilityNodeInfo>(); pending.add(root); var visited = 0
    service.windows.filter { it.id != root.windowId && it.type == AccessibilityWindowInfo.TYPE_APPLICATION }.forEach { window -> window.root?.let(pending::addLast) }
    while (pending.isNotEmpty()) {
      if (++visited > 10000) throw PhoneFailure("ocr_tree_truncated", "无法完整检查密码区域，本次不截图；可继续分页读取控件。")
      val node = pending.removeFirst()
      if (node.isPassword) { passwords.add(bounds(node)); continue }
      for (index in 0 until node.childCount) node.getChild(index)?.let(pending::addLast)
    }
    val result = PhoneOcr.read(service, snapshot.bounds, passwords)
    checkedSnapshot(target, id) // Do not attach a late capture to a new page, request or permission scope.
    if (revision(snapshot.packageName) != observedRevision) throw PhoneFailure("stale_visual_text", "识字期间页面内容发生变化，请重新观察；本次识字坐标未用于点击。")
    snapshot.visualRevision = observedRevision
    visual = Visual(snapshot.scope, snapshot.packageName, snapshot.windowId, snapshot.context, Rect(snapshot.bounds), observedRevision, SystemClock.elapsedRealtime(), JSONObject(result.toString()))
    return result
  }
  private fun nodeAt(root: AccessibilityNodeInfo, path: List<Int>): AccessibilityNodeInfo? {
    var node = root; for (index in path) node = node.getChild(index) ?: return null; return node
  }
  private fun arguments(value: JSONObject?): Bundle = Bundle().apply {
    value?.keys()?.forEach { key -> when (val item = value.get(key)) {
      is String -> putCharSequence(key, item)
      is Int -> if (key == AccessibilityNodeInfo.ACTION_ARGUMENT_PROGRESS_VALUE) putFloat(key, item.toFloat()) else putInt(key, item)
      is Long -> putLong(key, item)
      is Number -> putFloat(key, item.toFloat())
      is Boolean -> putBoolean(key, item)
      else -> throw PhoneFailure("invalid_argument", "无障碍操作参数只接受文字、数值或布尔值。")
    } }
  }
  fun prepareAction(target: PhoneUiTarget, command: JSONObject): () -> Boolean {
    val id = command.getString("snapshotId"); val (snapshot, _) = checkedSnapshot(target, id)
    val action = command.getString("action")
    if (action == "back") return { checkedSnapshot(target, id); target.back?.invoke() ?: if (target.displayId == 0) service.performGlobalAction(AccessibilityService.GLOBAL_ACTION_BACK) else false }
    val anchor = snapshot.anchors[command.optString("nodeId")] ?: throw PhoneFailure("unknown_node", "控件不在真实界面中，请重新读取。")
    fun checked(): AccessibilityNodeInfo {
      val (_, root) = checkedSnapshot(target, id); val node = nodeAt(root, anchor.path) ?: throw PhoneFailure("stale_node", "控件位置已变化，请重新观察。")
      if (!node.refresh() || !node.isVisibleToUser || !node.isEnabled || node.isPassword || fingerprint(node) != anchor.fingerprint)
        throw PhoneFailure("stale_node", "控件已变化、不可操作或属于密码字段，未执行操作。")
      return node
    }
    val node = checked()
    if (action == "set_text" && (!node.isEditable || !command.has("text"))) throw PhoneFailure("not_editable", "目标不是可填写控件。")
    val customArgs = arguments(command.optJSONObject("arguments"))
    if (action == "accessibility_action" && node.actionList.none { it.id == command.optInt("actionId") }) throw PhoneFailure("unsupported_action", "该控件没有报告此操作能力。")
    if (action !in setOf("click", "tap", "long_click", "set_text", "submit", "scroll_forward", "scroll_backward", "accessibility_action")) throw PhoneFailure("unsupported_action", "未知控件操作类型。")
    fun touch(): Boolean {
      val area = bounds(checked()); if (area.isEmpty) return false
      target.tap?.let { return it(area.exactCenterX(), area.exactCenterY()) }
      if (target.displayId != 0) throw PhoneFailure("display_input_unavailable", "此显示器没有独立输入路由，未操作主屏幕。")
      return service.dispatchGesture(GestureDescription.Builder().addStroke(GestureDescription.StrokeDescription(Path().apply { moveTo(area.exactCenterX(), area.exactCenterY()) }, 0, 60)).build(), null, null)
    }
    return {
      var current = checked()
      when (action) {
        "set_text" -> current.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, Bundle().apply { putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, command.getString("text")) })
        "submit" -> target.submit?.invoke() ?: if (target.displayId == 0 && Build.VERSION.SDK_INT >= 30) current.performAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_IME_ENTER.id) else false
        "scroll_forward", "scroll_backward" -> current.performAction(if (action == "scroll_forward") AccessibilityNodeInfo.ACTION_SCROLL_FORWARD else AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD)
        "accessibility_action" -> current.performAction(command.getInt("actionId"), customArgs)
        "long_click" -> current.performAction(AccessibilityNodeInfo.ACTION_LONG_CLICK)
        "tap" -> touch()
        else -> {
          var depth = 0
          while (!current.isClickable && depth++ < 5) {
            val parent = current.parent ?: break
            if (parent.isScrollable || parent.className?.toString() == "android.webkit.WebView") break
            current = parent
          }
          if (current.isClickable && current.performAction(AccessibilityNodeInfo.ACTION_CLICK)) true else touch()
        }
      }
    }
  }
  fun prepareGlobal(target: PhoneUiTarget, command: JSONObject): () -> Boolean {
    val id = command.getString("snapshotId"); checkedSnapshot(target, id)
    if (target.displayId != 0) throw PhoneFailure("display_input_unavailable", "系统操作只用于明确授权的主屏幕。")
    val action = command.getInt("actionId")
    if (Build.VERSION.SDK_INT >= 30 && service.systemActions.none { it.id == action }) throw PhoneFailure("unsupported_action", "系统当前没有报告这个操作。")
    return { checkedSnapshot(target, id); service.performGlobalAction(action) }
  }
  fun prepareGesture(target: PhoneUiTarget, command: JSONObject): suspend () -> Boolean {
    val id = command.getString("snapshotId"); val (snapshot, _) = checkedSnapshot(target, id)
    if (target.displayId != 0) throw PhoneFailure("display_input_unavailable", "通用手势仅用于主屏幕；未替代独立显示器路由。")
    val duration = command.getLong("durationMs"); val paths = command.getJSONArray("paths")
    if (duration !in 1..GestureDescription.getMaxGestureDuration() || paths.length() !in 1..GestureDescription.getMaxStrokeCount()) throw PhoneFailure("invalid_gesture", "手势时长或触点数量超出系统支持范围。")
    val builder = GestureDescription.Builder()
    for (index in 0 until paths.length()) {
      val points = paths.getJSONArray(index); if (points.length() == 0) throw PhoneFailure("invalid_gesture", "手势路径不能为空。")
      val path = Path()
      for (pointIndex in 0 until points.length()) {
        val point = points.getJSONObject(pointIndex); val x = point.getDouble("x"); val y = point.getDouble("y")
        PhonePolicy.point(x, y, snapshot.bounds.left, snapshot.bounds.top, snapshot.bounds.right, snapshot.bounds.bottom)
        if (pointIndex == 0) path.moveTo(x.toFloat(), y.toFloat()) else path.lineTo(x.toFloat(), y.toFloat())
      }
      builder.addStroke(GestureDescription.StrokeDescription(path, 0, duration))
    }
    val gesture = builder.build()
    return {
      checkedSnapshot(target, id)
      if (snapshot.visualRevision != null && snapshot.visualRevision != revision(snapshot.packageName))
        throw PhoneFailure("stale_visual_text", "识字后页面内容发生变化，未使用旧坐标；请重新观察。")
      withTimeout(duration + 3000) {
        suspendCancellableCoroutine { continuation ->
          val accepted = service.dispatchGesture(gesture, object : AccessibilityService.GestureResultCallback() {
            override fun onCompleted(gestureDescription: GestureDescription) { if (continuation.isActive) continuation.resume(true) }
            override fun onCancelled(gestureDescription: GestureDescription) { if (continuation.isActive) continuation.resume(false) }
          }, null)
          if (!accepted && continuation.isActive) continuation.resume(false)
        }
      }
    }
  }
}
