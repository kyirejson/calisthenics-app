package uncover.running

import android.content.Context
import android.location.Location
import android.os.SystemClock
import android.util.AtomicFile
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/** Native owns the stopwatch and raw position journal; neither depends on a GPS fix. */
internal object RunStore {
  private var loaded = false
  private var storageCorrupt = false
  private var journal: JSONObject? = null
  private var preview: JSONObject? = null
  private var mapPosition: JSONObject? = null
  private var activeSince = 0L
  private var elapsedBase = 0L
  private var segment = 0
  private var lastFixNanos = 0L
  private var metrics = RunDistance()
  private val stepWindow = mutableListOf<Pair<Long, Int>>()
  private var lastStepAt = 0L
  @Volatile var stepIssue = ""
  @Volatile var speechIssue = ""
  var error: String = ""; private set

  private fun file(context: Context) = AtomicFile(File(context.filesDir, "running-journal-v2.json"))

  @Synchronized fun load(context: Context) {
    if (loaded) return
    val target = file(context)
    if (target.baseFile.exists()) {
      try {
        val data = JSONObject(target.openRead().bufferedReader().use { it.readText() })
        require(data.getInt("version") == 2 && data.getString("id").isNotBlank())
        require(data.getString("phase") in listOf("running", "paused", "finished"))
        require(data.getLong("startedAt") > 0 && data.getLong("elapsedMs") >= 0)
        require(data.getJSONArray("samples").length() >= 0)
        require(data.optString("mode", "outdoor") in listOf("outdoor", "indoor"))
        if (data.has("manualDistanceKm")) require(data.getDouble("manualDistanceKm").isFinite() && data.getDouble("manualDistanceKm") in 0.0..1000.0)
        if (data.has("stepCount")) require(data.getDouble("stepCount") >= 0 && data.getDouble("stepCount") <= Int.MAX_VALUE && data.getDouble("stepCount") == data.getInt("stepCount").toDouble())
        data.optJSONObject("options")?.let { RunPreferences.clean(it) }
        elapsedBase = data.getLong("elapsedMs").coerceAtLeast(0)
        segment = data.optInt("segment") + 1
        if (data.getString("phase") == "running" || data.optBoolean("autoPaused")) { data.put("phase", "paused"); data.put("interrupted", true) }
        data.put("autoPaused", false)
        if (data.optInt("stepCount") > 0) data.put("stepPartial", true)
        metrics = RunDistance()
        val points = data.getJSONArray("samples")
        for (i in 0 until points.length()) metrics.add(metricPoint(points.getJSONObject(i)))
        journal = data
      } catch (_: Exception) { storageCorrupt = true; error = "本机跑步草稿无法读取，未覆盖原文件。" }
    }
    loaded = true
  }

