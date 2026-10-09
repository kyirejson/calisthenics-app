package uncover.running

import android.location.Location
import android.location.LocationListener
import android.os.Bundle

/** Override all callbacks explicitly: older Android does not supply default methods. */
internal class GpsListener(private val fix: (Location) -> Unit, private val problem: (String) -> Unit) : LocationListener {
  override fun onLocationChanged(location: Location) { try { fix(location) } catch (_: Exception) { problem("定位记录异常，请暂停后重试。") } }
  override fun onProviderDisabled(provider: String) { problem("定位服务 $provider 已关闭，请检查系统定位设置。") }
  override fun onProviderEnabled(provider: String) { problem("") }
  @Deprecated("Deprecated in Android") override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
}
