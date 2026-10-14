param([Parameter(Mandatory=$true)][string]$OutputDirectory)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$voiceFixtureRoot = [IO.Path]::GetFullPath($OutputDirectory)
if (!$voiceFixtureRoot.StartsWith('D:\UncoverBuildTools\voice-agent-20261014\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Unexpected fixture output directory' }
New-Item -ItemType Directory -Path $voiceFixtureRoot -Force | Out-Null
$voiceFixtureSynth = [System.Speech.Synthesis.SpeechSynthesizer]::new()
try {
  $voiceFixtureSynth.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Female, [System.Speech.Synthesis.VoiceAge]::Adult, 0, [Globalization.CultureInfo]::GetCultureInfo('en-US'))
  foreach ($voiceFixtureName in @('black', 'hey-black', 'negative')) {
    $voiceFixtureSynth.SetOutputToWaveFile((Join-Path $voiceFixtureRoot ($voiceFixtureName + '.wav')))
    $voiceFixtureSynth.Speak(@{black='Black.'; 'hey-black'='Hey Black.'; negative='Today I would like to listen to some music.'}[$voiceFixtureName])
    $voiceFixtureSynth.SetOutputToNull()
  }
} finally { $voiceFixtureSynth.Dispose() }
Write-Output 'Synthetic wake/negative audio generated. These are not recordings of a user.'