  @Synchronized fun elapsed(): Long = elapsedBase + if (activeSince > 0) (SystemClock.elapsedRealtime() - activeSince).coerceAtLeast(0) else 0
  @Synchronized fun phase(): String = journal?.optString("phase") ?: "idle"
  @Synchronized fun mode(): String = journal?.optString("mode", "outdoor") ?: "outdoor"
  @Synchronized fun autoPaused(): Boolean = journal?.optBoolean("autoPaused") ?: false
  @Synchronized fun options(context: Context): JSONObject = journal?.optJSONObject("options") ?: RunPreferences.read(context)
  @Synchronized fun liveMetrics(): Pair<Double, Long> = Pair(metrics.metres, metrics.trackedMs)
  @Synchronized fun spokenKm(): Int = journal?.optInt("spokenKm") ?: 0
  @Synchronized fun markSpoken(km: Int) { journal?.put("spokenKm", km) }
  @Synchronized fun setVoice(context: Context, enabled: Boolean) {
    load(context)
    check(!storageCorrupt) { "本机跑步草稿无法读取，未覆盖原文件。" }
    val previousPreferences = RunPreferences.read(context)
    val previousOptions = journal?.optJSONObject("options")
    val previousSpoken = spokenKm()
    val nextPreferences = JSONObject(previousPreferences.toString()).put("voice", enabled)
    RunPreferences.store(context, nextPreferences)
    journal?.let { data ->
      val nextOptions = JSONObject((previousOptions ?: previousPreferences).toString()).put("voice", enabled)
      data.put("options", nextOptions)
      if (enabled && !(previousOptions ?: previousPreferences).optBoolean("voice")) {
        val distance = if (mode() == "indoor") stepDistance() else metrics.metres
        markSpoken(maxOf(previousSpoken, ((distance ?: 0.0) / 1000).toInt()))
      }
      try { persist(context) } catch (failure: Exception) {
        if (previousOptions == null) data.remove("options") else data.put("options", previousOptions)
        markSpoken(previousSpoken)
        RunPreferences.store(context, previousPreferences)
        throw failure
      }
    }
    speechIssue = ""
  }
  @Synchronized fun steps(): Int = journal?.optInt("stepCount") ?: 0
  @Synchronized fun stepPartial(): Boolean = journal?.optBoolean("stepPartial") ?: false
  @Synchronized fun stepDistance(): Double? = journal?.let { data -> data.optJSONObject("options")?.let { options ->
    if (data.optInt("stepCount") > 0 && options.has("stepLengthM") && !options.isNull("stepLengthM")) data.optInt("stepCount") * options.getDouble("stepLengthM") else null
  } }
  @Synchronized fun addSteps(count: Int) {
    if (phase() == "running" && mode() == "indoor" && count > 0) {
      check(steps() <= Int.MAX_VALUE - count) { "计步记录超出范围。" }
      journal!!.put("stepCount", steps() + count)
      lastStepAt = SystemClock.elapsedRealtime()
      stepWindow.add(Pair(elapsed(), steps()))
      stepWindow.removeAll { elapsed() - it.first > 10000 }
    }
  }
  @Synchronized fun problem(message: String) { if (!storageCorrupt) error = message }

  @Synchronized fun begin(context: Context, id: String, mode: String) {
    load(context)
    check(journal == null) { "请先处理上一次跑步记录。" }
    check(!storageCorrupt) { "本机跑步草稿无法读取，未覆盖原文件。" }
    require(id.isNotBlank() && mode in listOf("outdoor", "indoor")) { "跑步参数无效。" }
    error = ""
    journal = JSONObject().put("version", 2).put("id", id).put("mode", mode).put("phase", "running").put("startedAt", System.currentTimeMillis()).put("samples", JSONArray()).put("interrupted", false)
      .put("options", RunPreferences.read(context)).put("stepCount", 0).put("autoPaused", false)
    metrics = RunDistance(); stepWindow.clear(); lastStepAt = 0; stepIssue = ""; speechIssue = ""
    elapsedBase = 0; segment = 0; lastFixNanos = 0; activeSince = SystemClock.elapsedRealtime()
    // Seed only a fresh live fix; cached coordinates never create an artificial start.
    if (mode == "outdoor") preview?.let { point ->
      val age = SystemClock.elapsedRealtimeNanos() - point.getLong("monotonicNanos")
      if (age in 0..15_000_000_000L && point.getDouble("accuracy") <= 35) append(point)
    }
    persist(context)
  }

  @Synchronized fun location(value: Location, recording: Boolean, provider: String) {
    if (!value.latitude.isFinite() || !value.longitude.isFinite() || !value.hasAccuracy() || !value.accuracy.isFinite() || value.accuracy < 0) { GpsDiagnostics.rejected("invalid"); return }
    if (value.latitude !in -90.0..90.0 || value.longitude !in -180.0..180.0) { GpsDiagnostics.rejected("invalid"); return }
    val age = SystemClock.elapsedRealtimeNanos() - value.elapsedRealtimeNanos
    if (age < 0 || age > 15_000_000_000L) { GpsDiagnostics.rejected("stale"); return }
    GpsDiagnostics.accepted()
    mapLocation(value, provider)
    if (provider == "network") return // Coarse map positioning is not continuous running-distance evidence.
    val previous = preview
    if (previous != null) {
      if (value.elapsedRealtimeNanos <= previous.getLong("monotonicNanos")) return
      val previousAge = SystemClock.elapsedRealtimeNanos() - previous.getLong("monotonicNanos")
      if (previousAge < 3_000_000_000L && previous.getDouble("accuracy") <= 35 &&
        (value.accuracy > previous.getDouble("accuracy") || provider != previous.optString("provider") && value.accuracy >= previous.getDouble("accuracy"))) return
    }
    val point = JSONObject().put("latitude", value.latitude).put("longitude", value.longitude).put("accuracy", value.accuracy.toDouble())
      .put("timestamp", value.time).put("monotonicNanos", value.elapsedRealtimeNanos).put("provider", provider).put("cached", false)
    preview = point
    if (recording && mode() == "outdoor" && phase() == "running" && value.elapsedRealtimeNanos > lastFixNanos) append(point)
  }

