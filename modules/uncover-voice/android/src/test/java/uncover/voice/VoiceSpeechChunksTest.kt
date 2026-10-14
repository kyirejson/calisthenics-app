package uncover.voice

import org.junit.Assert.*
import org.junit.Test

class VoiceSpeechChunksTest {
  @Test fun keepsEntireLongResponse() {
    val text = "完整模型回答".repeat(1000)
    val blocks = VoiceSpeechChunks.split(text, 3000)
    assertEquals(text, blocks.joinToString("")); assertTrue(blocks.all { it.length <= 3000 })
  }
  @Test fun preservesEmojiAcrossBoundaries() {
    val text = "中😀文🎵好"
    val blocks = VoiceSpeechChunks.split(text, 2)
    assertEquals(text, blocks.joinToString(""))
    assertTrue(blocks.all { !it.first().isLowSurrogate() && !it.last().isHighSurrogate() })
  }
  @Test fun emptyResponseHasNoSpeechQueue() { assertTrue(VoiceSpeechChunks.split("", 3000).isEmpty()) }
}
