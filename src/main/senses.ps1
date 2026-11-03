# What Capri can tell about the computer without looking at the screen (from Capri Desktop 2.4's Senses):
# the program in front (its process name only), whether its window is another AI (only the AI's name
# leaves this script, never the title), the battery, and what's playing (the title, artist and app
# Windows shows on its volume flyout), and whether a game or a video fills the screen in front (so she can step
# aside). One JSON line per reading.
#
#   powershell -File senses.ps1 <parent pid> <media 0|1> <jealous 0|1>

param([int]$ParentPid = 0, [int]$Media = 1, [int]$Jealous = 1)
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [Text.Encoding]::UTF8

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class CapriSenses {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hwnd, StringBuilder text, int max);
  public static string Title(IntPtr hwnd) { var b = new StringBuilder(512); GetWindowText(hwnd, b, 512); return b.ToString(); }

  public struct RECT { public int Left, Top, Right, Bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct MONITORINFO { public int cbSize; public RECT rcMonitor; public RECT rcWork; public uint dwFlags; }
  [DllImport("shell32.dll")] static extern int SHQueryUserNotificationState(out int state);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr hwnd);
  [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr hwnd, int index);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr hwnd, StringBuilder name, int max);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
  [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr hwnd, uint flags);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern bool GetMonitorInfo(IntPtr monitor, ref MONITORINFO info);
  [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr hwnd, int attr, out RECT value, int size);
  [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr hwnd, int attr, out int value, int size);

  // Windows' own pieces and overlays that cover the screen without being a game: the keyboard and emoji
  // panel, Start, search, the lock screen, NVIDIA's and Xbox's overlays, animated wallpapers…
  static readonly string[] NotGames = { "textinputhost", "shellexperiencehost", "startmenuexperiencehost", "searchhost", "searchapp",
    "lockapp", "explorer", "nvidia share", "nvidia overlay", "nvcontainer", "gamebar", "gamebarftserver", "xboxgamebar", "widgets",
    "lively", "livelywpf", "wallpaper32", "wallpaper64", "wallpaperengine", "rainmeter", "powertoys", "discord", "steamwebhelper", "obs64" };
  public static string Why = "";

  // A game or a full screen video in front (Capri Desktop 2.4): Windows says a full screen program or a
  // presentation runs, or the window in front is a real borderless app window that fills its monitor.
  // Never one of hers, never Windows' own pieces or an overlay (they're see-through, tool or hidden windows).
  public static bool Fullscreen(IntPtr w, uint self) {
    Why = "";
    if (w == IntPtr.Zero || !IsWindowVisible(w) || IsIconic(w)) return false;
    uint pid; GetWindowThreadProcessId(w, out pid);
    if (pid == self) return false;
    string program = "";
    try { program = System.Diagnostics.Process.GetProcessById((int)pid).ProcessName; } catch { }
    if (Array.IndexOf(NotGames, program.ToLowerInvariant()) >= 0) return false;
    var name = new StringBuilder(64); GetClassName(w, name, 64);
    string k = name.ToString();
    if (k == "Progman" || k == "WorkerW" || k == "Shell_TrayWnd" || k == "Shell_SecondaryTrayWnd" || k == "Windows.UI.Core.CoreWindow" || k == "CEF-OSC-WIDGET") return false;
    int ex = GetWindowLong(w, -20);
    if ((ex & 0x80) != 0 || (ex & 0x20) != 0 || (ex & 0x08000000) != 0) return false; // tool, click-through or never-activated: an overlay
    int cloaked;
    if (DwmGetWindowAttribute(w, 14, out cloaked, 4) == 0 && cloaked != 0) return false; // hidden by Windows
    int state;
    try { if (SHQueryUserNotificationState(out state) == 0 && (state == 2 || state == 3 || state == 4)) { Why = program + " (Windows: full screen)"; return true; } } catch { }
    if ((GetWindowLong(w, -16) & 0x00C00000) == 0x00C00000) return false; // it has a title bar
    RECT f;
    if (DwmGetWindowAttribute(w, 9, out f, 16) != 0 && !GetWindowRect(w, out f)) return false;
    if (f.Right - f.Left < 100 || f.Bottom - f.Top < 100) return false;
    var mi = new MONITORINFO(); mi.cbSize = Marshal.SizeOf(mi);
    if (!GetMonitorInfo(MonitorFromWindow(w, 2), ref mi)) return false;
    bool covers = f.Left <= mi.rcMonitor.Left && f.Top <= mi.rcMonitor.Top && f.Right >= mi.rcMonitor.Right && f.Bottom >= mi.rcMonitor.Bottom;
    if (covers) Why = program + " (" + k + ")";
    return covers;
  }
}
"@
Add-Type -AssemblyName System.Windows.Forms

