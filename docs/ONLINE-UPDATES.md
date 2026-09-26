# Uncover online updates

## Current status

Code integration is complete. Expo login/project connection and device acceptance remain required. No OTA update is published by pushing code. When unconfigured, OTA is explicitly disabled; Android can still check GitHub APK releases. Web is a development preview, not an OTA device.

## User flow

- Automatic checks on safe home/tab screens and foreground return, at most every six hours; manual checks bypass cache.
- A higher native APK build number takes priority over a content update. APK downloads open the system browser; installation is confirmed by Android, not silent.
- Compatible content updates download through expo-updates, report native download progress, and require the user to tap to reload.
- No reload while a training/running/detail screen is active or the app is in the background. Training exits await record persistence before returning to the tabs.
- Failed checks/downloads do not erase training data or claim success. Existing app remains usable offline.
- Native runtime compatibility uses the Expo fingerprint policy. Permissions/native dependencies/SDK changes require another APK.

## Connect Expo later

1. Log in locally: `npx eas-cli@latest login` (never commit credentials).
2. Link/create the intended project: `npx eas-cli@latest init`. Confirm the owner before creating an external project.
3. Store the resulting public project UUID in `app.json` under `expo.extra.eas.projectId`, or set `EXPO_PROJECT_ID` in the build environment. Do not invent a UUID. Dynamic config produces `https://u.expo.dev/<UUID>`.
4. Build a new APK that includes expo-updates, using `npx eas-cli@latest build --platform android --profile preview`. The old installed APK cannot acquire a missing native updater through OTA.
5. Keep the existing package ID and verify the signing certificate against the APK already installed. Existing GitHub builds use a test signing setup; do not claim a new production key can overwrite them. Preserve the correct keystore securely before production.
6. Test an innocuous content change on the preview channel. Check popup/download/restart, offline failure, partial training persistence and fallback on a physical Android device.

## Publish content updates

The manual GitHub workflow `Publish content update (manual)` requires repository/environment secret `EXPO_TOKEN` and variable `EXPO_PROJECT_ID`. Select preview or production explicitly. Protect the production environment with approval in GitHub settings. Nothing runs on ordinary code push.

Alternatively, with an authenticated local account and matching asset set:

```sh
npx eas-cli@latest update --channel preview --environment preview --message "Describe the tested change"
```

Use the same channel/project and compatible native fingerprint as the installed APK. Production APKs must use `production`; preview APKs use `preview`. The dynamic app config writes channel headers for non-EAS builds as well.

## APK releases

Increment `expo.android.versionCode` before releasing a new binary; also update the human version and iOS build number as appropriate. Release notes must contain separate `App version: ...` and `Android versionCode: ...` lines and an APK attachment in this repository's Releases. Stable builds ignore prereleases. APK comparison reads the installed native build number, not OTA JavaScript config.

## Private resources and public source code

Book excerpts, book images, derived skill/demon photos and raw downloaded sources remain local, excluded from Git. `npm ci` generates empty resource maps only when book maps do not exist; local originals are never overwritten. Without separately provisioned licensed resources, public builds will not contain those book illustrations/full texts. The generated demonstration images are included. Public CI skips only the private-book resource test, not training/update logic tests. Do not publish a full-resource build until distribution rights are confirmed.

## Verification

`npm run typecheck`, `npm run test:domain`, `npm run test:updates`, and web/Android bundle export. Automated checks cover trusted APK URLs, native version comparison, cache bypass/corruption, network errors, unconfigured OTA, and reload guards. Real EAS download/reload and Android signing compatibility still require the connected project and a device.
