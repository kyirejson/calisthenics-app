package uncover.music

import org.junit.Assert.*
import org.junit.Test

class MusicPolicyTest {
  @Test fun providersStayInTheTwoUserChosenApplications() {
    assertEquals("com.netease.cloudmusic", MusicPolicy.packageFor("netease"))
    assertEquals("com.tencent.qqmusic", MusicPolicy.packageFor("qq"))
    assertThrows(MusicFailure::class.java) { MusicPolicy.packageFor("other") }
  }
  @Test fun contentUrisStayInTheChosenPlayerAndCannotSmuggleOtherApplicationsOrFiles() {
    assertTrue(MusicPolicy.acceptsUri("netease", "https://music.163.com/#/playlist?id=1"))
    assertTrue(MusicPolicy.acceptsUri("netease", "orpheus://playlist/1"))
    assertTrue(MusicPolicy.acceptsUri("qq", "https://y.qq.com/n/ryqq/songDetail/1"))
    assertTrue(MusicPolicy.acceptsUri("qq", "qqmusic://play"))
    for (uri in listOf("file:///private", "intent://other", "https://y.qq.com.evil.example/", "https://y.qq.com@evil.example/", "https://evil.example/y.qq.com")) assertFalse(MusicPolicy.acceptsUri("qq", uri))
    assertFalse(MusicPolicy.acceptsUri("qq", "orpheus://song/1"))
  }
}
