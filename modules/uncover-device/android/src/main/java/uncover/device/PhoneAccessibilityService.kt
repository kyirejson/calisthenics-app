package uncover.device

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.view.accessibility.AccessibilityEvent

/** Shared service implementation. The existing Android component remains the sole binding entry. */
open class PhoneAccessibilityService : AccessibilityService() {
  companion object { @Volatile var instance: PhoneAccessibilityService? = null; private set }
  val phoneUi by lazy { PhoneUi(this) }
  protected open fun legacyPackages(): List<String> = emptyList()
  fun refreshAccess() {
    phoneUi.clear()
    serviceInfo = serviceInfo.apply {
      packageNames = if (PhoneLedger.enabled(this@PhoneAccessibilityService)) null else legacyPackages().ifEmpty { listOf(packageName) }.toTypedArray()
      flags = flags or AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS or AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS or AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS
    }
    UncoverDeviceModule.changed()
  }
  override fun onServiceConnected() { instance = this; refreshAccess() }
  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    val name = event?.packageName?.toString() ?: return
    if (!PhoneLedger.enabled(this) && name !in legacyPackages()) return
    if (event.eventType in setOf(AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED, AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED,
        AccessibilityEvent.TYPE_WINDOWS_CHANGED, AccessibilityEvent.TYPE_VIEW_SCROLLED, AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED)) phoneUi.changed(name)
  }
  override fun onInterrupt() { phoneUi.clear(); PhoneExecutionService.cancelActive() }
  override fun onDestroy() {
    phoneUi.clear(); PhoneExecutionService.cancelActive()
    if (instance === this) instance = null
    UncoverDeviceModule.changed(); super.onDestroy()
  }
}
