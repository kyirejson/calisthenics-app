package uncover.web

import org.junit.Assert.*
import org.junit.Test
import java.net.InetAddress
import java.net.URL

class PublicWebPolicyTest {
  @Test fun localAndReservedNetworksAreNotReadable() {
    for (ip in listOf("127.0.0.1", "10.0.0.1", "192.168.1.1", "172.16.1.1", "169.254.169.254", "100.64.1.1", "0.0.0.0", "224.0.0.1", "::1", "fc00::1", "fe80::1")) assertFalse(ip, PublicWebPolicy.isPublic(InetAddress.getByName(ip)))
    assertTrue(PublicWebPolicy.isPublic(InetAddress.getByName("8.8.8.8")))
  }
  @Test fun urlsCannotCarryCredentialsOrTargetCustomServicePorts() {
    for (url in listOf("https://user:secret@example.com/", "http://example.com:8081/", "http://printer.local/")) {
      try { PublicWebPolicy.validate(URL(url)); fail(url) } catch (_: IllegalArgumentException) {}
    }
    PublicWebPolicy.validate(URL("https://developer.android.com/reference/android/speech/tts/TextToSpeech"))
  }
}
