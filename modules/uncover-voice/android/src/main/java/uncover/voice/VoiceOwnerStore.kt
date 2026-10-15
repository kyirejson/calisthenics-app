package uncover.voice

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Private encrypted embeddings only. No raw recordings, SharedPreferences, backups or network. */
internal class VoiceOwnerStore(private val context: Context) {
  companion object { private val registration = VoiceRegistrationGate() }
  private val file get() = File(context.noBackupFilesDir, "black-owner-v1.sealed")
  private fun key(): SecretKey {
    val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    (store.getKey("uncover.black.owner.v1", null) as? SecretKey)?.let { return it }
    return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
      init(KeyGenParameterSpec.Builder("uncover.black.owner.v1", KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setRandomizedEncryptionRequired(true).build())
    }.generateKey()
  }
  fun exists() = file.isFile
  fun beginEnrollment() = registration.begin()
  fun enrollmentActive(ticket: Long) = registration.isActive(ticket)
  fun cancelEnrollment() = registration.cancel()
  fun read(): VoiceOwnerProfile? = synchronized(registration) {
    if (!exists()) return null
    val bytes = file.readBytes(); require(bytes.size in 30..262144) { "主人声纹存档损坏，请重新登记。" }
    val length = bytes[0].toInt() and 255; require(length == 12) { "主人声纹存档格式无效。" }
    val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, bytes.copyOfRange(1, length + 1))) }
    val json = JSONObject(cipher.doFinal(bytes.copyOfRange(length + 1, bytes.size)).toString(Charsets.UTF_8))
    require(json.optInt("schema") == 2) { "声音登记已升级，请重新登记并完成 BLACK 回读验证。" }
    require(json.getString("model") == VoiceIdentity.MODEL) { "声纹模型已变化，请重新登记。" }
    fun readVectors(array: JSONArray) = (0 until array.length()).map { i -> val values = array.getJSONArray(i); VoiceIdentity.normalized(FloatArray(values.length()) { values.getDouble(it).toFloat() }) }
    val vectors = readVectors(json.getJSONArray("embeddings"))
    require(vectors.size == 3) { "主人声纹存档不完整。" }
    require(vectors.map { it.size }.distinct().size == 1) { "主人声纹特征维度不一致，请重新登记。" }
    val groups = json.getJSONArray("shortGroups").let { array -> (0 until array.length()).map { readVectors(array.getJSONArray(it)) } }
    val wakes = readVectors(json.getJSONArray("wakeEmbeddings"))
    require(groups.size == 3 && groups.all { it.size in 1..12 } && wakes.size == 3) { "短语音或唤醒词声纹不完整，请重新登记。" }
    require((groups.flatten() + wakes).all { it.size == vectors.first().size }) { "主人声纹特征维度不一致。" }
    VoiceOwnerProfile(vectors, groups, wakes)
  }
  fun commitEnrollment(profile: VoiceOwnerProfile, ticket: Long) = registration.commit(ticket) {
    require(profile.shortGroups.size == 3 && profile.wakeEmbeddings.size == 3) { "请完成短语音与唤醒词回读验证。" }
    fun array(vectors: List<FloatArray>) = JSONArray(vectors.map { JSONArray(it.map(Float::toDouble)) })
    val json = JSONObject().put("schema", 2).put("model", VoiceIdentity.MODEL)
      .put("embeddings", JSONArray(profile.embeddings.map { JSONArray(it.map(Float::toDouble)) }))
      .put("shortGroups", JSONArray(profile.shortGroups.map(::array))).put("wakeEmbeddings", array(profile.wakeEmbeddings))
    val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key()) }
    val payload = byteArrayOf(cipher.iv.size.toByte()) + cipher.iv + cipher.doFinal(json.toString().toByteArray(Charsets.UTF_8))
    val temp = File(context.noBackupFilesDir, "black-owner-v1.pending")
    try {
      java.io.FileOutputStream(temp).use { it.write(payload); it.fd.sync() }
      android.system.Os.rename(temp.absolutePath, file.absolutePath)
    } finally { temp.delete() }
  }
  fun clear() = registration.invalidate {
    if (file.exists()) check(file.delete()) { "主人声纹删除失败。" }
    File(context.noBackupFilesDir, "black-owner-v1.pending").delete()
    KeyStore.getInstance("AndroidKeyStore").apply { load(null); if (containsAlias("uncover.black.owner.v1")) deleteEntry("uncover.black.owner.v1") }
  }
}