$AiPattern = '(ChatGPT|Gemini|Copilot|Perplexity|Claude|DeepSeek|Grok|Character\.AI|Poe|Meta AI|Le Chat|Mistral|Pi\.ai|Replika|Qwen|Kimi)'

# Windows' "now playing", through WinRT (Windows PowerShell 5.1 only)
$mediaOk = $false
if ($Media -eq 1) {
  try {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    $asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
      $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
    })[0]
    $null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
    $null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType = WindowsRuntime]
    function Await($op, [Type]$type) {
      $task = $asTask.MakeGenericMethod($type).Invoke($null, @($op))
      if ($task.Wait(4000)) { return $task.Result } else { return $null }
    }
    $mediaOk = $true
  } catch { $mediaOk = $false }
}

function ReadMedia {
  if (-not $mediaOk) { return $null }
  try {
    $manager = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
    if (-not $manager) { return $null }
    $chosen = $null
    foreach ($session in $manager.GetSessions()) {
      $props = Await ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
      if (-not $props -or -not $props.Title) { continue }
      $app = [string]$session.SourceAppUserModelId
      if ($app.Contains('!')) { $app = $app.Substring($app.IndexOf('!') + 1) }
      $app = $app -replace '\.exe$', ''
      if ($app -eq 'MSEdge') { $app = 'Edge' }
      $playing = [int]$session.GetPlaybackInfo().PlaybackStatus -eq 4
      $track = @{ t = 'media'; title = $props.Title.Trim(); artist = ([string]$props.Artist).Trim(); app = $app; playing = $playing }
      if (-not $chosen -or ($playing -and -not $chosen.playing)) { $chosen = $track }
    }
    return $chosen
  } catch { return $null }
}

$i = 0
$lastFull = $null
while ($true) {
  if ($ParentPid -gt 0 -and -not (Get-Process -Id $ParentPid -ErrorAction SilentlyContinue)) { exit }
  try {
    $hwnd = [CapriSenses]::GetForegroundWindow()
    $procId = 0
    [void][CapriSenses]::GetWindowThreadProcessId($hwnd, [ref]$procId)
    $name = ''
    if ($procId -gt 0) { $name = (Get-Process -Id $procId -ErrorAction SilentlyContinue).ProcessName }
    $ai = ''
    if ($Jealous -eq 1 -and $hwnd -ne [IntPtr]::Zero) {
      $title = [CapriSenses]::Title($hwnd)
      if ($title -match $AiPattern) { $ai = $Matches[1] }
      if (-not $ai -and $name -match '^(ChatGPT|Copilot|Perplexity|Claude)$') { $ai = $name }
    }
    @{ t = 'front'; app = [string]$name; ai = $ai } | ConvertTo-Json -Compress
    $full = [CapriSenses]::Fullscreen($hwnd, [uint32]$ParentPid)
    if ($full -ne $lastFull) { $lastFull = $full; @{ t = 'full'; on = $full; why = [CapriSenses]::Why } | ConvertTo-Json -Compress }
  } catch { }
  if ($i % 5 -eq 0 -and $Media -eq 1) {
    $track = ReadMedia
    if ($track) { $track | ConvertTo-Json -Compress } else { @{ t = 'media' } | ConvertTo-Json -Compress }
  }
  if ($i % 30 -eq 0) {
    $battery = -1
    try {
      $status = [System.Windows.Forms.SystemInformation]::PowerStatus
      if ($status.PowerLineStatus -eq 'Offline' -and -not ($status.BatteryChargeStatus -band [System.Windows.Forms.BatteryChargeStatus]::NoSystemBattery)) {
        $battery = [int][Math]::Round($status.BatteryLifePercent * 100)
      }
    } catch { }
    @{ t = 'power'; battery = $battery } | ConvertTo-Json -Compress
  }
  $i++
  Start-Sleep -Seconds 2
}