  /** Cached and coarse coordinates may move the map, never enter the route journal here. */
  @Synchronized fun mapLocation(value: Location, provider: String, cached: Boolean = false) {
    if (!value.latitude.isFinite() || !value.longitude.isFinite() || value.latitude !in -90.0..90.0 || value.longitude !in -180.0..180.0) return
    if (!value.hasAccuracy() || !value.accuracy.isFinite() || value.accuracy < 0) return
    val age = SystemClock.elapsedRealtimeNanos() - value.elapsedRealtimeNanos
    if (age < 0 || age > (if (cached) 120_000_000_000L else 60_000_000_000L)) return
    val previous = mapPosition
    if (previous != null) {
      val previousAge = SystemClock.elapsedRealtimeNanos() - previous.getLong("monotonicNanos")
      if (value.elapsedRealtimeNanos <= previous.getLong("monotonicNanos")) return
      if (previousAge < 15_000_000_000L && !previous.optBoolean("cached") && (cached || value.accuracy > previous.getDouble("accuracy") * 2)) return
    }
    mapPosition = JSONObject().put("latitude", value.latitude).put("longitude", value.longitude).put("accuracy", value.accuracy.toDouble())
      .put("timestamp", value.time).put("monotonicNanos", value.elapsedRealtimeNanos).put("provider", provider).put("cached", cached)
  }

  private fun append(point: JSONObject) {
    val copy = JSONObject(point.toString()).put("elapsedMs", elapsed()).put("segment", segment)
    journal!!.getJSONArray("samples").put(copy)
    metrics.add(metricPoint(copy))
    lastFixNanos = point.getLong("monotonicNanos")
  }

