package uncover.voice

import java.nio.ByteBuffer
import java.nio.ByteOrder

/** System TTS WAV formats, converted without dropping channels or silently truncating the reply. */
internal data class VoicePcm(val samples: ShortArray, val sampleRate: Int) {
  companion object {
    fun read(bytes: ByteArray): VoicePcm {
      val buffer = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)
      require(bytes.size >= 12 && String(bytes, 0, 4, Charsets.US_ASCII) == "RIFF" && String(bytes, 8, 4, Charsets.US_ASCII) == "WAVE") { "语音引擎没有返回有效 WAV。" }
      var position = 12; var format = 0; var channels = 0; var rate = 0; var bits = 0; var dataStart = 0; var dataSize = 0
      while (position + 8 <= bytes.size) {
        val id = String(bytes, position, 4, Charsets.US_ASCII)
        val size = buffer.getInt(position + 4)
        require(size >= 0 && size <= bytes.size - position - 8) { "语音音频块不完整。" }
        val start = position + 8
        if (id == "fmt ") {
          require(size >= 16); format = buffer.getShort(start).toInt() and 65535; channels = buffer.getShort(start + 2).toInt() and 65535
          rate = buffer.getInt(start + 4); bits = buffer.getShort(start + 14).toInt() and 65535
        } else if (id == "data") { dataStart = start; dataSize = size }
        position = start + size + (size and 1)
      }
      require(rate in 8000..192000 && channels in 1..8 && (format == 1 && bits in listOf(8, 16, 24, 32) || format == 3 && bits == 32) && dataSize > 0) { "系统语音引擎的音频格式不受支持。" }
      val stride = bits / 8; require(dataSize % (stride * channels) == 0)
      val frames = dataSize / stride / channels
      val mono = ShortArray(frames) { frame ->
        var sum = 0.0
        for (channel in 0 until channels) {
          val offset = dataStart + (frame * channels + channel) * stride
          sum += if (format == 3) buffer.getFloat(offset).toDouble().coerceIn(-1.0, 1.0) * 32767 else when (bits) {
            8 -> ((bytes[offset].toInt() and 255) - 128) * 256.0
            16 -> buffer.getShort(offset).toDouble()
            24 -> (((bytes[offset].toInt() and 255) or ((bytes[offset + 1].toInt() and 255) shl 8) or (bytes[offset + 2].toInt() shl 16)) / 256.0)
            else -> buffer.getInt(offset) / 65536.0
          }
        }
        (sum / channels).toInt().coerceIn(-32768, 32767).toShort()
      }
      return VoicePcm(mono, rate)
    }
  }
}
