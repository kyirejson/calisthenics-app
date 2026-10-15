package uncover.voice

import kotlin.math.sqrt

/** Speaker similarity is biometric evidence, not a speech probability or proof against replay. */
internal data class VoiceOwnerProfile(val embeddings: List<FloatArray>, val shortGroups: List<List<FloatArray>> = emptyList(), val wakeEmbeddings: List<FloatArray> = emptyList())
internal object VoiceIdentity {
  const val MODEL = "campplus-zh-cn-f682b514"
  // The model author's published operating point is .31. Use a more conservative .40
  // with agreement from two enrollment samples; this is not a calibrated error rate.
  // Similar enrollment clips measure consistency, not variation across future speech.
  const val THRESHOLD = .40f
  fun normalized(vector: FloatArray): FloatArray {
    require(vector.isNotEmpty() && vector.all { it.isFinite() }) { "声纹特征无效。" }
    val norm = sqrt(vector.sumOf { it.toDouble() * it.toDouble() }).toFloat()
    require(norm.isFinite() && norm > 1e-6f) { "没有提取到有效声纹。" }
    return FloatArray(vector.size) { vector[it] / norm }
  }
  fun similarity(a: FloatArray, b: FloatArray): Float {
    require(a.size == b.size) { "声纹模型版本不一致，请重新登记。" }
    return a.indices.sumOf { (a[it] * b[it]).toDouble() }.toFloat()
  }
  fun enroll(embeddings: List<FloatArray>): VoiceOwnerProfile {
    require(embeddings.size == 3) { "请完成三段主人声音登记。" }
    val vectors = embeddings.map(::normalized)
    val comparisons = vectors.indices.flatMap { i -> (i + 1 until vectors.size).map { j -> similarity(vectors[i], vectors[j]) } }
    require(comparisons.min() >= .45f) { "三段声音不够一致，请在安静环境下由同一人重新登记。" }
    return VoiceOwnerProfile(vectors)
  }
  fun accepts(profile: VoiceOwnerProfile, embedding: FloatArray, voicedMs: Long): Boolean {
    if (voicedMs < 320) return false
    val vector = normalized(embedding)
    val scores = profile.embeddings.map { similarity(it, vector) }.sortedDescending()
    // Compare short input with short enrollment views, rather than increasing a
    // long-utterance threshold that rejects genuine short speech. No text routing.
    val direct = scores.size >= 3 && scores.take(2).average() >= THRESHOLD && scores[1] >= THRESHOLD - .03f
    if (voicedMs >= 900 && direct) return true
    if (profile.shortGroups.size != 3) return false
    val groups = profile.shortGroups.map { group -> group.maxOfOrNull { similarity(it, vector) } ?: -1f }.sortedDescending()
    return groups.take(2).average() >= .43f && groups[1] >= .40f && groups[2] >= .35f
  }
  fun acceptsWake(profile: VoiceOwnerProfile, embedding: FloatArray, voicedMs: Long): Boolean {
    if (voicedMs < 192 || profile.wakeEmbeddings.size != 3) return false
    val vector = normalized(embedding)
    val scores = profile.wakeEmbeddings.map { similarity(it, vector) }.sortedDescending()
    return scores.take(2).average() >= .60f && scores[1] >= .55f
  }
  fun complete(base: VoiceOwnerProfile, groups: List<List<FloatArray>>, wakes: List<FloatArray>, heldOutWake: FloatArray, voicedMs: Long): VoiceOwnerProfile {
    require(groups.size == 3 && groups.all { it.size in 1..12 }) { "短语音样本不完整，请重新登记。" }
    require(wakes.size == 3) { "请在三段登记内容开头各说一次 BLACK。" }
    val profile = VoiceOwnerProfile(base.embeddings, groups.map { it.map(::normalized) }, wakes.map(::normalized))
    require(acceptsWake(profile, heldOutWake, voicedMs)) { "单独呼唤 BLACK 的回读验证未通过，请自然发音后重新登记。" }
    return profile
  }
}