  private fun metricPoint(p: JSONObject) = RunDistance.Point(p.getDouble("latitude"), p.getDouble("longitude"), p.getDouble("accuracy"), p.optLong("monotonicNanos", p.getLong("timestamp") * 1000000), p.getLong("elapsedMs"), p.getInt("segment"), p.optString("provider", "gps"))
  @Synchronized fun pause(context: Context, interrupted: Boolean = false, automatic: Boolean = false) {
    if (phase() != "running") { if (!automatic && autoPaused()) { journal!!.put("autoPaused", false); persist(context) }; return }
    elapsedBase = elapsed(); activeSince = 0; segment++
    journal!!.put("phase", "paused").put("interrupted", interrupted).put("autoPaused", automatic)
    persist(context)
  }
  @Synchronized fun resume(context: Context) {
    check(phase() == "paused") { "跑步状态已变化，请刷新。" }
    activeSince = SystemClock.elapsedRealtime(); lastFixNanos = 0
    stepWindow.clear(); lastStepAt = 0
    journal!!.put("phase", "running").put("interrupted", false).put("autoPaused", false)
    error = ""; persist(context)
  }
  @Synchronized fun finish(context: Context, distance: Double = -1.0) {
    require(distance == -1.0 || distance.isFinite() && distance in 0.0..1000.0) { "请输入 0–1000 公里之间的有效距离。" }
    if (distance >= 0) journal?.put("manualDistanceKm", distance)
    if (phase() == "finished") { if (distance >= 0) persist(context); return }
    check(journal != null) { "没有正在记录的跑步。" }
    if (phase() == "running") { elapsedBase = elapsed(); activeSince = 0 }
    journal!!.put("phase", "finished").put("completedAt", System.currentTimeMillis()).put("autoPaused", false)
    persist(context)
  }
  @Synchronized fun persist(context: Context) {
    val data = journal ?: return
    data.put("elapsedMs", elapsed()).put("segment", segment)
    val target = file(context)
    val stream = target.startWrite()
    try { stream.write(data.toString().toByteArray(Charsets.UTF_8)); target.finishWrite(stream) }
    catch (exception: Exception) { target.failWrite(stream); error = "跑步草稿保存失败，请检查可用存储空间。"; throw exception }
  }
  @Synchronized fun acknowledge(context: Context, id: String) {
    if (journal?.optString("id") != id) return
    check(phase() == "finished") { "记录尚未结束。" }
    file(context).delete(); journal = null; elapsedBase = 0; activeSince = 0; error = ""; stepWindow.clear(); lastStepAt = 0; stepIssue = ""; speechIssue = ""
  }
  @Synchronized fun snapshot(context: Context, after: Int): String {
    load(context)
    val source = journal
    val latest = preview?.let { JSONObject(it.toString()).put("ageMs", (SystemClock.elapsedRealtimeNanos() - it.getLong("monotonicNanos")) / 1_000_000) }
    val auxiliary = mapPosition?.let { JSONObject(it.toString()).put("ageMs", (SystemClock.elapsedRealtimeNanos() - it.getLong("monotonicNanos")) / 1_000_000) }
    val mapFix = when {
      latest != null && latest.getLong("ageMs") <= 15000 && latest.getDouble("accuracy") <= 35 -> latest
      auxiliary != null && !auxiliary.optBoolean("cached") && auxiliary.getLong("ageMs") <= 60000 &&
        (latest == null || latest.getLong("ageMs") > 15000 || auxiliary.getDouble("accuracy") < latest.getDouble("accuracy")) -> auxiliary
      latest != null && latest.getLong("ageMs") <= 60000 -> latest
      auxiliary != null && auxiliary.getLong("ageMs") <= (if (auxiliary.optBoolean("cached")) 120000 else 60000) -> auxiliary
      else -> null
    }
    val data = JSONObject().put("phase", phase()).put("mode", mode()).put("elapsedMs", elapsed()).put("error", error).put("preview", latest ?: JSONObject.NULL)
      .put("options", options(context)).put("stepAvailable", RunSteps.available(context)).put("stepCount", steps()).put("autoPaused", autoPaused())
      .put("featureIssue", listOf(stepIssue, speechIssue).filter { it.isNotEmpty() }.joinToString(" "))
      .put("mapPosition", mapFix ?: JSONObject.NULL)
      .put("location", GpsDiagnostics.snapshot(context))
    if (source != null) {
      val points = source.getJSONArray("samples"); val delta = JSONArray()
      for (i in after.coerceIn(0, points.length()) until points.length()) delta.put(points.getJSONObject(i))
      data.put("id", source.getString("id")).put("startedAt", source.getLong("startedAt"))
        .put("completedAt", source.optLong("completedAt")).put("interrupted", source.optBoolean("interrupted"))
        .put("samples", delta).put("sampleCount", points.length())
      if (source.has("manualDistanceKm")) data.put("manualDistanceKm", source.getDouble("manualDistanceKm"))
      stepDistance()?.let { data.put("stepDistanceM", it) }
      data.put("stepPartial", source.optBoolean("stepPartial"))
      val firstStep = stepWindow.firstOrNull()
      val length = source.optJSONObject("options")?.optDouble("stepLengthM", Double.NaN) ?: Double.NaN
      if (phase() == "running" && firstStep != null && length.isFinite() && SystemClock.elapsedRealtime() - lastStepAt <= 3000 && elapsed() - firstStep.first >= 5000 && steps() > firstStep.second) {
        data.put("stepCurrentPace", (elapsed() - firstStep.first) / ((steps() - firstStep.second) * length))
      }
    }
    return data.toString()
  }
  @Synchronized fun clear(context: Context) { file(context).delete(); journal = null; preview = null; mapPosition = null; metrics = RunDistance(); stepWindow.clear(); lastStepAt = 0; elapsedBase = 0; activeSince = 0; loaded = true; storageCorrupt = false; error = ""; stepIssue = ""; speechIssue = ""; context.getSharedPreferences("running-options-v1", Context.MODE_PRIVATE).edit().clear().commit() }
}
