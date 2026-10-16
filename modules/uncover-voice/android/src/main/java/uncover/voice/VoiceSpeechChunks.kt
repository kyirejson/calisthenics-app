package uncover.voice

internal data class VoiceSpeechChunk(val text: String, val start: Int, val end: Int)

/** Only the spoken rendering is normalized. Offsets always refer to the unmodified model response. */
internal object VoiceSpeechChunks {
  private val links = Regex("""!?\[([^\]\r\n]+)]\([^\r\n)]*\)""")
  private val fences = Regex("""(?m)^[ \t]*(?:`{3,}|~{3,})[^\r\n]*$""")
  private val headings = Regex("""(?m)^[ \t]{0,3}#{1,6}[ \t]+""")
  private val whitespace = Regex("""\s+""")

  private fun spoken(text: String): String = headings.replace(fences.replace(links.replace(text, "$1"), " "), "")
    .replace("**", "").replace("__", "").replace("~~", "").replace("`", "")
    .let { whitespace.replace(it, " ").trim() }

  private fun hasPronunciation(text: String): Boolean {
    var index = 0
    while (index < text.length) {
      val point = text.codePointAt(index)
      val type = Character.getType(point)
      if (Character.isLetterOrDigit(point) || type == Character.LETTER_NUMBER.toInt() || type == Character.OTHER_NUMBER.toInt()) return true
      index += Character.charCount(point)
    }
    return false
  }

  fun split(text: String, maximum: Int): List<VoiceSpeechChunk> {
    require(maximum >= 2)
    val blocks = mutableListOf<VoiceSpeechChunk>()
    var cursor = 0; var represented = 0
    while (cursor < text.length) {
      var end = minOf(cursor + maximum, text.length)
      val sentence = (cursor until end).firstOrNull { text[it] in "。！？!?；;\n" }
      if (sentence != null) end = sentence + 1
      if (end < text.length && text[end - 1].isHighSurrogate() && text[end].isLowSurrogate()) end--
      val speech = spoken(text.substring(cursor, end))
      if (hasPronunciation(speech)) {
        blocks.add(VoiceSpeechChunk(speech, represented, end)); represented = end
      }
      cursor = end
    }
    // Layout-only spans have no audio, but must not shift subtitles or lose the end of the source.
    if (blocks.isNotEmpty() && represented < text.length) blocks[blocks.lastIndex] = blocks.last().copy(end = text.length)
    return blocks
  }
}
