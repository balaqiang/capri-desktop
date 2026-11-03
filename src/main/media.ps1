# What's playing, controlled through Windows' media session (the one on the volume flyout): Spotify first, else
# whatever plays. Repeat, shuffle, back to the start, a jump forward or back, next, previous, play, pause. No login,
# no keys pressed. One JSON line: { ok, app, why, repeat, shuffle }.
#
#   powershell -File media.ps1 <next|previous|play|pause|toggle|repeat-one|repeat-all|repeat-off|shuffle-on|shuffle-off|restart|seek> [seconds]

param([string]$Action = 'toggle', [double]$Seconds = 0)
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [Text.Encoding]::UTF8

function Done($o) { $o | ConvertTo-Json -Compress; exit }

try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
  })[0]
  $null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
  function Await($op, [Type]$type) {
    $task = $asTask.MakeGenericMethod($type).Invoke($null, @($op))
    if ($task.Wait(4000)) { return $task.Result } else { return $null }
  }
  $manager = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
} catch { Done @{ ok = $false; why = 'nowinrt' } }
if (-not $manager) { Done @{ ok = $false; why = 'nosession' } }

# Spotify's session if there is one, else the one playing, else the one Windows shows
$sessions = @($manager.GetSessions())
$session = $sessions | Where-Object { $_.SourceAppUserModelId -match 'spotify' } | Select-Object -First 1
if (-not $session) { $session = $sessions | Where-Object { [int]$_.GetPlaybackInfo().PlaybackStatus -eq 4 } | Select-Object -First 1 }
if (-not $session) { $session = $manager.GetCurrentSession() }
if (-not $session) { Done @{ ok = $false; why = 'nosession' } }

$app = [string]$session.SourceAppUserModelId
if ($app.Contains('!')) { $app = $app.Substring($app.IndexOf('!') + 1) }
$app = $app -replace '\.exe$', ''
$info = $session.GetPlaybackInfo()
$can = $info.Controls
$op = $null
$why = ''
switch ($Action) {
  'next' { if ($can.IsNextEnabled) { $op = $session.TrySkipNextAsync() } else { $why = 'unsupported' } }
  'previous' { if ($can.IsPreviousEnabled) { $op = $session.TrySkipPreviousAsync() } else { $why = 'unsupported' } }
  'play' { $op = $session.TryPlayAsync() }
  'pause' { $op = $session.TryPauseAsync() }
  'toggle' { $op = $session.TryTogglePlayPauseAsync() }
  { $_ -like 'repeat-*' } {
    if (-not $can.IsRepeatEnabled) { $why = 'unsupported'; break }
    $mode = @{ 'repeat-one' = 1; 'repeat-all' = 2; 'repeat-off' = 0 }[$Action] # Track, List, None
    $op = $session.TryChangeAutoRepeatModeAsync([Windows.Media.MediaPlaybackAutoRepeatMode]$mode)
  }
  { $_ -like 'shuffle-*' } {
    if (-not $can.IsShuffleEnabled) { $why = 'unsupported'; break }
    $op = $session.TryChangeShuffleActiveAsync($Action -eq 'shuffle-on')
  }
  { $_ -eq 'restart' -or $_ -eq 'seek' } {
    if (-not $can.IsPlaybackPositionEnabled) { $why = 'unsupported'; break }
    $tl = $session.GetTimelineProperties()
    $pos = $tl.Position.TotalSeconds
    if ([int]$info.PlaybackStatus -eq 4 -and $tl.LastUpdatedTime.Year -gt 2000) { $pos += ([DateTimeOffset]::Now - $tl.LastUpdatedTime).TotalSeconds }
    $to = if ($Action -eq 'restart') { 0 } else { [Math]::Max(0, [Math]::Min($tl.EndTime.TotalSeconds - 1, $pos + $Seconds)) }
    $op = $session.TryChangePlaybackPositionAsync([long]($to * 10000000))
  }
  default { $why = 'unknown' }
}
$ok = $false
if ($op) { $ok = [bool](Await $op ([bool])) }
if (-not $ok -and -not $why) { $why = 'refused' }
Start-Sleep -Milliseconds 250
$after = $session.GetPlaybackInfo()
Done @{ ok = $ok; app = $app; why = $why; repeat = [string]$after.AutoRepeatMode; shuffle = [bool]$after.IsShuffleActive }
