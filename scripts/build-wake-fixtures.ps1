param([Parameter(Mandatory=$true)][string]$OutputDirectory, [switch]$OwnerEnrollment)
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
  if ($OwnerEnrollment) {
    $voiceOwnerTexts = @{
      'owner-enroll-1'='Black. Today I am planning my training and I want you to listen carefully while I explain my ideas.'
      'owner-enroll-2'='Black. I sometimes speak slowly and change my mind. Please wait until I finish my whole sentence.'
      'owner-enroll-3'='Black. Help me keep a record of my training, my daily meals and the music that I enjoy listening to.'
      'owner-wake-check'='Black.'
    }
    foreach ($voiceOwnerName in $voiceOwnerTexts.Keys) {
      $voiceFixtureSynth.Rate = if ($voiceOwnerName -eq 'owner-wake-check') { 1 } else { 0 }
      $voiceFixtureSynth.SetOutputToWaveFile((Join-Path $voiceFixtureRoot ($voiceOwnerName + '.wav')))
      $voiceFixtureSynth.Speak($voiceOwnerTexts[$voiceOwnerName]); $voiceFixtureSynth.SetOutputToNull()
    }
    $voiceFixtureSynth.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Male, [System.Speech.Synthesis.VoiceAge]::Adult, 0, [Globalization.CultureInfo]::GetCultureInfo('en-US'))
    $voiceFixtureSynth.SetOutputToWaveFile((Join-Path $voiceFixtureRoot 'other-wake.wav'))
    $voiceFixtureSynth.Speak('Black.'); $voiceFixtureSynth.SetOutputToNull()
  }
} finally { $voiceFixtureSynth.Dispose() }
Write-Output 'Synthetic wake/negative audio generated. These are not recordings of a user.'
