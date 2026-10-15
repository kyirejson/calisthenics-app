# BLACK voice interaction — production candidate

Historical v1.7.13 candidate baseline. The playback gating and separate voice
context below have been replaced in v1.7.14; see
[current interaction implementation](release-v1.7.14-2026-10-15.md).

Later changes: v1.7.16 removes the local cue entirely, adds local AEC3/acoustic
ownership and model-selected silence. See [current local implementation](voice-local-echo-2026-10-15.md).

Status: final local Android candidate build and code/resource validation passed.
Signing and device acceptance remain separate gates. No v1.7.13 formal publication.
The user agreed to install a formally signed candidate on ColorOS for lock-screen,
task removal and force-stop acceptance. Do not mark those physical-device tests
passed before receiving their results.

## Implementation

- Explicit microphone consent and a visible, stoppable microphone foreground
  service; no hidden listener, scheduled resurrection, root or system-setting edits.
- Native on-device bilingual keyword spotting: BLACK / Hey BLACK. Local 0.497s
  synthetic Mandarin “我在” cue is packaged, not fetched on wake.
- Native on-device streaming Chinese transcription after the cue; short pauses
  finish a turn. Reply playback gates transcription to avoid hearing itself.
  Name detection remains active to interrupt a reply; full simultaneous speech
  transcription and speaker identity authentication are not claimed. Echo
  cancellation uses the device's available effect, not a universal software AEC.
  Do not promise perfect noisy-room, loud-speaker or distant wake.
- A headless JS task starts the existing Agent without opening an activity. Text
  and voice use one shared runner, all existing tools, memory, real request IDs,
  receipts and a single repository/write queue. Voice uses its own conversational
  session context; it does not silently merge the text chat's unsaved messages.
- Cancellation / listening-off invalidates late replies and cancels pending model
  requests. No automatic replay of a mutating utterance after process death.
- Existing session cleanup can finish music work without bringing Uncover's UI
  forward. Music background compatibility and lock restrictions remain separate.
- Optional Android default-assistant role is selected by the user. AOSP's current
  VoiceInteractionManagerService has a force-stop path that restarts the current
  voice interactor; this is a platform-specific behavior to test, not a universal
  bypass guarantee. A native assistant entry restores an already-enabled listener.
  Permission revocation, microphone privacy toggle, shutdown and explicit stop
  still prevent listening. Before the first device unlock, credential-encrypted
  app state is unavailable; no Direct Boot/lock-screen authentication bypass.
- Waiting/background audio is never persisted or uploaded; recognized dialogue
  text goes to the existing configured model provider. Generated responses use
  the installed Chinese TTS engine for now, not a claimed Doubao/XiaoAi voice.
  No paid cloud service was opened or key extracted from a third-party app.

## Resource provenance / reproducibility

`npm run prepare:voice` downloads SHA-256-pinned sherpa-onnx 1.13.8 AAR and model
archives. Binaries are generated/ignored in Git, but packed in the Android APK.
Author licensing verified separately: pkufool's ModelScope KWS model declares
Apache License 2.0, csukuangfj's original small CTC model on Hugging Face declares
Apache-2.0; code license is not used as a substitute for the model licenses.
Native NOTICE, Apache license, archive/file hashes and acknowledgement provenance
are included. The local cue reuses the pinned Kokoro build-only generator; no
Kokoro weights or Python runtime are shipped.

## Checks so far

- TypeScript and all 514 Node regressions passed after sharing the runner.
- Nine voice checks include real dialogue session/cancellation tests as well as
  source/resource/ownership wiring.
- Python sherpa-onnx 1.13.8 CPU: synthetic Windows speech “Black” and “Hey Black”
  detected; one ordinary negative phrase not detected. The official Chinese ASR
  sample transcribed with expected words. These are not real microphone tests.
- The final four-ABI release build and 32 native JVM tests passed (voice 3, music
  16, running 13). Unicode TTS chunking preserves complete responses and stops
  queued speech on engine errors. No separate QA application ID.
- Actual APK inspection verified headless/native classes, fused music tools,
  all four voice ABIs, model and acknowledgement hashes, and bundled licenses.
  This is artifact verification, not physical microphone/ColorOS acceptance.
- The first signed candidate's emulator check found that requesting the assistant
  role produces no picker: AOSP marks that role `requestable=false`. The entry was
  corrected to public voice/default-app Settings, where the user selects Uncover.
  No silent role grants or qualification bypass are used in the application.

References:

- https://developer.android.com/reference/android/service/voice/VoiceInteractionService
- https://android.googlesource.com/platform/frameworks/base/+/master/services/voiceinteraction/java/com/android/server/voiceinteraction/VoiceInteractionManagerService.java
- https://developer.android.com/develop/background-work/services/fgs/service-types#microphone
- https://k2-fsa.github.io/sherpa/onnx/kws/pretrained_models/index.html
- https://www.modelscope.cn/models/pkufool/icefall-kws-zipformer-zh-en-3M-2025-12-20
- https://huggingface.co/csukuangfj/icefall-streaming-zipformer-small-ctc-zh-2025-04-01
