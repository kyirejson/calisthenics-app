package uncover.device

import android.os.Bundle
import android.test.InstrumentationTestCase
import org.json.JSONObject
import java.time.Instant
import java.time.ZoneOffset
import java.util.UUID

/** An owned emulator only. Host kills this test process after scheduling to verify receiver delivery. */
@Suppress("DEPRECATION")
class ReminderDeliveryTest : InstrumentationTestCase() {
  fun testEditsAndCancellationCannotBeUndoneByRetryingAnOlderOperation() {
    val context = instrumentation.targetContext; PhoneReminders.clear(context)
    val request = "fixture-" + UUID.randomUUID()
    val input = JSONObject().put("operationKey", "create").put("title", "original fixture")
      .put("at", Instant.ofEpochMilli(System.currentTimeMillis() + 60000).atOffset(ZoneOffset.UTC).toString())
    val id = PhoneReminders.write(context, request, input).getJSONObject("reminder").getString("id")
    val edited = JSONObject(input.toString()).put("id", id).put("operationKey", "edit").put("title", "edited fixture")
    PhoneReminders.write(context, request, edited)
    val retried = PhoneReminders.write(context, request, input)
    assertEquals("edited fixture", retried.getJSONObject("reminder").getString("title"))
    PhoneReminders.cancel(context, id)
    assertTrue(PhoneReminders.write(context, request, input).getBoolean("cancelled"))
    assertEquals(0, PhoneReminders.list(context).getJSONArray("reminders").length())
  }
  fun testScheduleForDeliveryAfterTheAppProcessHasExited() {
    val context = instrumentation.targetContext
    assertTrue("Enable notification and exact alarms on the owned emulator", PhoneReminders.status(context).getBoolean("notificationsGranted"))
    assertTrue(PhoneReminders.status(context).getBoolean("exactAlarmsGranted"))
    PhoneReminders.clear(context)
    val request = "fixture-" + UUID.randomUUID()
    val input = JSONObject().put("operationKey", "once").put("title", "MAX_REMINDER_PROCESS_EXIT_FIXTURE")
      .put("at", Instant.ofEpochMilli(System.currentTimeMillis() + 25000).atOffset(ZoneOffset.UTC).toString())
    val result = PhoneReminders.write(context, request, input)
    assertTrue(result.toString(), result.getBoolean("ok"))
    assertTrue(PhoneReminders.write(context, request, input).getBoolean("replayed"))
    assertEquals(1, PhoneReminders.list(context).getJSONArray("reminders").length())
    instrumentation.sendStatus(2, Bundle().apply { putString("reminderId", result.getJSONObject("reminder").getString("id")); putLong("triggerAt", result.getJSONObject("reminder").getLong("nextAt")) })
  }
}
