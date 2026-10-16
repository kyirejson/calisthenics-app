package uncover.voice

import org.junit.Assert.*
import org.junit.Test

class VoiceSpeechChunksTest {
  @Test fun keepsEntireLongResponse() {
    val text = "完整模型回答".repeat(1000)
    val blocks = VoiceSpeechChunks.split(text, 3000)
    assertEquals(text, blocks.joinToString("") { it.text }); assertTrue(blocks.all { it.text.length <= 3000 })
  }
  @Test fun preservesEmojiAcrossBoundaries() {
    val text = "中😀文🎵好"
    val blocks = VoiceSpeechChunks.split(text, 2)
    assertEquals(text, blocks.joinToString("") { text.substring(it.start, it.end) })
    assertTrue(blocks.all { !it.text.first().isLowSurrogate() && !it.text.last().isHighSurrogate() })
    assertTrue(blocks.all { it.start == 0 || !text[it.start].isLowSurrogate() })
  }
  @Test fun emptyResponseHasNoSpeechQueue() { assertTrue(VoiceSpeechChunks.split("", 3000).isEmpty()) }
  @Test fun standaloneNewlinesNeverReachTheSynthesizer() {
    val text = "我在。\n\n可以开始训练。\n"
    val blocks = VoiceSpeechChunks.split(text, 40)
    assertEquals(listOf("我在。", "可以开始训练。"), blocks.map { it.text })
    assertEquals(text, blocks.joinToString("") { text.substring(it.start, it.end) })
    assertEquals(text.length, blocks.last().end)
  }
  @Test fun normalizesOnlySpokenMarkdownWithoutChangingSourceRanges() {
    val text = "\n## **训练建议**\n\n1. 今天跑了 **3 公里**。\n[动作指导](https://example.com)\n**"
    val blocks = VoiceSpeechChunks.split(text, 100)
    assertEquals(listOf("训练建议", "1. 今天跑了 3 公里。", "动作指导"), blocks.map { it.text })
    assertEquals(text, blocks.joinToString("") { text.substring(it.start, it.end) })
  }
  @Test fun formattingAndEmojiOnlyRepliesDoNotRequestEmptyAudio() {
    for (text in listOf(" \r\n\t", "**\n__\n```\n", "😊\n🎵", "。？！")) assertTrue(VoiceSpeechChunks.split(text, 40).isEmpty())
  }
  @Test fun keepsChineseEnglishNumbersAndNonBmpLetters() {
    val text = "BLACK：第 2 组，20 次；RIR 2。\n𠮷野家，Ⅳ级，②次。"
    val blocks = VoiceSpeechChunks.split(text, 40)
    assertEquals(text, blocks.joinToString("") { text.substring(it.start, it.end) })
    assertEquals(listOf("BLACK：第 2 组，20 次；", "RIR 2。", "𠮷野家，Ⅳ级，②次。"), blocks.map { it.text })
  }
  @Test fun malformedMarkupCannotRemoveTheAnswer() {
    assertEquals("未闭合的文字", VoiceSpeechChunks.split("**未闭合的文字", 40).single().text)
  }
}
