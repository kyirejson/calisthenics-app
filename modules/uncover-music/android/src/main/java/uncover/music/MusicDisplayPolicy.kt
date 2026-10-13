package uncover.music

/** Android 14 adds independent display focus. Earlier versions must not steal the main screen. */
internal object MusicDisplayPolicy {
  const val MIN_API = 34
  const val WIDTH = 720
  const val HEIGHT = 1280
  const val DENSITY = 320
  const val IDLE_MS = 120_000L
  fun requireDisplay(actual: Int, expected: Int) {
    if (expected <= 0 || actual != expected) throw MusicFailure("wrong_display", "音乐界面不在专用虚拟屏幕中，未操作主屏幕。")
  }
  fun requirePoint(x: Float, y: Float) {
    if (!x.isFinite() || !y.isFinite() || x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) throw MusicFailure("invalid_point", "控件不在音乐虚拟屏幕范围内。")
  }
}
