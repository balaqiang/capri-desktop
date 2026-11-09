# A button pressed for you by its name ("click the Send button"), through Windows' UI Automation: in one window only
# (the one you were in, or the app you named), only something enabled and on screen. One JSON line:
# { ok, name, app } or { ok: false, why, seen }. Apps that show Windows nothing about their buttons (some games, some
# web pages) can't be done this way: why = 'notfound'.
#
#   powershell -File click.ps1 -Name Send [-Hwnd 123 | -Process Notepad,notepad]

param([string]$Name = '', [long]$Hwnd = 0, [string]$Process = '')
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [Text.Encoding]::UTF8

function Done($o) { $o | ConvertTo-Json -Compress; exit }

Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
# what lets UI Automation tell a classic Windows button from a plain box (without it, they're all "Pane")
try {
  $providers = [System.Reflection.Assembly]::LoadWithPartialName('UIAutomationClientsideProviders')
  [System.Windows.Automation.ClientSettings]::RegisterClientSideProviderAssembly($providers.GetName())
} catch { }
Add-Type -Namespace CapriClick -Name Win -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
[DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
[DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, System.UIntPtr extra);
'@

if ($Process) {
  $found = Get-Process -Name ($Process -split ',') | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
  if (-not $found) { Done @{ ok = $false; why = 'nowindow' } }
  $Hwnd = $found.MainWindowHandle.ToInt64()
}
if (-not $Hwnd -or -not [CapriClick.Win]::IsWindow([IntPtr]$Hwnd)) { Done @{ ok = $false; why = 'nowindow' } }

$ae = [System.Windows.Automation.AutomationElement]
$root = $ae::FromHandle([IntPtr]$Hwnd)
if (-not $root) { Done @{ ok = $false; why = 'nowindow' } }
$app = (Get-Process -Id $root.Current.ProcessId).ProcessName

$types = @('Button', 'SplitButton', 'Hyperlink', 'MenuItem', 'TabItem', 'ListItem', 'CheckBox', 'RadioButton') | ForEach-Object {
  New-Object System.Windows.Automation.PropertyCondition($ae::ControlTypeProperty, [System.Windows.Automation.ControlType]::$_)
}
$any = New-Object System.Windows.Automation.OrCondition -ArgumentList (,[System.Windows.Automation.Condition[]]$types)
$scope = [System.Windows.Automation.TreeScope]::Descendants
$all = $root.FindAll($scope, $any)
# nothing of that kind by that name: anything at all called exactly that (apps drawing their own buttons)
$named = New-Object System.Windows.Automation.PropertyCondition($ae::NameProperty, $Name, [System.Windows.Automation.PropertyConditionFlags]::IgnoreCase)

function Tidy([string]$s) {
  ($s -replace '&', '' -replace '\s*\([^)]*\)\s*$', '' -replace '[.…]+\s*$', '' -replace '\s+', ' ').Trim().ToLowerInvariant()
}

$want = Tidy $Name
$wantWord = '(^|\W)' + [regex]::Escape($want) + '($|\W)'
$best = $null
$bestScore = 0
$seen = New-Object System.Collections.ArrayList
foreach ($el in $all) {
  $c = $el.Current
  if ($c.IsOffscreen -or -not $c.IsEnabled -or -not $c.Name) { continue }
  $label = Tidy $c.Name
  if ($seen.Count -lt 8 -and $c.ControlType -eq [System.Windows.Automation.ControlType]::Button -and $seen -notcontains $c.Name -and $c.Name.Length -le 30) { [void]$seen.Add($c.Name) }
  $score = 0
  if ($label -eq $want) { $score = 3 }
  elseif ($label.StartsWith("$want ")) { $score = 2 }
  elseif ($label -match $wantWord) { $score = 1 }
  if ($score -gt $bestScore) { $best = $el; $bestScore = $score }
  if ($score -eq 3) { break }
}
if (-not $best) { $best = $root.FindFirst($scope, $named) }
if (-not $best -or -not $best.Current.IsEnabled -or $best.Current.IsOffscreen) { Done @{ ok = $false; why = 'notfound'; app = $app; seen = @($seen) } }

$label = $best.Current.Name
$p = $null
if ($best.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$p)) { $p.Invoke() }
elseif ($best.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern, [ref]$p)) { $p.Toggle() }
elseif ($best.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern, [ref]$p)) { $p.Select() }
elseif ($best.TryGetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern, [ref]$p)) { $p.Expand() }
else {
  # no way to press it from here: the mouse, on its middle, with the window in front
  $r = $best.Current.BoundingRectangle
  if ($r.IsEmpty) { Done @{ ok = $false; why = 'notfound'; app = $app; seen = @($seen) } }
  [void][CapriClick.Win]::SetForegroundWindow([IntPtr]$Hwnd)
  Start-Sleep -Milliseconds 120
  [void][CapriClick.Win]::SetCursorPos([int]($r.X + $r.Width / 2), [int]($r.Y + $r.Height / 2))
  [CapriClick.Win]::mouse_event(2, 0, 0, 0, [UIntPtr]::Zero)
  [CapriClick.Win]::mouse_event(4, 0, 0, 0, [UIntPtr]::Zero)
}
Done @{ ok = $true; name = $label; app = $app }
