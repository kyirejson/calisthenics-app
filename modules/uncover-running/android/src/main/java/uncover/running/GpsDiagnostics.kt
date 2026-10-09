package uncover.running

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.GnssStatus
import android.location.LocationManager
import android.os.Handler
import android.os.Build
import android.os.SystemClock
import androidx.core.content.ContextCompat
import androidx.core.location.LocationManagerCompat
import org.json.JSONObject

/** Runtime diagnostics only: no coordinates, device identifiers or persisted logs. */
internal object GpsDiagnostics {
  private var listening = false
  private var started = 0L
  private var satellites: Int? = null
  private var used: Int? = null
  private var satelliteAt = 0L
  private var rejection = ""
  private var requestError = ""
  private val providers = mutableSetOf<String>()
  private val providerErrors = mutableMapOf<String, String>()
  @Synchronized fun begin() { listening = false; providers.clear(); providerErrors.clear(); started = SystemClock.elapsedRealtime(); satellites = null; used = null; satelliteAt = 0; rejection = ""; requestError = "" }
  @Synchronized fun subscribed(provider: String) { providers.add(provider); listening = true }
  @Synchronized fun providerError(provider: String, message: String) { providerErrors[provider] = message }
  @Synchronized fun stop() { listening = false }
  @Synchronized fun failed(message: String) { listening = false; requestError = message }
  @Synchronized fun rejected(reason: String) { rejection = reason }
  @Synchronized fun accepted() { rejection = "" }
  @Synchronized fun satellites(status: GnssStatus) {
    satellites = status.satelliteCount
    used = (0 until status.satelliteCount).count { status.usedInFix(it) }
    satelliteAt = SystemClock.elapsedRealtime()
  }
  @Synchronized fun snapshot(context: Context): JSONObject {
    val manager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    val permission = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
    val provider = manager.allProviders.contains(LocationManager.GPS_PROVIDER)
    val enabled = provider && manager.isProviderEnabled(LocationManager.GPS_PROVIDER)
    val now = SystemClock.elapsedRealtime()
    return JSONObject().put("permission", permission).put("providerAvailable", provider).put("enabled", enabled)
      .put("listening", listening).put("waitMs", if (listening) (now - started).coerceAtLeast(0) else 0)
      .put("gpsListening", listening && providers.contains("gps"))
      .put("systemEnabled", LocationManagerCompat.isLocationEnabled(manager))
      .put("auxiliaryProviders", org.json.JSONArray(providers.filter { it != "gps" }))
      .put("providerErrors", JSONObject(providerErrors.toMap()))
      .put("networkAvailable", manager.allProviders.contains("network"))
      .put("networkEnabled", manager.allProviders.contains("network") && manager.isProviderEnabled("network"))
      .put("satellites", satellites ?: JSONObject.NULL).put("usedSatellites", used ?: JSONObject.NULL)
      .put("satelliteAgeMs", if (satelliteAt > 0) now - satelliteAt else JSONObject.NULL)
      .put("rejection", rejection).put("requestError", requestError)
  }
}

/** A stopped request must not deliver queued fixes/status into a newer request. */
internal class GpsSubscription(private val context: Context, private val handler: Handler, private val recording: Boolean, private val onFix: ((android.location.Location, String) -> Unit)? = null) {
  private val manager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
  @Volatile private var active = false
  private val listeners = mutableMapOf<String, GpsListener>()
  private val gnss = object : GnssStatus.Callback() {
    override fun onSatelliteStatusChanged(status: GnssStatus) { if (active) GpsDiagnostics.satellites(status) }
  }
  fun start() {
    if (active) return
    active = true; GpsDiagnostics.begin()
    val failures = mutableListOf<String>()
    val candidates = mutableListOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
    if (Build.VERSION.SDK_INT >= 31) candidates.add(LocationManager.FUSED_PROVIDER)
    for (provider in candidates) {
      val listener = GpsListener({ value ->
        if (active) {
          GpsDiagnostics.providerError(provider, "")
          RunStore.location(value, recording, provider)
          onFix?.invoke(value, provider)
        }
      }, { message -> if (active) {
        if (provider == "gps") {
          GpsDiagnostics.providerError(provider, message)
        } else GpsDiagnostics.providerError(provider, if (message.isEmpty()) "" else "辅助定位服务状态已变化，请检查系统定位设置。")
      } })
      try {
        if (!manager.allProviders.contains(provider) || !manager.isProviderEnabled(provider)) continue
        manager.requestLocationUpdates(provider, if (provider == "gps") 1000L else 3000L, 0f, listener, handler.looper)
        listeners[provider] = listener; GpsDiagnostics.subscribed(provider)
        try { manager.getLastKnownLocation(provider)?.let { RunStore.mapLocation(it, provider, true) } } catch (_: Exception) {}
      } catch (exception: Exception) {
        try { manager.removeUpdates(listener) } catch (_: Exception) {}
        val message = when (exception) {
          is SecurityException -> "系统拒绝 $provider 定位请求，请检查位置权限。"
          is IllegalArgumentException -> "系统未提供可用的 $provider 定位服务。"
          else -> "$provider 定位请求失败（${exception.javaClass.simpleName}）。"
        }
        GpsDiagnostics.providerError(provider, message)
        failures.add(message)
      }
    }
    if (listeners.isEmpty()) {
      stop()
      val message = if (failures.isNotEmpty()) failures.joinToString(" ") else "系统没有已开启的位置提供者（GPS／网络／系统融合）。"
      GpsDiagnostics.failed(message)
      throw IllegalStateException(message)
    }
    if (listeners.containsKey("gps")) try { manager.registerGnssStatusCallback(gnss, handler) } catch (_: Exception) {}
  }
  fun stop() {
    if (!active) return
    active = false
    listeners.values.forEach { try { manager.removeUpdates(it) } catch (_: Exception) {} }; listeners.clear()
    try { manager.unregisterGnssStatusCallback(gnss) } catch (_: Exception) {}
    GpsDiagnostics.stop()
  }
}
