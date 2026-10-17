package uncover.device

import android.app.KeyguardManager
import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import android.provider.Settings

object PhoneAccess {
  fun component(context: Context): ComponentName {
    val services = context.packageManager.getPackageInfo(context.packageName, PackageManager.GET_SERVICES or PackageManager.GET_META_DATA).services.orEmpty()
    val entry = services.singleOrNull { it.metaData?.getBoolean("uncover.phone_control", false) == true }
      ?: throw PhoneFailure("service_missing", "安装包缺少统一手机界面控制入口，请安装新版 APK。")
    return ComponentName(context.packageName, entry.name)
  }
  fun granted(context: Context): Boolean = runCatching {
    val selected = component(context)
    Settings.Secure.getString(context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES).orEmpty().split(':')
      .any { ComponentName.unflattenFromString(it) == selected }
  }.getOrDefault(false)
  fun requireConsent(context: Context) {
    if (!PhoneLedger.enabled(context)) throw PhoneFailure("phone_consent_required", "请先在 MAX 服务设置中主动开启通用手机控制；音乐授权不包含其他应用。")
  }
  fun requireUnlocked(context: Context) {
    if ((context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager).isKeyguardLocked)
      throw PhoneFailure("screen_locked", "手机已锁定，请本人解锁后继续；未点击锁屏或身份验证界面。")
  }
  fun requireUi(context: Context): PhoneAccessibilityService {
    requireConsent(context); requireUnlocked(context)
    return PhoneAccessibilityService.instance ?: if (granted(context)) throw PhoneFailure("accessibility_disconnected", "系统无障碍已授权，但服务连接已断开；请等待系统重连。若持续断开，只需重启该服务，不必重新授予所有权限。")
      else throw PhoneFailure("accessibility_required", "系统无障碍尚未授权，请在系统设置开启 MAX 手机与音乐控制。")
  }
}
