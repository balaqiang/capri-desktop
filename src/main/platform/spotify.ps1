# "Play X on Spotify" (from Capri Desktop 2.4): Spotify's search is already open; this finds the Play
# button for that song through Windows' accessibility interface (the one screen readers use), by name,
# in any language, and presses it. Prints one JSON line: what it pressed, or the buttons it saw.
#
#   powershell -File spotify.ps1 "<song>" "<learned verb>" <seconds>

param([string]$Query = '', [string]$Learned = '', [double]$Seconds = 12)
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$KnownVerbs = @('Play', 'Spela upp', 'Reproducir', 'Reproduzir', 'Lire', 'Riproduci', 'Afspelen', 'Odtwórz', 'Spill av', 'Afspil', 'Toista', 'Putar', 'Abspielen', 'Воспроизвести', 'Přehrát', 'Phát')

function HasVerb($names, $verb) { foreach ($n in $names) { if ($n -and $n.StartsWith("$verb ", 'OrdinalIgnoreCase')) { return $true } }; return $false }
function CountVerb($names, $verb) { $c = 0; foreach ($n in $names) { if ($n -and $n.StartsWith("$verb ", 'OrdinalIgnoreCase')) { $c++ } }; return $c }

# the word or two that start every Play button: the beginning most buttons share
function GuessVerb($names) {
  $two = @{}; $one = @{}
  foreach ($n in $names) {
    $w = ([string]$n).Trim().Split(' ')
    if ($w.Count -ge 3) { $k = $w[0] + ' ' + $w[1]; $two[$k] = 1 + [int]$two[$k] }
    if ($w.Count -ge 2) { $one[$w[0]] = 1 + [int]$one[$w[0]] }
  }
  $best = $null; $count = 3
  foreach ($e in $two.GetEnumerator()) { if ($e.Value -gt $count) { $best = $e.Key; $count = $e.Value } }
  if ($best) { return $best }
  foreach ($e in $one.GetEnumerator()) { if ($e.Value -gt $count) { $best = $e.Key; $count = $e.Value } }
  return $best
}

function Choose($names) {
  if ($Learned -and (HasVerb $names $Learned)) { return $Learned }
  foreach ($k in $KnownVerbs) { if (HasVerb $names $k) { return $k } }
  return GuessVerb $names
}

function Score($title, $wanted) {
  $words = @([regex]::Split($wanted.ToLowerInvariant(), "[^\p{L}\p{N}']+") | Where-Object { $_.Length -ge 2 -and $_ -ne 'the' })
  if ($words.Count -eq 0) { return 0 }
  $low = ([string]$title).ToLowerInvariant(); $hits = 0
  foreach ($w in $words) { if ($low.Contains($w)) { $hits++ } }
  return $hits / $words.Count
}

$deadline = (Get-Date).AddSeconds([Math]::Max(0.5, $Seconds))
$names = @(); $verb = $null; $seen = $false
while ((Get-Date) -lt $deadline) {
  $window = [IntPtr]::Zero
  foreach ($p in Get-Process -Name Spotify -ErrorAction SilentlyContinue) { if ($window -eq [IntPtr]::Zero -and $p.MainWindowHandle -ne [IntPtr]::Zero) { $window = $p.MainWindowHandle } }
  if ($window -ne [IntPtr]::Zero) {
    $root = [System.Windows.Automation.AutomationElement]::FromHandle($window)
    $cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button)
    $found = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $cond)
    $seen = $true
    $names = @(); foreach ($b in $found) { $names += [string]$b.Current.Name }
    $verb = Choose $names
    if ($verb) {
      $best = -1; $bestScore = 0.59
      for ($i = 0; $i -lt $names.Count; $i++) {
        if (-not $names[$i].StartsWith("$verb ", 'OrdinalIgnoreCase')) { continue }
        $s = Score $names[$i].Substring($verb.Length) $Query
        if ($s -gt $bestScore) { $bestScore = $s; $best = $i }
      }
      if ($best -ge 0) {
        $pattern = $null
        if ($found[$best].TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$pattern)) {
          $pattern.Invoke()
          $learn = ''; if ((CountVerb $names $verb) -ge 6) { $learn = $verb }
          @{ ok = $true; seen = $true; pressed = $names[$best]; verb = $learn } | ConvertTo-Json -Compress
          exit
        }
      }
    }
    # no row named after the song (Spotify's search shows its songs' Play buttons only under the pointer):
    # the Top result's Play button, once the search box says what we searched for (not a page from before).
    # It's named just "Play", right after the result's "More options for <title>"; the player bar's at the
    # bottom isn't it.
    $editCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Edit)
    $searched = $false
    foreach ($e in $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $editCond)) {
      $vp = $null
      if ($e.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$vp) -and (Score $vp.Current.Value $Query) -ge 0.6) { $searched = $true }
    }
    if ($searched) {
      $win = $root.Current.BoundingRectangle
      $plain = @($KnownVerbs) + @($Learned) | Where-Object { $_ }
      for ($i = 0; $i -lt $names.Count; $i++) {
        if (-not ($plain -contains $names[$i].Trim())) { continue }
        $r = $found[$i].Current.BoundingRectangle
        if ($r.Width -lt 40 -or ($r.Y - $win.Y) -gt ($win.Height - 130)) { continue }
        $what = ''
        for ($j = $i - 1; $j -ge [Math]::Max(0, $i - 4); $j--) { if ($names[$j] -match '\s(?:for|untuk)\s(.+)$') { $what = $Matches[1]; break } }
        $pattern = $null
        if ($found[$i].TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$pattern)) {
          $pattern.Invoke()
          @{ ok = $true; seen = $true; pressed = $names[$i]; top = $what; verb = '' } | ConvertTo-Json -Compress
          exit
        }
      }
    }
  }
  Start-Sleep -Milliseconds 500
}
@{ ok = $false; seen = $seen; verb = ''; used = [string]$verb; names = @($names | Select-Object -First 200) } | ConvertTo-Json -Compress
