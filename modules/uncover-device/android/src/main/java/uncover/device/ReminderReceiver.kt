package uncover.device

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class ReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == "uncover.reminder.FIRE") intent.data?.lastPathSegment?.let { id -> runCatching { PhoneReminders.fire(context, id) }.onFailure { PhoneReminders.recordFailure(context, it) } }
  }
}
class ReminderRestoreReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action in setOf(Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED, Intent.ACTION_TIME_CHANGED, Intent.ACTION_TIMEZONE_CHANGED,
        "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED")) runCatching { PhoneReminders.restore(context) }.onFailure { PhoneReminders.recordFailure(context, it) }
  }
}
