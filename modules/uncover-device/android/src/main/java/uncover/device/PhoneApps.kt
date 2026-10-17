package uncover.device

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.ResolveInfo
import android.net.Uri
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale

/** Discover launchable apps dynamically. The model, not an app-name switch, selects the destination. */
object PhoneApps {
  fun version(context: Context, packageName: String): JSONObject {
    return try {
      @Suppress("DEPRECATION")
      val info = context.packageManager.getPackageInfo(packageName, 0)
      @Suppress("DEPRECATION")
      val code = if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else info.versionCode.toLong()
      JSONObject().put("available", true).put("versionCode", code.toString())
        .put("versionName", info.versionName ?: JSONObject.NULL).put("lastUpdateTime", info.lastUpdateTime)
    } catch (_: android.content.pm.PackageManager.NameNotFoundException) {
      JSONObject().put("available", false).put("code", "package_version_unavailable")
    } catch (_: SecurityException) {
      JSONObject().put("available", false).put("code", "package_version_not_visible")
    }
  }
  private fun launchers(context: Context): List<ResolveInfo> = context.packageManager.queryIntentActivities(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER), 0)
    .filter { it.activityInfo.enabled && it.activityInfo.applicationInfo.enabled && (it.activityInfo.exported || it.activityInfo.packageName == context.packageName) }
  fun find(context: Context, query: String, offset: Int): JSONObject {
    PhoneAccess.requireConsent(context); require(offset >= 0)
    val manager = context.packageManager; val term = query.trim().lowercase(Locale.ROOT)
    val apps = launchers(context).groupBy { it.activityInfo.packageName }.map { (packageName, activities) ->
      val label = manager.getApplicationLabel(activities.first().activityInfo.applicationInfo).toString()
      val entries = JSONArray(); activities.forEach { entries.put(JSONObject().put("activityName", it.activityInfo.name).put("label", it.loadLabel(manager).toString())) }
      JSONObject().put("packageName", packageName).put("label", label).put("activities", entries)
    }.filter { term.isEmpty() || it.toString().lowercase(Locale.ROOT).contains(term) }.sortedBy { it.getString("label") }
    val end = minOf(apps.size.toLong(), offset.toLong() + PhonePolicy.PAGE_SIZE).toInt(); val page = JSONArray()
    for (index in offset until end) page.put(apps[index].put("appVersion", version(context, apps[index].getString("packageName"))))
    return JSONObject().put("ok", true).put("apps", page).put("total", apps.size).put("nextOffset", if (end < apps.size) end else JSONObject.NULL)
      .put("source", "android_package_manager").put("externalData", true)
  }
  fun prepare(context: Context, command: JSONObject): Intent {
    val name = PhonePolicy.packageName(command.getString("packageName")); val manager = context.packageManager
    val candidates = launchers(context).filter { it.activityInfo.packageName == name }
    if (candidates.isEmpty()) throw PhoneFailure("app_not_launchable", "未找到该应用的可启动入口，请重新查询；它可能未安装、已停用、没有界面或不在当前用户空间。")
    val uri = command.optString("uri").takeIf { it.isNotBlank() }
    val intent = if (uri != null) Intent(Intent.ACTION_VIEW, Uri.parse(PhonePolicy.launchUri(uri))).setPackage(name).apply {
      if (data?.scheme in setOf("http", "https")) addCategory(Intent.CATEGORY_BROWSABLE)
    }
    else {
      val activityName = command.optString("activityName").takeIf { it.isNotBlank() }
      val selected = if (activityName == null) candidates.first() else candidates.firstOrNull { it.activityInfo.name == activityName }
        ?: throw PhoneFailure("unknown_activity", "该启动入口不在真实应用列表中，请重新查询。")
      Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER).setComponent(ComponentName(name, selected.activityInfo.name)).setPackage(name)
    }
    val resolved = intent.resolveActivityInfo(manager, 0) ?: throw PhoneFailure("unsupported_link", "目标应用没有接受此公开链接的入口；可直接打开后从真实界面操作。")
    if (resolved.packageName != name || !resolved.exported && name != context.packageName) throw PhoneFailure("invalid_target", "链接没有解析到选定应用的公开入口。")
    return intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
  }
}
