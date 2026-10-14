package uncover.voice

/** Transport chunks preserve the complete model response and Unicode code points. */
internal object VoiceSpeechChunks {
  fun split(text: String, maximum: Int): List<String> {
    require(maximum >= 2)
    val blocks = mutableListOf<String>()
    var start = 0
    while (start < text.length) {
      var end = minOf(start + maximum, text.length)
      // Sentence-sized transport improves playback latency and truthful progress; all text is retained.
      val sentence = (start until end).firstOrNull { text[it] in "。！？!?；;\n" }
      if (sentence != null) end = sentence + 1
      if (end < text.length && text[end - 1].isHighSurrogate() && text[end].isLowSurrogate()) end--
      blocks.add(text.substring(start, end)); start = end
    }
    return blocks
  }
}
