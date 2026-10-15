[CmdletBinding()]
param(
  [string]$JavaHome,
  [string]$AndroidSdk,
  [string]$NodeExecutable,
  [string]$ProjectRoot,
  [string]$BuildToolsRoot = 'D:/UncoverBuildTools',
  [ValidateSet('Native', 'DebugApk', 'ModuleTests', 'VoicePlaybackTests', 'VerifiedApk', 'StandaloneQaApk')][string]$Target = 'Native'
)

$ErrorActionPreference = 'Stop'
$buildRepoPath = Split-Path -Parent $PSScriptRoot
if ($ProjectRoot) { $buildRepoPath = (Resolve-Path -LiteralPath $ProjectRoot).Path }
if (!(Test-Path -LiteralPath (Join-Path $buildRepoPath 'android/gradlew.bat'))) { throw 'Generate the Android project with Expo prebuild first.' }
if (!$NodeExecutable) { $NodeExecutable = (Get-Command node -ErrorAction Stop).Source }
if (!(Test-Path -LiteralPath $NodeExecutable -PathType Leaf)) { throw 'Node executable not found.' }
if (!$JavaHome) {
  # Use the isolated build JDK, never replace the user's default Java installation.
  $buildJdkBase = Join-Path $BuildToolsRoot 'java17'
  $JavaHome = Get-ChildItem -LiteralPath $buildJdkBase -Directory -ErrorAction SilentlyContinue |
    Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'bin/java.exe') } |
    Sort-Object Name -Descending | Select-Object -First 1 -ExpandProperty FullName
}
if (!$JavaHome -or !(Test-Path -LiteralPath (Join-Path $JavaHome 'bin/java.exe'))) {
  throw 'Pass -JavaHome with a JDK 17 or newer, or install the isolated UncoverBuildTools/java17 JDK.'
}
$buildJavaVersion = & (Join-Path $JavaHome 'bin/java.exe') -version 2>&1 | Out-String
if ($LASTEXITCODE -ne 0 -or $buildJavaVersion -notmatch 'version "(?<major>\d+)\.') { throw 'Unable to determine JDK version.' }
if ([int]$Matches['major'] -lt 17) { throw 'Android build requires JDK 17 or newer.' }
if (!$AndroidSdk -and !$env:ANDROID_HOME -and !$env:ANDROID_SDK_ROOT) {
  $buildSdkDefault = Join-Path $BuildToolsRoot 'android-sdk'
  if (Test-Path -LiteralPath $buildSdkDefault -PathType Container) { $AndroidSdk = $buildSdkDefault }
}
if ($AndroidSdk -and !(Test-Path -LiteralPath $AndroidSdk -PathType Container)) { throw 'Android SDK directory not found.' }

