param([Parameter(Mandatory=$true)][string]$BuildId)
$ErrorActionPreference = 'Stop'
$publishRoot = Split-Path -Parent $PSScriptRoot
$releaseConfig = ([IO.File]::ReadAllText((Join-Path $publishRoot 'app.json')) | ConvertFrom-Json).expo
$releaseVersion = $releaseConfig.version
$releaseCode = [string]$releaseConfig.android.versionCode
$releaseTag = 'v' + $releaseVersion
$releaseAssetName = 'uncover-' + $releaseTag + '.apk'
$publishNode = 'D:/openclaw/node.exe'
$publishCli = 'D:/UncoverBuildTools/npm-cache/_npx/cdcf29a1293ceb8d/node_modules/eas-cli/bin/run'
function Get-ReleaseApk([string]$DownloadUri, [string]$Destination, [switch]$Resume) {
  for ($downloadAttempt = 1; $downloadAttempt -le 3; $downloadAttempt++) {
    $downloadArgs = @('--fail', '--location', '--silent', '--show-error', '--connect-timeout', '20', '--max-time', '600', '--output', $Destination)
    if ($Resume) { $downloadArgs += @('--continue-at', '-') }
    & curl.exe @downloadArgs $DownloadUri
    if ($LASTEXITCODE -eq 0) {
      return
    }
    if ($downloadAttempt -eq 3) { throw 'APK download failed after three attempts; no release published' }
    Write-Output 'APK download interrupted; retrying the same artifact.'
    Start-Sleep -Seconds 5
  }
}
function Read-ReleaseBuild {
  # Bound only this read-only CLI request; a stale network socket must not stall publishing.
  $queryInfo = [Diagnostics.ProcessStartInfo]::new()
  $queryInfo.FileName = $publishNode
  foreach ($queryArgument in @($publishCli, 'build:view', $BuildId, '--json')) { $queryInfo.ArgumentList.Add($queryArgument) }
  $queryInfo.WorkingDirectory = $publishRoot
  $queryInfo.UseShellExecute = $false
  $queryInfo.CreateNoWindow = $true
  $queryInfo.RedirectStandardOutput = $true
  $queryInfo.RedirectStandardError = $true
  $queryProcess = [Diagnostics.Process]::new()
  $queryProcess.StartInfo = $queryInfo
  try {
    [void]$queryProcess.Start()
    $queryOutputTask = $queryProcess.StandardOutput.ReadToEndAsync()
    $queryErrorTask = $queryProcess.StandardError.ReadToEndAsync()
    if (!$queryProcess.WaitForExit(45000)) {
      $queryProcess.Kill()
      [void]$queryProcess.WaitForExit(5000)
      return $null
    }
    $queryOutput = $queryOutputTask.GetAwaiter().GetResult()
    [void]$queryErrorTask.GetAwaiter().GetResult()
    if ($queryProcess.ExitCode -ne 0) { return $null }
    return $queryOutput | ConvertFrom-Json
  } finally { $queryProcess.Dispose() }
}
for ($attempt=0; $attempt -lt 40; $attempt++) {
  $build = Read-ReleaseBuild
  if (!$build) {
    Write-Output 'Build status query unavailable; retrying without resubmitting or publishing.'
    Start-Sleep -Seconds 40
    continue
  }
  Write-Output ('Build status: ' + $build.status)
  if ($build.status -eq 'FINISHED') { break }
  if ($build.status -in @('ERRORED','CANCELED')) { throw ('Build failed: ' + $build.status) }
  Start-Sleep -Seconds 40
}
if ($build.status -ne 'FINISHED') { throw 'Build not finished; no release published' }
if ($build.appIdentifier -ne 'com.zizhong.jinjie' -or $build.appVersion -ne $releaseVersion -or $build.appBuildVersion -ne $releaseCode) { throw 'Unexpected build identity' }
$artifactUri = [uri]$build.artifacts.applicationArchiveUrl
if ($artifactUri.Scheme -ne 'https' -or $artifactUri.Host -ne 'expo.dev') { throw 'Unexpected artifact URL' }
$apk = Join-Path 'D:/UncoverBuildTools/temp' $releaseAssetName
Get-ReleaseApk $artifactUri.AbsoluteUri $apk -Resume
$apkInfo = (& $publishNode (Join-Path $publishRoot 'scripts/inspect-apk-certificate.cjs') $apk | Out-String) | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Certificate extraction failed' }
$previous = Invoke-RestMethod -Uri 'https://api.github.com/repos/kyirejson/calisthenics-app/releases/latest'
$previousApk = $previous.assets | Where-Object { $_.name -like '*.apk' } | Select-Object -First 1
if (!$previousApk) { throw 'No previous release APK for signature comparison' }
$previousPath = 'D:/UncoverBuildTools/temp/uncover-previous-signature-check.apk'
Get-ReleaseApk $previousApk.browser_download_url $previousPath
$previousInfo = (& $publishNode (Join-Path $publishRoot 'scripts/inspect-apk-certificate.cjs') $previousPath | Out-String) | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $apkInfo.certificates[0].sha256 -ne $previousInfo.certificates[0].sha256) { throw 'Signer changed; publication stopped' }
$sdkTool = Get-ChildItem -LiteralPath 'D:/UncoverBuildTools/android-sdk/build-tools' -Directory | Sort-Object Name -Descending | Select-Object -First 1
$javaFolder = Get-ChildItem -LiteralPath 'D:/UncoverBuildTools/java17' -Directory | Select-Object -First 1
& (Join-Path $javaFolder.FullName 'bin/java.exe') -jar (Join-Path $sdkTool.FullName 'lib/apksigner.jar') verify --verbose $apk
if ($LASTEXITCODE -ne 0) { throw 'APK cryptographic signature verification failed' }
$badging = & (Join-Path $sdkTool.FullName 'aapt.exe') dump badging $apk
if ($LASTEXITCODE -ne 0 -or ($badging -join "`n") -notmatch ("package: name='com.zizhong.jinjie' versionCode='" + $releaseCode + "' versionName='" + [regex]::Escape($releaseVersion) + "'")) { throw 'APK manifest version mismatch' }
$apkPermissions = & (Join-Path $sdkTool.FullName 'aapt.exe') dump permissions $apk
if ($LASTEXITCODE -ne 0) { throw 'Unable to inspect APK permissions' }
foreach ($locationPermission in @('ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION', 'FOREGROUND_SERVICE', 'FOREGROUND_SERVICE_LOCATION', 'ACTIVITY_RECOGNITION')) {
  if (($apkPermissions -join "`n") -notmatch ('android.permission.' + $locationPermission + "'")) { throw ('Required running permission missing: ' + $locationPermission) }
}
if (($apkPermissions -join "`n") -match "android.permission.CAMERA'") { throw 'Removed camera permission unexpectedly present' }
if (($apkPermissions -join "`n") -match "android.permission.ACCESS_MOCK_LOCATION'") { throw 'Emulator QA permission must not enter the production APK' }
& $publishNode (Join-Path $publishRoot 'scripts/inspect-apk-running-diagnostics.cjs') $apk
if ($LASTEXITCODE -ne 0) { throw 'GPS repair missing from release artifact; publication stopped' }
$credential = "protocol=https`nhost=github.com`n`n" | git -C $publishRoot credential fill
$password = $credential | Where-Object { $_ -like 'password=*' } | Select-Object -First 1
if (!$password) { throw 'GitHub publishing credentials unavailable' }
$headers = @{ Authorization = 'Bearer ' + $password.Substring(9); 'User-Agent' = 'Uncover-release'; Accept = 'application/vnd.github+json' }
$api = 'https://api.github.com/repos/kyirejson/calisthenics-app/releases'
$body = [IO.File]::ReadAllText((Join-Path $publishRoot 'RELEASE-NOTES.md')) + "`n`nAPK SHA-256: " + $apkInfo.sha256 + "`nSigner verified against " + $previous.tag_name + "."
$releaseCommit = (git -C $publishRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $releaseCommit -notmatch '^[a-f0-9]{40}$') { throw 'Unable to resolve release source commit' }
if ($build.gitCommitHash -ne $releaseCommit) { throw 'Build source differs from the release source commit; publication stopped' }
$remoteCommit = (git -C $publishRoot ls-remote origin refs/heads/main).Split()[0]
if ($LASTEXITCODE -ne 0 -or $remoteCommit -ne $releaseCommit) { throw 'Release source must be synchronized to main before publication' }
$data = @{tag_name=$releaseTag;target_commitish=$releaseCommit;name=('Uncover ' + $releaseTag);body=$body;draft=$true;prerelease=$false} | ConvertTo-Json
$release = Invoke-RestMethod -Method Post -Uri $api -Headers $headers -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($data))
$upload = $release.upload_url.Split('{')[0] + '?name=' + $releaseAssetName
$asset = Invoke-RestMethod -Method Post -Uri $upload -Headers $headers -ContentType 'application/vnd.android.package-archive' -InFile $apk
if ($asset.size -ne (Get-Item -LiteralPath $apk).Length) { throw 'Uploaded asset size mismatch; release left as draft' }
if ($asset.digest -and $asset.digest -ne ('sha256:' + $apkInfo.sha256)) { throw 'Uploaded digest mismatch; release left as draft' }
$published = Invoke-RestMethod -Method Patch -Uri ($api + '/' + $release.id) -Headers $headers -ContentType 'application/json' -Body '{"draft":false,"make_latest":"true"}'
Write-Output ('PUBLISHED ' + $published.html_url)
Write-Output ('APK ' + ($published.assets | Where-Object { $_.id -eq $asset.id } | Select-Object -First 1).browser_download_url)
Write-Output ('SHA256 ' + $apkInfo.sha256)
