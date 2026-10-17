package uncover.device

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import android.test.InstrumentationTestCase
import android.text.InputType
import android.view.View
import android.view.accessibility.AccessibilityNodeInfo
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.util.UUID

/** Isolated synthetic chat controls, plus actual Android app launch. Never sends to real people. */
@Suppress("DEPRECATION")
class PhoneControlTest : InstrumentationTestCase() {
  private lateinit var activity: PhoneFixtureActivity
  private val context get() = instrumentation.targetContext
  private lateinit var request: String
  private lateinit var execution: String
  override fun setUp() {
    super.setUp(); request = UUID.randomUUID().toString(); execution = UUID.randomUUID().toString()
    val deadline = System.nanoTime() + 30_000_000_000L
    while (PhoneAccessibilityService.instance == null && System.nanoTime() < deadline) Thread.sleep(50)
    assertNotNull("Enable only the owned emulator's PhoneFixtureService before running this test", PhoneAccessibilityService.instance)
    instrumentation.runOnMainSync { PhoneLedger.clear(context); PhoneLedger.consent(context, true); PhoneAccessibilityService.instance!!.refreshAccess() }
    activity = instrumentation.startActivitySync(Intent(context, PhoneFixtureActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) as PhoneFixtureActivity
    instrumentation.waitForIdleSync()
    read()
  }
  override fun tearDown() {
    instrumentation.runOnMainSync { PhoneExecutionService.finish(execution); activity.finish() }
    super.tearDown()
  }
  private fun main(block: suspend () -> JSONObject): JSONObject = runBlocking { withContext(Dispatchers.Main) { block() } }
  private fun read() = main { PhoneController.screen(context, request, execution, 0, context.packageName) }
  private fun execute(command: JSONObject) = main { PhoneController.safeRequest { PhoneController.executeAndObserve(context, request, execution, command) } }
  private fun node(screen: JSONObject, label: String): String {
    val nodes = screen.getJSONArray("nodes")
    return (0 until nodes.length()).map(nodes::getJSONObject).first { it.optString("label") == label || it.optString("text") == label }.getString("nodeId")
  }
  private fun action(screen: JSONObject, label: String, key: String, type: String, text: String? = null) = JSONObject().put("type", "ui").put("operationKey", key)
    .put("snapshotId", screen.getString("snapshotId")).put("nodeId", node(screen, label)).put("action", type).apply { if (text != null) put("text", text) }
  fun testRealNodesFillAndSendOnceWhileAnExactRetryOnlyReturnsReceipt() {
    val body = "MAX isolated message — not a real contact"
    val filled = execute(action(read(), "输入测试消息", "fill", "set_text", body))
    assertTrue(filled.toString(), filled.getJSONObject("action").getBoolean("ok"))
    val send = action(filled.getJSONObject("screen"), "发送测试消息", "send", "click")
    val result = execute(send); assertTrue(result.toString(), result.getJSONObject("action").getBoolean("ok"))
    assertFalse(result.getJSONObject("action").getBoolean("verifiedTaskCompleted")); assertTrue(result.getJSONObject("screen").toString().contains(body))
    assertEquals(1, activity.sent)
    val replay = execute(JSONObject(send.toString())); assertTrue(replay.getJSONObject("action").getBoolean("replayed")); assertEquals(1, activity.sent)
  }
  fun testAStartedButUnfinishedOperationCannotBeResentAfterAnUncertainOutcome() {
    val send = action(read(), "发送测试消息", "uncertain-send", "click")
    instrumentation.runOnMainSync { PhoneLedger.begin(context, request, execution, send) }
    val result = execute(send).getJSONObject("action")
    assertEquals("uncertain_operation", result.getString("code")); assertTrue(result.getBoolean("replayed")); assertTrue(result.getBoolean("mayHaveExecuted")); assertEquals(0, activity.sent)
  }
  fun testChangingTheConversationHeaderRejectsTheOldSendButtonEvenIfItsNodeStillExists() {
    val frame = read(); val send = action(frame, "发送测试消息", "stale-conversation", "click")
    instrumentation.runOnMainSync { activity.header.text = "A different conversation" }
    instrumentation.waitForIdleSync()
    val result = execute(send).getJSONObject("action"); assertFalse(result.getBoolean("ok")); assertEquals("stale_screen", result.getString("code")); assertEquals(0, activity.sent)
  }
  fun testCancellationAndConsentRevocationBothPreventPhysicalDispatch() {
    val send = action(read(), "发送测试消息", "cancelled-send", "click")
    PhoneLedger.cancel(execution); val result = execute(send)
    assertFalse(result.getBoolean("ok")); assertEquals("cancelled", result.getString("code")); assertEquals(0, activity.sent)
    execution = UUID.randomUUID().toString()
    instrumentation.runOnMainSync { PhoneLedger.consent(context, false); PhoneAccessibilityService.instance!!.refreshAccess() }
    val revoked = execute(send); assertEquals("phone_consent_required", revoked.getString("code")); assertEquals(0, activity.sent)
  }
  fun testPasswordTextIsNotReturnedToTheModel() {
    val frame = read(); assertFalse(frame.toString().contains("PRIVATE_FIXTURE_PASSWORD"))
    assertTrue(frame.getJSONArray("nodes").length() > 3)
  }
  fun testScreenshotWithMissingRootBoundsUsesTheRealCaptureInsteadOfFailingRepeatedly() {
    val result = main { PhoneOcr.read(PhoneAccessibilityService.instance!!, Rect(), emptyList()) }
    assertTrue(result.toString(), result.getBoolean("ok")); assertTrue(result.toString(), result.toString().contains("MAX CANVAS 42"))
  }
  fun testEmptyRootAndWindowGeometryStillResolveARealDisplayFromTheAccessibilityService() {
    verifyDisplayFallback()
  }
  private fun verifyDisplayFallback() {
    instrumentation.runOnMainSync {
      @Suppress("DEPRECATION")
      val empty = AccessibilityNodeInfo.obtain()
      empty.setBoundsInScreen(Rect())
      val (area, source) = PhoneAccessibilityService.instance!!.phoneUi.viewport(empty, 0)
      assertTrue(area.width() > 0 && area.height() > 0); assertEquals("display", source)
    }
  }
  fun testSavedSequenceReobservesEveryStepAndCannotReplayASend() {
    val steps = org.json.JSONArray()
      .put(JSONObject().put("type", "ui").put("packageName", context.packageName).put("selector", JSONObject().put("description", "输入测试消息")).put("action", "set_text").put("text", "MAX sequence fixture"))
      .put(JSONObject().put("type", "ui").put("packageName", context.packageName).put("selector", JSONObject().put("text", "发送测试消息")).put("action", "click").put("expectedText", org.json.JSONArray().put("Isolated conversation — not WeChat")))
      .put(JSONObject().put("type", "observe").put("packageName", context.packageName).put("expectedText", org.json.JSONArray().put("Sent 1: MAX sequence fixture")))
    val command = JSONObject().put("type", "sequence").put("operationKey", "known-sequence").put("steps", steps)
    val result = main { PhoneSequences.run(context, request, execution, command) }
    assertTrue(result.toString(), result.getBoolean("ok")); assertEquals(1, activity.sent)
    val retry = main { PhoneSequences.run(context, request, execution, command) }
    assertTrue(retry.getBoolean("replayed")); assertEquals(1, activity.sent)
  }
  fun testChangedSequenceContextStopsBeforeTheFirstPhysicalAction() {
    val steps = org.json.JSONArray().put(JSONObject().put("type", "ui").put("packageName", context.packageName).put("selector", JSONObject().put("text", "发送测试消息"))
      .put("action", "click").put("expectedText", org.json.JSONArray().put("Not the requested conversation")))
    val result = main { PhoneSequences.run(context, request, execution, JSONObject().put("type", "sequence").put("operationKey", "stale-sequence").put("steps", steps)) }
    assertFalse(result.toString(), result.getBoolean("ok")); assertEquals("workflow_page_changed", result.getString("code")); assertEquals(0, activity.sent)
  }
  fun testAFrameFromAnotherTaskOrDisplayCannotAuthorizeAnAction() {
    val frame = read(); val command = action(frame, "发送测试消息", "other-task-send", "click")
    val result = main { PhoneController.safeRequest { PhoneController.executeAndObserve(context, "another-user-message", execution, command) } }
    assertEquals("wrong_request", result.getJSONObject("action").getString("code")); assertEquals(0, activity.sent)
    val failedDisplay = main { PhoneController.safe { PhoneAccessibilityService.instance!!.phoneUi.screen(PhoneUiTarget("fixture", context.packageName, 912345, validate = {})) } }
    assertFalse(failedDisplay.getBoolean("ok")); assertEquals("screen_unavailable", failedDisplay.getString("code")); assertEquals(0, activity.sent)
  }
  fun testAnUnknownAppIsDiscoveredFromPackageManagerAndCannotBeReplacedWithAnotherPackage() {
    val apps = PhoneApps.find(context, context.packageName, 0).getJSONArray("apps")
    assertEquals(1, apps.length()); assertEquals(context.packageName, apps.getJSONObject(0).getString("packageName"))
    val result = execute(JSONObject().put("type", "open").put("operationKey", "not-installed").put("packageName", "org.example.this_app_is_not_installed"))
    assertEquals("app_not_launchable", result.getJSONObject("action").getString("code"))
  }
  fun testRetryOfTheSameUserMessageCannotReuseThePreviousExecutionFrame() {
    val command = action(read(), "发送测试消息", "previous-attempt-frame", "click")
    execution = UUID.randomUUID().toString()
    val result = execute(command)
    assertEquals("wrong_request", result.getJSONObject("action").getString("code")); assertEquals(0, activity.sent)
  }
  fun testTheSameControllerOpensAndObservesActualAndroidSettingsWithoutAnAppWorkflow() {
    val apps = PhoneApps.find(context, "com.android.settings", 0).getJSONArray("apps")
    assertTrue("Owned emulator has no launchable settings app", apps.length() > 0)
    val result = execute(JSONObject().put("type", "open").put("operationKey", "open-actual-settings").put("packageName", apps.getJSONObject(0).getString("packageName")))
    assertTrue(result.toString(), result.getBoolean("observedRequestedApp")); assertEquals("com.android.settings", result.getJSONObject("screen").getString("packageName"))
    assertTrue(result.getJSONObject("screen").getJSONArray("nodes").length() > 0)
  }
  fun testTheSameControllerOpensActualChromeWithoutAcceptingAgreementsOrLoggingIn() {
    val apps = PhoneApps.find(context, "com.android.chrome", 0).getJSONArray("apps")
    assertTrue("Owned emulator has no Chrome", apps.length() > 0)
    val result = execute(JSONObject().put("type", "open").put("operationKey", "open-actual-browser").put("packageName", apps.getJSONObject(0).getString("packageName")))
    assertTrue(result.toString(), result.getBoolean("observedRequestedApp")); assertEquals("com.android.chrome", result.getJSONObject("screen").getString("packageName"))
  }
  fun testLocalOcrFindsCanvasTextWithoutUploadingAnImageOrReadingThePassword() {
    val frame = main { PhoneController.screen(context, request, execution, 0, context.packageName, true) }
    val visual = frame.getJSONObject("visualText")
    assertTrue(frame.toString(), visual.getBoolean("ok")); assertFalse(visual.getBoolean("imageUploaded"))
    assertTrue(visual.toString(), visual.getJSONArray("lines").toString().contains("CANVAS"))
    assertFalse(visual.toString().contains("PRIVATE_FIXTURE_PASSWORD"))
    assertFalse(frame.getJSONArray("nodes").toString().contains("CANVAS"))
  }
  fun testActualGestureTapUsesObservedBoundsAndRejectsOffScreenCoordinates() {
    val frame = read(); val nodes = frame.getJSONArray("nodes")
    val target = (0 until nodes.length()).map(nodes::getJSONObject).first { it.optString("text") == "发送测试消息" }
    val bounds = target.getJSONArray("bounds"); val x = (bounds.getDouble(0) + bounds.getDouble(2)) / 2; val y = (bounds.getDouble(1) + bounds.getDouble(3)) / 2
    val command = JSONObject().put("type", "gesture").put("operationKey", "actual-touch").put("snapshotId", frame.getString("snapshotId")).put("durationMs", 80)
      .put("paths", org.json.JSONArray().put(org.json.JSONArray().put(JSONObject().put("x", x).put("y", y))))
    val result = execute(command); assertTrue(result.toString(), result.getJSONObject("action").getBoolean("ok")); assertEquals(1, activity.sent)
    val invalid = JSONObject(command.toString()).put("snapshotId", read().getString("snapshotId")).put("operationKey", "outside")
      .put("paths", org.json.JSONArray().put(org.json.JSONArray().put(JSONObject().put("x", -100).put("y", -100))))
    assertEquals("outside_screen", execute(invalid).getJSONObject("action").getString("code")); assertEquals(1, activity.sent)
  }
}

class PhoneFixtureService : PhoneAccessibilityService()
class PhoneFixtureActivity : Activity() {
  lateinit var header: TextView; private set
  var sent = 0; private set
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val layout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(24, 24, 24, 24) }
    header = TextView(this).apply { text = "Isolated conversation — not WeChat"; textSize = 22f; id = View.generateViewId() }; layout.addView(header)
    val input = EditText(this).apply { hint = "输入测试消息"; contentDescription = "输入测试消息"; id = View.generateViewId() }; layout.addView(input)
    val password = EditText(this).apply { inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD; setText("PRIVATE_FIXTURE_PASSWORD"); id = View.generateViewId() }; layout.addView(password)
    val send = Button(this).apply { text = "发送测试消息"; id = View.generateViewId() }
    layout.addView(send); val output = TextView(this).apply { id = View.generateViewId() }; layout.addView(output)
    send.setOnClickListener { sent++; output.text = "Sent $sent: ${input.text}" }
    layout.addView(object : View(this) {
      private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.BLACK; textSize = 48f }
      override fun onDraw(canvas: Canvas) { super.onDraw(canvas); canvas.drawColor(Color.WHITE); canvas.drawText("MAX CANVAS 42", 12f, 72f, paint) }
    }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 120))
    setContentView(layout)
  }
}
