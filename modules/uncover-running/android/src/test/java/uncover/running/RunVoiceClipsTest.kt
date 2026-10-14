package uncover.running

import org.junit.Assert.*
import org.junit.Test

class RunVoiceClipsTest {
  @Test fun grammarAndChineseNumbers() {
    assertEquals(listOf("distance", "n1", "km_time", "n6", "minute", "n20", "seconds"), RunVoiceClips.forText("您已跑了1公里，用时6分20秒。"))
    assertEquals(listOf("estimated", "n2", "km_time", "n12", "minutes"), RunVoiceClips.forText("计步估算，您已跑了2公里，用时12分钟。"))
    assertEquals("partial", RunVoiceClips.forText("已记录定位路段3公里，用时18分1秒。").first())
    assertEquals(listOf("n1", "hundred", "n0", "n1"), RunVoiceClips.number(101))
    assertEquals(listOf("n1", "thousand", "n0", "n20"), RunVoiceClips.number(1020))
    assertEquals(listOf("n1", "ten_thousand", "n0", "n1"), RunVoiceClips.number(10001))
    for (text in listOf("开始跑步", "继续跑步", "跑步已暂停", "已自动暂停，重新跑动后继续", "已自动继续跑步")) assertEquals(1, RunVoiceClips.forText(text).size)
  }
  @Test fun actualStylesOnly() {
    assertEquals("female", RunVoiceClips.cleanStyle("female")); assertEquals("male", RunVoiceClips.cleanStyle("male"))
    assertThrows(IllegalArgumentException::class.java) { RunVoiceClips.cleanStyle("robot") }
    assertThrows(IllegalArgumentException::class.java) { RunVoiceClips.number(-1) }
  }
}
