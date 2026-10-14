# Music latency reduction · v1.7.13

## Changes

- Optional open/UI/control-and-observe tools preserve the original parameters,
  exact command, request/operation-key ledger and model autonomy. Original tools
  remain for read-only checks, pagination and recovery. No fixed navigation
  sequence, guessed URI, keyword intent classifier or automatic permission grant.
- Reading preferences supplies authorized playback alongside both providers'
  capabilities. Guidance prefers real preset links and an existing session where
  it meets the request. Links were already supported; no guessed favorites ID or
  account-unsafe cached node/coordinate is introduced.
- Background helper/display reuse already exists. This release keeps it, without
  creating a duplicate connection layer or extending its idle lifetime.
- UI events retain only provider-package revision/timestamp. Reads return when a
  real scoped root is ready and changes have been quiet for 80ms, instead of an
  unconditional 450ms delay. After an operation, a missing event has an explicit
  220ms fallback. A 1400ms maximum prevents animation/event storms or unavailable
  windows from hanging. Fresh node validation and background-only scoping remain.
- Media state/metadata and active-session callbacks are registered before the
  action, scoped to the selected provider, and removed in finally. UI and playback
  waits run concurrently; cancellation is checked during waits. Buffering waits
  up to the bound. A state or change event is not proof of playlist identity.
- Action receipts, fresh screen and playback observations are separate results.
  Observation failure never re-executes an action or overwrites its receipt.
  Replays take fresh observations. Changed/timeout/fallback/wait duration are
  reported, never converted to invented success. No screenshots/event text,
  account data or credentials are logged by these timing observations.

## Verification

TypeScript and all 514 Node tests passed. Seven music latency tests cover descriptor parity,
canonical commands and replay, partial observation failure, preferences plus
playback, cancellation, a model-planned loop and native observation wiring.
The mocked three-action workflow needs four tool rounds rather than seven; this
is a round-count regression test, not a physical-device playback benchmark.

Native JVM timing-policy tests cover a settled read, event quiet time, missing-event
fallback and later events preventing readiness. All 16 music JVM tests passed in
the final four-ABI Android release build. Actual APK inspection finds all three
fused tools and the native execute/finish methods. Signing, candidate distribution
and physical ColorOS acceptance are separate gates. No new QA package is built.

Native API references: [MediaController.Callback](https://developer.android.com/reference/android/media/session/MediaController.Callback)
and [AccessibilityService](https://developer.android.com/reference/android/accessibilityservice/AccessibilityService).

No claim of universal NetEase/QQ real-song speedup: model latency, login/ads,
streaming/network and OEM behavior remain external.
