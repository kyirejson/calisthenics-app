# Running voices, automatic positioning, and distance-free history

Status: implemented and verified locally; included in the v1.7.13 production
release candidate alongside music latency improvements. The release verification
document records the actual publication outcome. No new independent test APK is
requested for this release (the QA checks below predate that instruction).

## Behavior

- Entering the outdoor running page automatically starts a continuous location
  preview after the recorder is ready. Returning to that page or switching back
  from indoor requests a new subscription. Leaving/indoor stops idle preview;
  an active recording remains owned by its recorder/service.
- One automatic request per outdoor visit; rejection/error cannot trigger a
  repeated permission loop. Manual retry remains available. Foreground preview
  recovery still uses the existing host lifecycle. No fabricated coordinates or
  weakened distance-quality rules were introduced.
- Running settings offer two distinct offline Mandarin speakers, female/male.
  Selection saves immediately and works idle, running or paused without resetting
  duration, changing mute state or repeating previous kilometre announcements.
  Female is the backwards-compatible default. Every-kilometre speech stays on
  by default; previously saved explicit mute is preserved.
- Android plays packaged mono PCM with navigation audio focus; web schedules
  the same clips through Web Audio, unlocked by the actual Start tap before the
  countdown. System TTS/pitch imitation is removed only from running speech;
  training's existing speech module is unchanged.
- A finite positive measured/entered/step-derived distance is required for a
  new history record. No added minimum-mileage gate. Empty/zero-distance runs
  finish and acknowledge their checkpoint without creating history or claiming
  a save. A failed write/acknowledgement remains retryable under the same ID.
- Timer-only statistics/count text is removed. Existing historical records
  were not silently deleted. Derived mileage statistics exclude missing/zero
  mileage.

## Verified

- TypeScript check; all 498 Node regression tests passed.
- Android running module compiled; 13 JVM tests passed, including announcement
  grammar and Chinese number assembly. Music module tests also passed in the
  isolated APK build.
- Browser 320x600 and 390x844: actual WAV decode/playback scheduling and ended
  events for both speakers, persistence, active switch, kilometre watermark,
  accessible selection/hit areas, empty/zero saves and unchanged legacy data.
- Browser running regression: four layouts, map interactions, pause/resume,
  reload checkpoint, offline tiles, durable-write failure/retry, indoor manual
  distance and denied GPS. Separate automatic-location smoke proves no Locate
  click, map follow, exit/indoor cleanup and no denial loop.
- Independent debug-signed `com.zizhong.jinjie.musicqa` APK built and tested on
  task-owned Android 15 emulator `UncoverRun35`. Both speakers loaded without
  speech errors, active switch preserved running, pause/resume worked, empty
  indoor run was not saved, selection survived cold restart. Granted-location
  preview automatically acquired the fresh emulator-only coordinate fixture.
  No physical device or production-app data was changed.
- APK voice WAV digests match the source resource manifest. About 8 MB of
  PCM is packaged; model weights/Python are not included. License/provenance and
  rebuild instructions live next to the audio resources.

## Verification findings

The initial native player checked `STATE_INITIALIZED` before the first static
PCM write. Android static AudioTrack starts in `STATE_NO_STATIC_DATA`; the write
must precede the readiness check. This was corrected and the Android APK smoke
then passed. API reference: https://developer.android.com/reference/android/media/AudioTrack

The repeatedly updated independent QA package initially ran an older cached
Expo update despite containing the newest embedded bundle (bundle digests and
source map verified). Its **temporary build snapshot only** disables Expo
updates so tests execute embedded code. Production repository update settings
are unchanged. Before a future formal release, regenerate native/fingerprint
configuration from current source with the new version; do not publish the
debug-signed QA snapshot.

The emulator has no audible output. These tests establish playback/recording
behavior, not perceived voice quality, Bluetooth routing or ColorOS-specific
speaker behavior on the user's physical phone.

Build-only dependencies were installed in an isolated tooling venv. Adding
expo-asset as a direct dependency only declares an already locked installed
dependency; no transitive versions were changed. No unrelated npm audit upgrades
were performed.
