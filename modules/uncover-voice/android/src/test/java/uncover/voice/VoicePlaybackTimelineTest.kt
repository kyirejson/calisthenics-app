package uncover.voice

import org.junit.Assert.*
import org.junit.Test

class VoicePlaybackTimelineTest {
  private fun audio(size: Int, start: Int = 0, end: Int = 5) = VoicePlaybackPacket.Audio(ShortArray(size) { 1000 }, start, end)
  @Test fun writeAheadDoesNotAdvanceSubtitlesOrFinishThePrecedingWords() {
    val timeline = VoicePlaybackTimeline()
    timeline.append(audio(1600), 0, 0); timeline.append(audio(1600, 5, 10), 1600, 0)
    assertTrue(timeline.advance(0).isEmpty()); assertEquals(0L, timeline.playedFrames)
    assertEquals(listOf(VoicePlaybackTimeline.Progress(0, 5, 0)), timeline.advance(1))
    assertTrue(timeline.advance(1599).isEmpty()); assertEquals(1599L, timeline.playedFrames)
    assertEquals(listOf(VoicePlaybackTimeline.Progress(0, 5, 5)), timeline.advance(1600))
    assertEquals(listOf(VoicePlaybackTimeline.Progress(5, 10, 5)), timeline.advance(1601))
    assertEquals(listOf(VoicePlaybackTimeline.Progress(5, 10, 10)), timeline.advance(3200))
    assertEquals(3200L, timeline.playedFrames); assertEquals(3200L, timeline.queuedFrames)
    assertEquals(1, timeline.prefedBoundaries); assertFalse(timeline.pending)
  }
  @Test fun devicePaddingIsNotCountedAsSpeechOrAsCompletingTheNextSegment() {
    val timeline = VoicePlaybackTimeline(); timeline.append(audio(80), 0, 0); timeline.advance(80)
    timeline.append(audio(160, 5, 10), 512, 80)
    assertEquals(emptyList<VoicePlaybackTimeline.Progress>(), timeline.advance(512)); assertEquals(80L, timeline.playedFrames)
    assertEquals(listOf(VoicePlaybackTimeline.Progress(5, 10, 5)), timeline.advance(513))
    timeline.advance(672); assertEquals(240L, timeline.playedFrames); assertEquals(240L, timeline.queuedFrames)
  }
  @Test fun lateProducerIsNotMisreportedAsPrefedAndNeverCompletesUnheardAudio() {
    val timeline = VoicePlaybackTimeline(); timeline.append(audio(1600), 0, 0); timeline.advance(1600)
    timeline.append(audio(1600, 5, 10), 1600, 1600)
    assertEquals(0, timeline.prefedBoundaries); assertTrue(timeline.advance(1600).isEmpty())
    timeline.advance(2000); assertEquals(2000L, timeline.playedFrames); assertTrue(timeline.pending)
  }
  @Test fun aHeadJumpReportsEveryFinishedRangeOnceInSourceOrder() {
    val timeline = VoicePlaybackTimeline()
    repeat(4) { index -> timeline.append(audio(400, index * 5, index * 5 + 5), index * 400L, 0) }
    val changes = timeline.advance(1600)
    assertEquals(listOf(0, 5, 5, 10, 10, 15, 15, 20), changes.map { it.spokenEnd })
    assertEquals(3, timeline.prefedBoundaries); assertFalse(timeline.pending)
    assertTrue(timeline.advance(1600).isEmpty()); assertEquals(1600L, timeline.playedFrames)
  }
  @Test fun aPartialCancellationDoesNotPretendTheQueuedResponseWasHeard() {
    val timeline = VoicePlaybackTimeline(); timeline.append(audio(16000), 0, 0)
    val changes = timeline.advance(3000)
    assertEquals(0, changes.single().spokenEnd); assertEquals(3000L, timeline.playedFrames)
    assertEquals(16000L, timeline.queuedFrames); assertTrue(timeline.pending)
  }
  @Test fun overlappingAudioPositionsAreRejected() {
    val timeline = VoicePlaybackTimeline(); timeline.append(audio(1600), 0, 0)
    assertThrows(IllegalArgumentException::class.java) { timeline.append(audio(1600, 5, 10), 800, 0) }
  }
}
