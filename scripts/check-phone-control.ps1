param(
  [Parameter(Mandatory=$true)][string]$ProjectRoot,
  [Parameter(Mandatory=$true)][ValidatePattern('^emulator-\d+$')][string]$AndroidSerial,
  [string]$AvdName = 'UncoverRun35',
  [string]$BuildToolsRoot = 'D:/UncoverBuildTools'
)
$ErrorActionPreference = 'Stop'
$adb = Join-Path $BuildToolsRoot 'android-sdk/platform-tools/adb.exe'
$name = @(& $adb -s $AndroidSerial emu avd name | ForEach-Object { $_.Trim() })
if ($LASTEXITCODE -ne 0 -or $name -notcontains $AvdName) { throw 'Refuse to operate a different emulator or any physical phone.' }
$apkFolder = Join-Path $ProjectRoot 'modules/uncover-device/android/build/outputs/apk/androidTest/debug'
$metadata = Get-Content -LiteralPath (Join-Path $apkFolder 'output-metadata.json') -Raw | ConvertFrom-Json
if ($metadata.applicationId -ne 'uncover.device.test' -or $metadata.variantName -ne 'debugAndroidTest') { throw 'Not the isolated phone-control test APK.' }
$apk = Join-Path $apkFolder $metadata.elements[0].outputFile
$aapt = Join-Path $BuildToolsRoot 'android-sdk/build-tools/36.0.0/aapt.exe'
$identity = & $aapt dump badging $apk
if ($LASTEXITCODE -ne 0 -or ($identity -join "`n") -notmatch "package: name='uncover.device.test'") { throw 'Test APK identity mismatch.' }
Get-FileHash -LiteralPath $apk -Algorithm SHA256 | Select-Object Hash,Path
& $adb -s $AndroidSerial install -r $apk
if ($LASTEXITCODE -ne 0) { throw 'Isolated test installation failed.' }
$previous = ((& $adb -s $AndroidSerial shell settings get secure enabled_accessibility_services) -join '').Trim()
$wasEnabled = ((& $adb -s $AndroidSerial shell settings get secure accessibility_enabled) -join '').Trim()
$entry = 'uncover.device.test/uncover.device.PhoneFixtureService'
$withoutTest = @($previous -split ':' | Where-Object { $_ -and $_ -ne 'null' -and $_ -ne $entry })
$services = @($withoutTest) + $entry
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$log = Join-Path $BuildToolsRoot ('temp/phone-control-' + $stamp + '.log')
$errors = $log + '.stderr'
$process = $null
function Read-SharedLog([string]$Path) {
  $stream = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite)
  $reader = [IO.StreamReader]::new($stream)
  try { return $reader.ReadToEnd() } finally { $reader.Dispose() }
}
try {
  & $adb -s $AndroidSerial shell settings put secure enabled_accessibility_services $(if ($withoutTest.Count) { $withoutTest -join ':' } else { 'null' })
  # am instrument force-stops its target. Bind only after its fresh process has started.
  $process = Start-Process -FilePath $adb -ArgumentList @('-s', $AndroidSerial, 'shell', 'am', 'instrument', '-w', '-r', '-e', 'class', 'uncover.device.PhoneControlTest', 'uncover.device.test/android.test.InstrumentationTestRunner') -WindowStyle Hidden -PassThru -RedirectStandardOutput $log -RedirectStandardError $errors
  $start = [DateTime]::UtcNow
  while (!$process.HasExited) {
    if ((Test-Path -LiteralPath $log) -and ((Read-SharedLog $log) -match 'INSTRUMENTATION_STATUS: test=')) { break }
    if (([DateTime]::UtcNow - $start).TotalSeconds -gt 25) { throw 'Instrumentation did not start; no production permissions changed.' }
    [void]$process.WaitForExit(200)
  }
  if (!$process.HasExited) {
    & $adb -s $AndroidSerial shell settings put secure enabled_accessibility_services ($services -join ':')
    & $adb -s $AndroidSerial shell settings put secure accessibility_enabled 1
  }
  while (!$process.WaitForExit(1000)) {
    if (([DateTime]::UtcNow - $start).TotalSeconds -gt 240) { throw 'Phone-control instrumentation timed out.' }
  }
  $result = [IO.File]::ReadAllText($log)
  Write-Output $result
  if ($process.ExitCode -ne 0 -or $result -notmatch 'OK \(\d+ tests\)' -or $result -match 'FAILURES!!!|Process crashed') { throw ('Phone-control tests failed; inspect ' + $log) }
  Write-Output 'PASS isolated synthetic messages, real system app/browser launch and optional local OCR. Not a real WeChat-send or Chinese-maps route acceptance.'
} finally {
  if ($process -and !$process.HasExited) { & $adb -s $AndroidSerial shell am force-stop uncover.device.test; [void]$process.WaitForExit(5000) }
  & $adb -s $AndroidSerial shell settings put secure enabled_accessibility_services $(if ($previous -and $previous -ne 'null') { $previous } else { 'null' })
  & $adb -s $AndroidSerial shell settings put secure accessibility_enabled $(if ($wasEnabled -in @('0','1')) { $wasEnabled } else { '0' })
  if ($process) { $process.Dispose() }
}
