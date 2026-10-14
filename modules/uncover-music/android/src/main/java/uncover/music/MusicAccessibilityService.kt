package uncover.music

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.graphics.Rect
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.view.accessibility.AccessibilityWindowInfo
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID
import kotlinx.coroutines.delay

class MusicAccessibilityService : AccessibilityService() {
  companion object { @Volatile var instance: MusicAccessibilityService? = null; private set }
  private data class Anchor(val path: List<Int>, val fingerprint: String)
  private data class Snapshot(val provider: String, val displayId: Int, val anchors: Map<String, Anchor>)
  private val snapshots = linkedMapOf<String, Snapshot>()
  private data class Change(val revision: Long, val at: Long)
  private val changes = mutableMapOf<String, Change>()
  override fun onServiceConnected() { instance = this }
  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    // Retain primitive timing only, not event objects, text or arbitrary app data.
    if (!MusicLedger.consent(this, "screen")) return
    val name = event?.packageName?.toString() ?: return
    if (name !in MusicPolicy.packages.values) return
    if (event.eventType !in setOf(AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED, AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED,
        AccessibilityEvent.TYPE_WINDOWS_CHANGED, AccessibilityEvent.TYPE_VIEW_SCROLLED, AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED)) return
    val old = changes[name]
    changes[name] = Change((old?.revision ?: 0L) + 1, SystemClock.elapsedRealtime())
  }
  internal fun revision(provider: String) = changes[MusicPolicy.packageFor(provider)]?.revision ?: 0L
  internal suspend fun awaitScreen(provider: String, offset: Int, before: Long? = null, cancelled: () -> Boolean = { false }): JSONObject {
    require(offset >= 0)
    val started = SystemClock.elapsedRealtime()
    var changed = false
    while (true) {
      if (cancelled()) throw MusicFailure("cancelled", "音乐请求已取消。")
      val now = SystemClock.elapsedRealtime()
      val change = changes[MusicPolicy.packageFor(provider)]
      changed = before != null && (change?.revision ?: 0L) > before
      val expired = now - started >= MusicObservationPolicy.DEADLINE_MS
      val ready = MusicObservationPolicy.ready(now, started, change?.at ?: 0L, changed, before != null)
      try {
        root(provider) // Fail missing consent immediately; only transient window readiness is retried.
        if (ready || expired) return screen(provider, offset).put("observation", JSONObject()
          .put("changed", changed).put("timedOut", expired).put("waitMs", now - started)
          .put("reason", if (expired) "deadline" else if (changed) "event_settled" else if (before == null) "already_ready" else "no_event_fallback"))
      } catch (error: MusicFailure) {
        if (expired || error.code !in setOf("screen_unavailable", "needs_open_app", "background_screen_unavailable")) throw error
      }
      delay(40)
    }
  }
  override fun onInterrupt() { snapshots.clear(); MusicExecutionService.cancelActive(); MusicBackground.close() }
  override fun onDestroy() { snapshots.clear(); MusicExecutionService.cancelActive(); MusicBackground.close(); if (instance === this) instance = null; super.onDestroy() }
  internal fun forgetScreens() { snapshots.clear(); changes.clear() }
  private fun foregroundRoot(): AccessibilityNodeInfo? {
    val visibleWindows = windows
    val active = rootInActiveWindow
    val keyboardActive = visibleWindows.any { it.type == AccessibilityWindowInfo.TYPE_INPUT_METHOD && (active == null || it.id == active.windowId || it.isActive) }
    if (!keyboardActive) return active
    // Choose the foreground application, not an arbitrary music window behind a different app.
    val applications = visibleWindows.filter { it.type == AccessibilityWindowInfo.TYPE_APPLICATION }
    val foreground = applications.filter { it.isFocused || it.isActive }.maxByOrNull { it.layer }
      ?: applications.maxByOrNull { it.layer }
    return foreground?.root ?: active
  }
  private fun root(provider: String): AccessibilityNodeInfo {
    if (!MusicLedger.consent(this, "screen")) throw MusicFailure("screen_consent_required", "请先在音乐设置中同意让模型读取音乐界面。")
    if (MusicBackground.enabled(this)) {
      val displayId = MusicBackground.target(this, provider)
      // Never rootInActiveWindow/windows/default-display fallback in background mode.
      val candidates = windowsOnAllDisplays.get(displayId).orEmpty().filter { it.type == AccessibilityWindowInfo.TYPE_APPLICATION }
      val window = candidates.filter { it.isFocused || it.isActive }.maxByOrNull { it.layer } ?: candidates.maxByOrNull { it.layer }
        ?: throw MusicFailure("background_screen_unavailable", "系统尚未返回虚拟屏幕音乐窗口，请稍后重读；未读取主屏幕。")
      MusicDisplayPolicy.requireDisplay(window.displayId, displayId)
      val node = window.root ?: throw MusicFailure("background_screen_unavailable", "音乐虚拟界面尚未就绪，请稍后重读。")
      if (node.packageName?.toString() != MusicPolicy.packageFor(provider)) throw MusicFailure("background_external_window", "虚拟屏幕出现其他应用或授权界面，请你手动处理；模型不会读取或点击。")
      return node
    }
    val node = foregroundRoot() ?: throw MusicFailure("screen_unavailable", "系统尚未返回音乐界面，请稍后重新读取。")
    if (node.packageName?.toString() != MusicPolicy.packageFor(provider)) throw MusicFailure("needs_open_app", "当前前台不是选定的音乐软件，请先打开它；不会读取其他应用。")
    return node
  }
  private fun nodeAt(root: AccessibilityNodeInfo, path: List<Int>): AccessibilityNodeInfo? {
    var node = root
    for (index in path) node = node.getChild(index) ?: return null
    return node
  }
  private fun label(node: AccessibilityNodeInfo, depth: Int = 0): String {
    if (node.isPassword) return ""
    val own = listOfNotNull(node.text?.toString(), node.contentDescription?.toString()).filter { it.isNotBlank() }.distinct().joinToString(" · ")
    if (own.isNotBlank() || depth >= 3 || node.isScrollable) return own
    return (0 until node.childCount).mapNotNull { node.getChild(it) }.map { label(it, depth + 1) }.filter { it.isNotBlank() }.distinct().take(8).joinToString(" · ")
  }
  private fun fingerprint(node: AccessibilityNodeInfo) = listOf(node.viewIdResourceName ?: "", node.className?.toString() ?: "", label(node), node.isPassword.toString()).joinToString("\u0001")
  internal fun screen(provider: String, offset: Int): JSONObject {
    if (Build.VERSION.SDK_INT >= 33) clearCache()
    val root = root(provider)
    val anchors = linkedMapOf<String, Anchor>()
    val nodes = JSONArray()
    val pending = ArrayDeque<Pair<AccessibilityNodeInfo, List<Int>>>()
    pending.add(root to emptyList())
    var visited = 0
    while (pending.isNotEmpty() && visited++ < 10000) {
      val (node, path) = pending.removeFirst()
      if (node.isPassword) continue
      for (index in 0 until node.childCount) node.getChild(index)?.let { pending.add(it to (path + index)) }
      if (!node.isVisibleToUser) continue
      val text = node.text?.toString().orEmpty()
      val description = node.contentDescription?.toString().orEmpty()
      if (text.isBlank() && description.isBlank() && !node.isClickable && !node.isEditable && !node.isScrollable) continue
      val id = "n${anchors.size}"
      val bounds = Rect().also { node.getBoundsInScreen(it) }
      anchors[id] = Anchor(path, fingerprint(node))
      nodes.put(JSONObject().put("nodeId", id).put("text", text).put("description", description).put("label", label(node))
        .put("resourceId", node.viewIdResourceName ?: "").put("className", node.className?.toString() ?: "")
        .put("clickable", node.isClickable).put("editable", node.isEditable).put("scrollable", node.isScrollable)
        .put("enabled", node.isEnabled).put("selected", node.isSelected)
        .put("focused", node.isFocused).put("focusable", node.isFocusable)
        .put("showingHint", if (Build.VERSION.SDK_INT >= 26) node.isShowingHintText else false)
        .put("bounds", JSONArray().put(bounds.left).put(bounds.top).put(bounds.right).put(bounds.bottom)))
    }
    val snapshotId = UUID.randomUUID().toString()
    val displayId = if (MusicBackground.enabled(this)) MusicBackground.target(this, provider) else 0
    snapshots[snapshotId] = Snapshot(provider, displayId, anchors)
    while (snapshots.size > 8) snapshots.remove(snapshots.keys.first())
    val page = JSONArray()
    val end = minOf(nodes.length().toLong(), offset.toLong() + 200).toInt()
    for (index in offset until end) page.put(nodes.getJSONObject(index))
    return JSONObject().put("ok", true).put("provider", provider).put("snapshotId", snapshotId).put("nodes", page)
      .put("total", nodes.length()).put("nextOffset", if (end < nodes.length()) end else JSONObject.NULL)
      .put("truncated", pending.isNotEmpty()).put("source", "accessibility").put("displayId", displayId).put("mode", if (displayId > 0) "background" else "foreground").put("externalData", true)
  }
  internal fun prepareAction(provider: String, command: JSONObject): () -> Boolean {
    val snapshot = snapshots[command.optString("snapshotId")] ?: throw MusicFailure("stale_screen", "界面引用已过期，请重新读取音乐界面。")
    if (snapshot.provider != provider) throw MusicFailure("wrong_provider", "界面引用不属于当前音乐软件。")
    val displayId = if (MusicBackground.enabled(this)) MusicBackground.target(this, provider) else 0
    if (snapshot.displayId != displayId) throw MusicFailure("stale_display", "音乐执行模式或虚拟屏幕已变化，请重新读取。")
    root(provider)
    val action = command.getString("action")
    if (action == "back") return { root(provider); if (displayId > 0) MusicBackground.key(this, provider, "back") else performGlobalAction(GLOBAL_ACTION_BACK) }
    val anchor = snapshot.anchors[command.optString("nodeId")] ?: throw MusicFailure("unknown_node", "控件编号不在真实音乐界面中，请重新读取。")
    fun checked(): AccessibilityNodeInfo {
      val node = nodeAt(root(provider), anchor.path) ?: throw MusicFailure("stale_node", "控件已变化，请重新读取音乐界面。")
      if (!node.refresh() || !node.isVisibleToUser || !node.isEnabled || node.isPassword || fingerprint(node) != anchor.fingerprint) throw MusicFailure("stale_node", "控件已变化或不可操作，请重新读取音乐界面。")
      return node
    }
    val node = checked()
    if (action == "set_text" && (!node.isEditable || !command.has("text"))) throw MusicFailure("not_editable", "该控件不是可填写的音乐搜索框。")
    if (action !in setOf("click", "tap", "set_text", "submit", "scroll_forward", "scroll_backward")) throw MusicFailure("unsupported_action", "控件不支持此操作。")
    fun touch(): Boolean {
      val bounds = Rect().also { checked().getBoundsInScreen(it) }
      if (bounds.isEmpty) return false
      if (displayId > 0) return MusicBackground.tap(this, provider, bounds.exactCenterX(), bounds.exactCenterY())
      return dispatchGesture(GestureDescription.Builder().addStroke(GestureDescription.StrokeDescription(Path().apply { moveTo(bounds.exactCenterX(), bounds.exactCenterY()) }, 0, 60)).build(), null, null)
    }
    return {
      var current = checked()
      when (action) {
        "set_text" -> current.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, Bundle().apply { putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, command.getString("text")) })
        "submit" -> if (displayId > 0) MusicBackground.key(this, provider, "submit") else if (Build.VERSION.SDK_INT >= 30) current.performAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_IME_ENTER.id) else false
        "scroll_forward", "scroll_backward" -> current.performAction(if (action == "scroll_forward") AccessibilityNodeInfo.ACTION_SCROLL_FORWARD else AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD)
        "tap" -> touch()
        else -> {
          var depth = 0
          while (!current.isClickable && depth++ < 5) {
            val parent = current.parent ?: break
            // A WebView or scrolling list is not the selected song/button. Tap the node's live bounds instead.
            if (parent.isScrollable || parent.className?.toString() == "android.webkit.WebView") break
            current = parent
          }
          if (current.isClickable && current.performAction(AccessibilityNodeInfo.ACTION_CLICK)) true else touch()
        }
      }
    }
  }
  internal fun isMusicForeground(): Boolean = foregroundRoot()?.packageName?.toString() in MusicPolicy.packages.values
}
