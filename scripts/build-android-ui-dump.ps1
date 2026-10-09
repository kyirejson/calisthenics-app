[CmdletBinding()]
param([string]$BuildToolsRoot = 'D:/UncoverBuildTools')
$ErrorActionPreference = 'Stop'
$qaSource = Join-Path $PSScriptRoot 'android-ui-dump'
$qaOutput = Join-Path $BuildToolsRoot 'temp/android-ui-dump'
$qaJdk = Get-ChildItem -LiteralPath (Join-Path $BuildToolsRoot 'java17') -Directory | Select-Object -First 1 -ExpandProperty FullName
$qaSdk = Join-Path $BuildToolsRoot 'android-sdk'
$qaTools = Join-Path $qaSdk 'build-tools/36.0.0'
$qaAndroid = Join-Path $qaSdk 'platforms/android-36/android.jar'
$qaKey = Join-Path $BuildToolsRoot 'run-map-20261008/android/app/debug.keystore'
$qaOldJava = $env:JAVA_HOME
$qaOldPath = $env:PATH
try {
  $env:JAVA_HOME = $qaJdk; $env:PATH = (Join-Path $qaJdk 'bin') + ';' + $env:PATH
  New-Item -ItemType Directory -Force -Path (Join-Path $qaOutput 'classes'), (Join-Path $qaOutput 'dex') | Out-Null
  & (Join-Path $qaJdk 'bin/javac.exe') -encoding UTF-8 -source 8 -target 8 -cp $qaAndroid -d (Join-Path $qaOutput 'classes') (Join-Path $qaSource 'DumpInstrumentation.java')
  if ($LASTEXITCODE -ne 0) { throw 'UI dump Java compilation failed' }
  & (Join-Path $qaTools 'd8.bat') --lib $qaAndroid --min-api 24 --output (Join-Path $qaOutput 'dex') (Join-Path $qaOutput 'classes/com/uncover/uidump/DumpInstrumentation.class')
  if ($LASTEXITCODE -ne 0) { throw 'UI dump DEX compilation failed' }
  & (Join-Path $qaTools 'aapt2.exe') link -I $qaAndroid --manifest (Join-Path $qaSource 'AndroidManifest.xml') -o (Join-Path $qaOutput 'unsigned.apk')
  if ($LASTEXITCODE -ne 0) { throw 'UI dump manifest compilation failed' }
  & (Join-Path $qaJdk 'bin/jar.exe') uf (Join-Path $qaOutput 'unsigned.apk') -C (Join-Path $qaOutput 'dex') classes.dex
  if ($LASTEXITCODE -ne 0) { throw 'UI dump APK packaging failed' }
  & (Join-Path $qaTools 'zipalign.exe') -f 4 (Join-Path $qaOutput 'unsigned.apk') (Join-Path $qaOutput 'aligned.apk')
  if ($LASTEXITCODE -ne 0) { throw 'UI dump APK alignment failed' }
  & (Join-Path $qaTools 'apksigner.bat') sign --ks $qaKey --ks-pass pass:android --key-pass pass:android --out (Join-Path $qaOutput 'ui-dump.apk') (Join-Path $qaOutput 'aligned.apk')
  if ($LASTEXITCODE -ne 0) { throw 'UI dump test signing failed' }
  Write-Host ('Emulator-only UI test helper: ' + (Join-Path $qaOutput 'ui-dump.apk'))
} finally { $env:JAVA_HOME = $qaOldJava; $env:PATH = $qaOldPath }
