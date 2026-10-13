# Music execution modes

Foreground selection remains available. Experimental background selection uses an explicitly authorized Shizuku UserService and a dedicated virtual display. It is not a floating overlay, a mirror of the user's screen, a direct music-content API, or a bypass of account/subscription/lock-screen restrictions.

## User setup

1. Use Android 14 or later (independent display focus is required).
2. Install and start [official Shizuku](https://shizuku.rikka.app/download/). The [wireless startup guide](https://shizuku.rikka.app/guide/setup/) does not require a computer on Android 11+, but unrooted phones need startup again after reboot. This grants powerful system-debugging access; it is optional and requires explicit user consent.
3. In AI assistant → service settings → music, select the music provider and enable background selection. Manually grant Shizuku access, music accessibility, and optional playback-status notification access.
4. Complete music-app login and first-use agreements yourself in the normal music app before testing. The model never accepts them automatically.
5. Ask the model to play music while remaining on the Uncover page. It must read the actual music screen and media session, not infer success from a launch/tap receipt.

## Implementation and scope

- The existing model tools select songs and UI controls. No new keyword router or fixed song-search script is added.
- `MusicBackground` binds the private shell helper. No model tool can grant permissions, execute shell commands, choose arbitrary packages, intents, display IDs or coordinates.
- `MusicDisplayService` creates a 720×1280 display with own focus and hidden IME. Local image buffers are drained without reading pixels, storing screenshots, or sending them to a model. The physical display is never mirrored. The ordinary accessibility service returns only music-app text/controls on the selected display.
- `IMusicDisplay` is a typed Binder protocol with a caller-UID check, interface tokens and exact parcel shape. There is no exported privileged service entry.
- Background launches use `MusicActivityLauncher` → `IActivityTaskManager.startActivityAsUser`, with a null normal-application thread, the actual authorized shell calling package, an explicit private display, and the user who authorized Uncover. The old `Context.startActivity` path is removed. Launch results are checked; rejection/abort is never treated as acceptance or playback success. Android UID and permission checks remain enabled.
- Node references bind provider, screen identity, display identity and current control fingerprint. Background touch/back/enter are routed explicitly to the helper's owned display. Failure never falls back to display 0 or automatically changes the user's mode.
- Cancel, disabling screen/background access, accessibility disconnect, app destruction and clearing music data release the display/helper. An idle display expires after 120 seconds; its activities are destroyed rather than moved to the main display. This does not deliberately stop the music app's playback service; playback continuity on display cleanup needs provider-specific validation.
- Lock-screen UI automation is intentionally not enabled. Existing media-session playback controls can continue to operate independently of UI selection.

## Verification status (2026-10-13)

Implemented and compile/unit tested. On 2026-10-13 the user reported that the independent V2 test package passed on their ColorOS 16.0.10 phone and requested a production release. This is user-reported device acceptance, not a developer-observed playback trace or broad device/provider certification. Installing Shizuku in the isolated emulator was rejected by the execution environment's security policy; this was not bypassed. Developer-side privileged background playback remains unverified, and earlier foreground QQ playback results do not establish background compatibility on all devices.

The user's ColorOS 16.0.10 screenshot reports an ActivityTaskManager caller-UID rejection in v1. It is a model's summary, not a raw stack trace. V2 corrects the inappropriate ordinary-Context launch route, upgrades the Shizuku helper version to invalidate cached v1 code, and preserves separate `create_display` / `launch_activity` diagnostics including original platform messages. Subsequent screen reads retain the startup failure instead of replacing it with generic `display_expired`. The V2 phone retry was reported as passing by the user. The production package retains this same launch implementation; the independent test package's settings and grants do not transfer to the production application ID.

## Primary platform references

- [Shizuku API / UserService](https://github.com/RikkaApps/Shizuku-API)
- [scrcpy virtual displays and IME policy](https://github.com/Genymobile/scrcpy/blob/master/doc/virtual-display.md)
- [scrcpy display focus implementation](https://github.com/Genymobile/scrcpy/blob/master/server/src/main/java/com/genymobile/scrcpy/video/NewDisplayCapture.java)
- [Android activity launch on secondary displays](https://source.android.com/docs/core/display/multi_display/activity-launch)

This project uses the published Shizuku API (MIT). The independently written display bridge uses Android platform APIs researched through the Apache-2.0 scrcpy implementation, rather than bundling a desktop scrcpy binary.
