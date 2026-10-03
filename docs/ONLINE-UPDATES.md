# Uncover online updates

## Current status

The existing project is [@kyirechou/uncover](https://expo.dev/accounts/kyirechou/projects/uncover), ID `f6e5af9d-46ec-4f38-be5e-ec267e071eb7`. On 2026-10-03, [production build 2e9c6c3c-39ac-4763-90ee-0d296900911f](https://expo.dev/accounts/kyirechou/projects/uncover/builds/2e9c6c3c-39ac-4763-90ee-0d296900911f) completed for v1.6.0/build 8 with runtime `eb98f91ec90d0bf641500e691bc021037908efed` and existing dedicated credentials. APK signature, modules, version and public download were verified; see [release verification](release-v1.6.0-2026-10-03.md). The native client now uses user-owned API keys and does not depend on the historical Render backend. Physical-device acceptance remains required. SecureStore and the new system entry require the new APK, not an OTA sent to an older binary. Pushing GitHub code does not publish OTA content. Web is a development preview, not an OTA device.

## User flow

- Automatic checks on safe home/tab screens and foreground return, at most every six hours; manual checks bypass cache.
- A higher native APK build number takes priority over a content update. APK downloads open the system browser; installation is confirmed by Android, not silent.
- Compatible content updates download through expo-updates, report native download progress, and require the user to tap to reload.
- No reload while a training/running/detail screen is active or the app is in the background. Training exits await record persistence before returning to the tabs.
- Failed checks/downloads do not erase training data or claim success. Existing app remains usable offline.
- Native runtime compatibility uses the Expo fingerprint policy. Permissions/native dependencies/SDK changes require another APK.

## Linked project and remaining setup

1. Log in locally: `npx eas-cli@latest login` (never commit credentials).
2. The project is already linked in this checkout. On another checkout, use `npx eas-cli@latest init --id f6e5af9d-46ec-4f38-be5e-ec267e071eb7` only if the link is absent. Do not create a second project or use the separate blank `uncover` scaffold.
3. Keep the public project UUID in `app.json` under `expo.extra.eas.projectId`. If setting `EXPO_PROJECT_ID` in a build environment, use the same UUID; this variable overrides the checked-in value. Dynamic config produces `https://u.expo.dev/<UUID>`.
4. Build a dedicated-key APK with `npx eas-cli@24.8.0 build --platform android --profile production --freeze-credentials`; use the `preview` profile only for separate testing. The old installed APK cannot acquire a missing native updater through OTA.
5. Both EAS build profiles use remote credentials for the dedicated app signing key, not `android/app/debug.keystore`. The legacy-key build `d48cda4a-bf4f-4263-baff-fdef2f86ea90` was canceled and the temporary local `credentials.json` was removed. Do not rotate the dedicated key for future updates. The former public framework test certificate is `FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C`; new APKs must not use it. The certificate inspection script reads signer identity only; it does not cryptographically verify an APK. The GitHub APK workflow now builds via EAS production with existing dedicated credentials and requires `EXPO_TOKEN`; the default-debug-signing implementation was removed.
6. Test an innocuous content change on the preview channel. Check popup/download/restart, offline failure, partial training persistence and fallback on a physical Android device.

## Publish content updates

The manual GitHub workflow `Publish content update (manual)` requires repository/environment secret `EXPO_TOKEN` and variable `EXPO_PROJECT_ID`. Select preview or production explicitly. Protect the production environment with approval in GitHub settings. Nothing runs on ordinary code push.

Alternatively, with an authenticated local account and matching asset set:

```sh
npx eas-cli@latest update --channel preview --environment preview --message "Describe the tested change"
```

Use the same channel/project and compatible native fingerprint as the installed APK. Production APKs must use `production`; preview APKs use `preview`. The dynamic app config writes channel headers for non-EAS builds as well.

Both build profiles explicitly set `env.EXPO_UPDATE_CHANNEL`, in addition to the channel/environment fields. Do not rely only on `EAS_BUILD_PROFILE`: it was absent during local fingerprint calculation but present on the builder, causing a real production runtime mismatch. Regression tests now compare local and cloud config for both profiles. For local production OTA publishing, explicitly set `EXPO_UPDATE_CHANNEL=production` in the shell as well as selecting `--channel production --environment production`.

## APK releases

Increment `expo.android.versionCode` before releasing a new binary; also update the human version and iOS build number as appropriate. Release notes must contain separate `App version: ...` and `Android versionCode: ...` lines and an APK attachment in this repository's Releases. Stable builds ignore prereleases. APK comparison reads the installed native build number, not OTA JavaScript config.

## Private resources and public source code

Book excerpts, book images, derived skill/demon photos and raw downloaded sources remain local, excluded from Git. `npm ci` generates empty resource maps only when book maps do not exist; local originals are never overwritten. Without separately provisioned licensed resources, public builds will not contain those book illustrations/full texts. The generated demonstration images are included. Public CI skips only the private-book resource test, not training/update logic tests. Do not publish a full-resource build until distribution rights are confirmed.

`.easignore` also excludes these resources, unrelated research and Git history from EAS cloud source archives. The `.git` rule intentionally has no trailing slash: the installed EAS CLI checks that exact directory name before removing history from its temporary archive. The original repository is not removed. Before cloud submission, run `eas build:inspect --platform android --stage archive --profile preview --output <new-local-inspection-directory>` and verify that no `.git`, private book resources, environment files or signing files appear in the inspected tree. EAS handles local signing credentials separately from the source archive. Publish future OTA bundles from an equivalently filtered source tree; do not accidentally include local-only book resources in an update.

## Android acceptance checklist

- Export existing device data before an in-place upgrade; do not uninstall or clear application storage. A separate test device may be used for clean-install checks; JSON import/restore is not implemented.
- Install the dedicated-key APK, confirm version 1.6.0/build 8 and test profile/history persistence. Dedicated-key releases reuse the same certificate. Configure the user's own API keys and check that no developer gateway is silently used.
- Check camera, barcode scanning, microphone and system speech recognition on a physical Android device. Confirm revoked permissions and network timeouts remain actionable, and that consent survives an app restart.
- Confirm the app starts with the computer disconnected; opening a workout and leaving without checked sets must not create history.
- Check one set, leave training, restart and verify only the checked set is saved.
- Open the update screen. No update is expected until a compatible preview update is explicitly published. Check that offline failures do not erase data.
- After separate approval, validate a small compatible update on the matching channel: prompt, download and user-triggered restart. Never restart while training or running. Production content updates are not sent merely to test the updater.
- This resource-filtered release intentionally lacks local-only book illustrations/full text; describe that limitation publicly.

## Verification

The v1.4.0 production APK (119,387,676 bytes) passed Google Android `apksig` 8.13.0 cryptographic verification (`verified=true`, APK v2) with the same dedicated certificate. APK SHA-256: `86514109cd9a12b482a36edb58c006219f52d1ac8607c51369b9c3cc27667af2`. Compiled manifest checks confirm `com.zizhong.jinjie`, version 1.4.0/build 5, `debuggable=false`, camera/audio/location/network permissions, updates enabled, the intended Expo project URL and the production channel header. The actual Hermes bundle contains `https://uncover-nutrition-api.onrender.com`. These checks are not physical-device acceptance.

The v1.3.0 production APK (84,141,479 bytes) passed Google Android `apksig` 8.13.0 cryptographic verification (`verified=true`, APK v2). Its dedicated certificate SHA-256 is `EF8CE110F9EAB334A0120D2D50374FA6EF31709A5503C9BB7FAF5E6611C0EC81`, different from the former default debug certificate. APK SHA-256: `15149890a1d1055fb9b159dc12e84bf86019ff1116ba8dea95c3021adabb8b5c`. The compiled Android manifest confirms package `com.zizhong.jinjie`, version 1.3.0/build 4, updates enabled, `NEVER` automatic startup checks, the intended project URL, and the `production` request header. These are package checks, not physical-device acceptance.

`npm run typecheck`, `npm run test:domain`, `npm run test:updates`, and web/Android bundle export. Automated checks cover trusted APK URLs, native version comparison, cache bypass/corruption, network errors, unconfigured OTA, and reload guards. Real EAS download/reload and Android signing compatibility still require the connected project and a device.
