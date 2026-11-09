# Her hands on Windows, always on: one PowerShell that stays up, so a key, a click or a song control doesn't wait for
# a new one to start each time (half a second). helper.js writes one JSON request per line, this answers one JSON per
# line: { id, line } for what a script says as it goes, { id, done, result | error } at the end. Only her own scripts,
# named below, ever run here.

$ErrorActionPreference = 'SilentlyContinue'
$utf8 = New-Object System.Text.UTF8Encoding($false)
[Console]::InputEncoding = $utf8
[Console]::OutputEncoding = $utf8
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$scripts = @('media.ps1', 'type.ps1', 'click.ps1')

Add-Type -Namespace CapriHelper -Name Win -MemberDefinition @'
[DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, System.UIntPtr extra);
[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, System.Text.StringBuilder s, int n);
'@
# loaded now, so her first click doesn't wait for them
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
try {
  $providers = [System.Reflection.Assembly]::LoadWithPartialName('UIAutomationClientsideProviders')
  [System.Windows.Automation.ClientSettings]::RegisterClientSideProviderAssembly($providers.GetName())
} catch { }

function Send($o) {
  [Console]::Out.WriteLine(($o | ConvertTo-Json -Compress -Depth 4))
  [Console]::Out.Flush()
}

Send @{ id = 0; line = 'ready' }

while ($true) {
  $text = [Console]::In.ReadLine()
  if ($null -eq $text) { break } # she's gone: so is this
  $id = 0
  try {
    $req = $text | ConvertFrom-Json
    $id = $req.id
    if ($req.op -eq 'ping') {
      Send @{ id = $id; done = $true; result = @{ ok = $true } }
    } elseif ($req.op -eq 'keys') {
      # 1: KEYEVENTF_EXTENDEDKEY, 3: and KEYEVENTF_KEYUP
      for ($i = 0; $i -lt [int]$req.times; $i++) {
        [CapriHelper.Win]::keybd_event([byte]$req.vk, 0, 1, [UIntPtr]::Zero)
        [CapriHelper.Win]::keybd_event([byte]$req.vk, 0, 3, [UIntPtr]::Zero)
      }
      Send @{ id = $id; done = $true; result = @{ ok = $true } }
    } elseif ($req.op -eq 'title') {
      $s = New-Object System.Text.StringBuilder 512
      [void][CapriHelper.Win]::GetWindowText([IntPtr][long]$req.hwnd, $s, 512)
      Send @{ id = $id; done = $true; result = @{ title = $s.ToString() } }
    } elseif ($req.op -eq 'script' -and $scripts -contains $req.file) {
      $params = @{}
      foreach ($p in $req.params.PSObject.Properties) { $params[$p.Name] = $p.Value }
      & (Join-Path $here $req.file) @params | ForEach-Object { Send @{ id = $id; line = [string]$_ } }
      Send @{ id = $id; done = $true }
    } else {
      Send @{ id = $id; done = $true; error = 'unknown' }
    }
  } catch {
    Send @{ id = $id; done = $true; error = [string]$_.Exception.Message }
  }
}