$buildOldJavaHome = $env:JAVA_HOME
$buildOldPath = $env:PATH
$buildOldAndroidHome = $env:ANDROID_HOME
$buildOldSdkRoot = $env:ANDROID_SDK_ROOT
$buildOldGradleHome = $env:GRADLE_USER_HOME
$buildOldTemp = $env:TEMP
$buildOldTmp = $env:TMP
try {
  $env:JAVA_HOME = (Resolve-Path -LiteralPath $JavaHome).Path
  $env:PATH = (Join-Path $env:JAVA_HOME 'bin') + ';' + (Split-Path -Parent $NodeExecutable) + ';' + $env:PATH
  $env:GRADLE_USER_HOME = [IO.Path]::GetFullPath((Join-Path $BuildToolsRoot 'gradle'))
  $buildTempPath = [IO.Path]::GetFullPath((Join-Path $BuildToolsRoot 'temp'))
  [IO.Directory]::CreateDirectory($buildTempPath) | Out-Null
  $env:TEMP = $buildTempPath
  $env:TMP = $buildTempPath
  if ($AndroidSdk) {
    $env:ANDROID_HOME = (Resolve-Path -LiteralPath $AndroidSdk).Path
    $env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
  }
  Write-Host $buildJavaVersion.Trim()
  Push-Location (Join-Path $buildRepoPath 'android')
  try {
    $buildModuleTests = @(':uncover-running:testDebugUnitTest', ':uncover-music:testDebugUnitTest', ':uncover-voice:testDebugUnitTest')
    if ($Target -eq 'VoicePlaybackTests') {
      if ($env:ANDROID_SERIAL -notmatch '^emulator-\d+$') { throw 'VoicePlaybackTests requires ANDROID_SERIAL for an owned Android emulator; physical devices are not selected automatically.' }
      & (Join-Path $env:ANDROID_HOME 'platform-tools/adb.exe') -s $env:ANDROID_SERIAL get-state | Out-Null
      if ($LASTEXITCODE -ne 0) { throw 'Selected playback-test emulator is not available.' }
    }
    if ($Target -eq 'StandaloneQaApk') {
      $buildQaGradle = Get-Content -LiteralPath (Join-Path $buildRepoPath 'android/app/build.gradle') -Raw
      # A local test package must never overwrite the production app or use its signing key.
      if ($buildQaGradle -notmatch 'release\s*\{\s*applicationIdSuffix\s+["'']\.musicqa["'']' -or
          $buildQaGradle -notmatch '(?s)release\s*\{[^}]*signingConfig\s+signingConfigs\.debug') {
        throw 'StandaloneQaApk requires an isolated snapshot with release applicationIdSuffix ".musicqa" and the local debug signer.'
      }
      if (!$buildQaGradle.Contains('// Uncover: track model/tool ES modules in native JS bundle inputs.')) {
        throw 'Run Expo prebuild with the music config plugin first: .mjs/.cjs changes must invalidate the embedded JS bundle.'
      }
    }
    $buildGradleTask = if ($Target -eq 'VoicePlaybackTests') { ':uncover-voice:connectedDebugAndroidTest' } elseif ($Target -eq 'StandaloneQaApk') { $buildModuleTests + ':app:assembleRelease' } elseif ($Target -eq 'VerifiedApk') { $buildModuleTests + ':app:assembleDebug' } elseif ($Target -eq 'DebugApk') { ':app:assembleDebug' } elseif ($Target -eq 'ModuleTests') { $buildModuleTests } else { ':app:compileDebugKotlin' }
    # UTF-8 fixes Kotlin/Node path decoding, but C++ still needs an ASCII build snapshot.
    if ($Target -in @('DebugApk', 'ModuleTests', 'VoicePlaybackTests', 'VerifiedApk', 'StandaloneQaApk') -and $buildRepoPath -match '[^\x00-\x7F]') {
      throw 'Windows C++ builds and JVM test workers require an ASCII-path snapshot. Pass -ProjectRoot with that snapshot; do not move the original repository.'
    }
    $buildGradleArgs = @('-Dfile.encoding=UTF-8')
    if ($buildRepoPath -match '[^\x00-\x7F]') { $buildGradleArgs += '-Pandroid.overridePathCheck=true' }
    & ./gradlew.bat @buildGradleArgs $buildGradleTask --no-daemon --console=plain
    if ($LASTEXITCODE -ne 0) { throw "Android build failed with exit code $LASTEXITCODE. See Gradle output above." }
    if ($Target -in @('DebugApk', 'VerifiedApk', 'StandaloneQaApk')) {
      $buildApkRelative = if ($Target -eq 'StandaloneQaApk') { 'android/app/build/outputs/apk/release/app-release.apk' } else { 'android/app/build/outputs/apk/debug/app-debug.apk' }
      $buildApkPath = Join-Path $buildRepoPath $buildApkRelative
      if (!(Test-Path -LiteralPath $buildApkPath -PathType Leaf)) { throw 'Gradle finished without the expected debug APK.' }
      $buildBundlePath = Join-Path $buildRepoPath 'android/app/src/main/assets/index.android.bundle'
      $buildJsMode = if (Test-Path -LiteralPath $buildBundlePath) { 'embedded JS' } else { 'requires Metro' }
      if ($Target -eq 'StandaloneQaApk') {
        $buildAapt = Get-ChildItem -LiteralPath (Join-Path $env:ANDROID_HOME 'build-tools') -Filter 'aapt2.exe' -Recurse |
          Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
        if (!$buildAapt) { throw 'aapt2 is required to verify the isolated package.' }
        $buildBadging = & $buildAapt dump badging $buildApkPath | Out-String
        if ($LASTEXITCODE -ne 0 -or $buildBadging -notmatch "package: name='com\.zizhong\.jinjie\.musicqa'") { throw 'Unexpected QA APK application ID.' }
        Write-Host "Standalone QA APK: $buildApkPath (bundled JS; local debug signer; independent .musicqa package; not a production release)"
      } else {
        Write-Host "Debug APK: $buildApkPath ($buildJsMode; local debug signer, not a production release)"
      }
    }
  } finally { Pop-Location }
} finally {
  $env:JAVA_HOME = $buildOldJavaHome
  $env:PATH = $buildOldPath
  $env:ANDROID_HOME = $buildOldAndroidHome
  $env:ANDROID_SDK_ROOT = $buildOldSdkRoot
  $env:GRADLE_USER_HOME = $buildOldGradleHome
  $env:TEMP = $buildOldTemp
  $env:TMP = $buildOldTmp
}
