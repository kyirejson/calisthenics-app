package uncover.running

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.Handler
import android.os.SystemClock
import androidx.core.content.ContextCompat

/** Both hardware variants are supported; a missing sensor never invents steps. */
internal class RunSteps(private val context: Context, private val handler: Handler, private val count: (Int) -> Unit) : SensorEventListener {
  private val manager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
  private var sensor: Sensor? = null
  private val evidence = StepEvidence()
  companion object {
    fun available(context: Context): Boolean {
      return try {
        val manager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
        manager.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR) != null || manager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null
      } catch (_: Exception) { false }
    }
  }
  fun start(): String {
    stop()
    if (Build.VERSION.SDK_INT >= 29 && ContextCompat.checkSelfPermission(context, Manifest.permission.ACTIVITY_RECOGNITION) != PackageManager.PERMISSION_GRANTED)
      return "未授权身体活动权限；室内跑仍可计时，距离可手动填写。"
    sensor = manager.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR) ?: manager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
    val selected = sensor ?: return "手机未提供计步传感器；室内跑仍可计时，距离可手动填写。"
    evidence.reset(SystemClock.elapsedRealtimeNanos())
    return try { if (manager.registerListener(this, selected, SensorManager.SENSOR_DELAY_NORMAL, handler)) "" else "计步传感器无法启动，距离可手动填写。" }
    catch (_: Exception) { stop(); "系统拒绝计步请求，距离可手动填写。" }
  }
  fun stop() { try { manager.unregisterListener(this) } catch (_: Exception) { RunStore.stepIssue = "系统计步服务关闭异常，计时不受影响。" } finally { sensor = null; evidence.reset(0) } }
  override fun onSensorChanged(event: SensorEvent) {
    if (sensor == null || event.values.isEmpty()) return
    val steps = evidence.accept(event.sensor.type == Sensor.TYPE_STEP_COUNTER, event.values[0], event.timestamp, SystemClock.elapsedRealtimeNanos())
    if (steps > 0) try { count(steps) } catch (_: Exception) { RunStore.stepIssue = "计步记录失败，请暂停后重试。" }
  }
  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
}
