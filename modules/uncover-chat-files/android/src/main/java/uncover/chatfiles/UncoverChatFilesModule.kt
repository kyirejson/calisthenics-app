package uncover.chatfiles

import android.net.Uri
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import com.tom_roush.pdfbox.io.MemoryUsageSetting
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.text.PDFTextStripper
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

class UncoverChatFilesModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("UncoverChatFiles")
    AsyncFunction("readPdf") { uri: String ->
      val context = appContext.reactContext ?: error("App 尚未就绪。")
      val parsed = Uri.parse(uri)
      check(parsed.scheme == "file") { "请重新选择 PDF 文件。" }
      val file = File(parsed.path ?: error("PDF 路径无效。")).canonicalFile
      val cache = File(context.cacheDir, "DocumentPicker").canonicalFile
      check(file.path.startsWith(cache.path + File.separator)) { "请通过附件选择器添加 PDF。" }
      check(file.length() <= 32L * 1024 * 1024) { "文件超过本机读取大小（32 MB），请拆分后添加。" }
      PDFBoxResourceLoader.init(context)
      PDDocument.load(file, MemoryUsageSetting.setupTempFileOnly().setTempDir(context.cacheDir)).use { document ->
        check(!document.isEncrypted) { "加密 PDF 暂无法读取，请使用无密码的文件。" }
        check(document.currentAccessPermission.canExtractContent()) { "PDF 不允许提取文字。" }
        val stripper = PDFTextStripper()
        val text = StringBuilder()
        for (page in 1..document.numberOfPages) {
          stripper.startPage = page
          stripper.endPage = page
          text.append(stripper.getText(document)).append("\n\n")
          check(text.length <= 1_000_000) { "文件文字过多，请拆分后添加。" }
        }
        text.toString()
      }
    }
  }
}
