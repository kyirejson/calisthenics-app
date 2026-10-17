param(
  [Parameter(Mandatory=$true)][string]$ProjectRoot,
  [Parameter(Mandatory=$true)][ValidatePattern('^emulator-\d+$')][string]$AndroidSerial,
  [string]$BuildToolsRoot = 'D:/UncoverBuildTools'
)
$ErrorActionPreference = 'Stop'
$adb = Join-Path $BuildToolsRoot 'android-sdk/platform-tools/adb.exe'
$name = @(& $adb -s $AndroidSerial emu avd name | ForEach-Object { $_.Trim() })
if ($LASTEXITCODE -ne 0 -or $name -notcontains 'UncoverRun35') { throw 'Only the owned UncoverRun35 emulator may be used.' }
$apkFolder = Join-Path $ProjectRoot 'modules/uncover-device/android/build/outputs/apk/androidTest/debug'
$metadata = Get-Content -LiteralPath (Join-Path $apkFolder 'output-metadata.json') -Raw | ConvertFrom-Json
if ($metadata.applicationId -ne 'uncover.device.test') { throw 'Not the isolated phone fixture APK.' }
$apk = Join-Path $apkFolder $metadata.elements[0].outputFile
& $adb -s $AndroidSerial install -r $apk
if ($LASTEXITCODE -ne 0) { throw 'Test APK install failed.' }
# These are the owned, empty fixture's permissions, never production app or physical-phone grants.
& $adb -s $AndroidSerial shell pm grant uncover.device.test android.permission.POST_NOTIFICATIONS
if ($LASTEXITCODE -ne 0) { throw 'Fixture notification grant failed.' }
& $adb -s $AndroidSerial shell appops set uncover.device.test SCHEDULE_EXACT_ALARM allow
if ($LASTEXITCODE -ne 0) { throw 'Fixture alarm grant failed.' }
$output = (& $adb -s $AndroidSerial shell am instrument -w -r -e class uncover.device.ReminderDeliveryTest uncover.device.test/android.test.InstrumentationTestRunner) -join "`n"
Write-Output $output
if ($LASTEXITCODE -ne 0 -or $output -notmatch 'OK \(\d+ tests\)' -or $output -notmatch 'reminderId=(?<reminder>[a-f0-9-]+)') { throw 'Reminder instrumentation did not schedule a real reminder.' }
$reminderId = $Matches['reminder']
& $adb -s $AndroidSerial shell input keyevent KEYCODE_HOME
& $adb -s $AndroidSerial shell am kill uncover.device.test
$stopped = $false
for ($attempt = 0; $attempt -lt 10; $attempt++) {
  $pidText = (& $adb -s $AndroidSerial shell pidof uncover.device.test) -join ''
  if (!$pidText.Trim()) { $stopped = $true; break }
  Start-Sleep -Milliseconds 200
}
if (!$stopped) { throw 'Could not establish that the app process exited; delivery test not accepted.' }
Write-Output 'Confirmed: fixture process absent before the scheduled time. Waiting for Android receiver delivery.'
$deadline = [DateTime]::UtcNow.AddSeconds(40)
while ([DateTime]::UtcNow -lt $deadline) {
  $notifications = (& $adb -s $AndroidSerial shell dumpsys notification --noredact) -join "`n"
  if ($notifications -match ('(?s)NotificationRecord[^\n]*pkg=uncover\.device\.test[^\n]*tag=' + [regex]::Escape($reminderId)) -and $notifications -match 'MAX_REMINDER_PROCESS_EXIT_FIXTURE') {
    Write-Output ('PASS real local reminder notification delivered after process exit; id=' + $reminderId)
    exit 0
  }
  Start-Sleep -Seconds 1
}
throw 'No matching real notification after process exit; inspect the owned emulator alarm/notification state.'
