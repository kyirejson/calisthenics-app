package uncover.music

import android.service.notification.NotificationListenerService

// Intentionally does not read, persist or forward notification content.
class MusicNotificationListener : NotificationListenerService()
