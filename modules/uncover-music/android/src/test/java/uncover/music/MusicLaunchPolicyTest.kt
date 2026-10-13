package uncover.music

import org.junit.Assert.*
import org.junit.Test

class MusicLaunchPolicyTest {
  @Test fun shellLaunchHasNoAppThreadAndUsesItsActualPackage() {
    val intent = Any(); val options = Any()
    val args = MusicLaunchPolicy.arguments(MusicLaunchPolicy.signature, 2000, 10123, intent, "audio/mpeg", options)
    assertEquals(12, args.size)
    assertNull(args[0]); assertEquals("com.android.shell", args[1]); assertNull(args[2])
    assertSame(intent, args[3]); assertEquals("audio/mpeg", args[4])
    assertNull(args[5]); assertNull(args[6]); assertEquals(0, args[7]); assertEquals(0, args[8]); assertNull(args[9])
    assertSame(options, args[10]); assertEquals(0, args[11])
  }
  @Test fun badOrdinaryAppIdentityAndUnknownSignaturesNeverLaunch() {
    for (uid in listOf(1000, 10123, -1)) assertEquals("background_identity_invalid", assertThrows(MusicFailure::class.java) { MusicLaunchPolicy.arguments(MusicLaunchPolicy.signature, uid, 10123, Any(), null, Any()) }.code)
    for (types in listOf(emptyList(), MusicLaunchPolicy.signature.drop(1), MusicLaunchPolicy.signature + "int")) assertEquals("activity_api_unsupported", assertThrows(MusicFailure::class.java) { MusicLaunchPolicy.arguments(types, 2000, 10123, Any(), null, Any()) }.code)
  }
  @Test fun launchesStayInTheUserWhoAuthorizedTheApp() {
    assertEquals(10, MusicLaunchPolicy.arguments(MusicLaunchPolicy.signature, 2000, 1_010_123, Any(), null, Any()).last())
    assertEquals(0, MusicLaunchPolicy.arguments(MusicLaunchPolicy.signature, 0, 10123, Any(), null, Any()).last())
    assertThrows(MusicFailure::class.java) { MusicLaunchPolicy.arguments(MusicLaunchPolicy.signature, 2000, -1, Any(), null, Any()) }
  }
  @Test fun abortsAndPermissionFailuresCannotBeReportedAsAccepted() {
    for (code in listOf(0, 2, 3)) assertTrue(MusicLaunchPolicy.accepted(code))
    for (code in listOf(-1, -94, -100, 1, 4, 100, 101, 102)) assertFalse(MusicLaunchPolicy.accepted(code))
  }
}
