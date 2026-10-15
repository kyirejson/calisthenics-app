package uncover.voice

import android.content.Context
import java.io.File
import java.security.KeyStore

/** Data-only removal for retired enrollment. Never reads/decrypts an embedding or gates a conversation. */
internal object VoiceLegacyData {
  fun exists(context: Context) = File(context.noBackupFilesDir, "black-owner-v1.sealed").exists()
  fun clear(context: Context) {
    for (name in listOf("black-owner-v1.sealed", "black-owner-v1.pending")) {
      val file = File(context.noBackupFilesDir, name)
      check(!file.exists() || file.delete()) { "旧版声纹资料删除失败。" }
    }
    KeyStore.getInstance("AndroidKeyStore").apply { load(null); if (containsAlias("uncover.black.owner.v1")) deleteEntry("uncover.black.owner.v1") }
  }
}
