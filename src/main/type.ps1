# Typing for you in another app (Notepad, VS Code, Antigravity, a chat...): its window found (waited for, when you've
# just had her open it), brought to the front, and the text typed in as real keystrokes, any character (Unicode),
# then keys to press if you asked (Enter to send, Ctrl+S to save). Never into a window that isn't the one: if it
# can't be brought to the front, or you switch away while she types, she stops; a key of yours (Esc, a letter) stops
# her too, and she never types into a password box. The text comes base64 (UTF-8), so no character is lost on the way.
# Prints { found, app } once the window is in front (her show starts), then { ok, app, why }.
#
#   powershell -File type.ps1 [-Process "Notepad,notepad"] [-Title "part of a title"] [-Hwnd 123] [-B64 <the text, base64>] [-Keys "enter"] [-Wait 8000] [-Fresh 1]

param([string]$Process = '', [string]$Title = '', [long]$Hwnd = 0, [string]$B64 = '', [string]$Keys = '', [int]$Wait = 8000, [int]$Fresh = 0, [int]$Paste = 0)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
function Done($o) { $o | ConvertTo-Json -Compress; exit }

# (PowerShell's names ignore case: the words get a name of their own, never one of the parameters')
$words = ''
if ($B64) { $words = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($B64)) }

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Threading;
public static class CapriKeys {
  [StructLayout(LayoutKind.Sequential)] struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Sequential)] struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Explicit)] struct UNION { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
  [StructLayout(LayoutKind.Sequential)] struct INPUT { public uint type; public UNION u; }
  [DllImport("user32.dll", SetLastError = true)] static extern uint SendInput(uint n, INPUT[] inputs, int size);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  const uint KEYUP = 2, UNICODE = 4;

  // A classic password box has the keyboard's focus in that window (an Edit control with ES_PASSWORD: Windows'
  // own dialogs, older apps, WinForms), which UI Automation doesn't always call a password box.
  [StructLayout(LayoutKind.Sequential)] struct GUITHREADINFO { public int cbSize; public uint flags; public IntPtr hwndActive, hwndFocus, hwndCapture, hwndMenuOwner, hwndMoveSize, hwndCaret; public int left, top, right, bottom; }
  [DllImport("user32.dll")] static extern bool GetGUIThreadInfo(uint thread, ref GUITHREADINFO info);
  [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h, int index);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, System.Text.StringBuilder name, int size);
  public static bool PasswordBox(IntPtr h) {
    uint pid;
    var info = new GUITHREADINFO(); info.cbSize = Marshal.SizeOf(typeof(GUITHREADINFO));
    if (!GetGUIThreadInfo(GetWindowThreadProcessId(h, out pid), ref info) || info.hwndFocus == IntPtr.Zero) return false;
    var name = new System.Text.StringBuilder(256);
    GetClassName(info.hwndFocus, name, 256);
    return name.ToString().ToUpperInvariant().Contains("EDIT") && (GetWindowLong(info.hwndFocus, -16) & 0x20) != 0;
  }

  static INPUT Key(ushort vk, ushort scan, uint flags) {
    var i = new INPUT(); i.type = 1; i.u.ki.wVk = vk; i.u.ki.wScan = scan; i.u.ki.dwFlags = flags; return i;
  }
  static void Send(params INPUT[] inputs) { SendInput((uint)inputs.Length, inputs, Marshal.SizeOf(typeof(INPUT))); }

  // In front: restored if minimized, and Windows' lock on who may take the front lifted with an Alt tap.
  public static bool Focus(IntPtr h) {
    if (!IsWindow(h)) return false;
    if (IsIconic(h)) ShowWindow(h, 9);
    for (int i = 0; i < 8; i++) {
      if (GetForegroundWindow() == h) return true;
      keybd_event(0x12, 0, 0, UIntPtr.Zero); keybd_event(0x12, 0, KEYUP, UIntPtr.Zero);
      SetForegroundWindow(h); BringWindowToTop(h);
      Thread.Sleep(120);
    }
    return GetForegroundWindow() == h;
  }

  [DllImport("user32.dll")] static extern short VkKeyScanEx(char ch, IntPtr layout);
  [DllImport("user32.dll")] static extern IntPtr GetKeyboardLayout(uint thread);
  [DllImport("user32.dll")] static extern uint MapVirtualKeyEx(uint code, uint type, IntPtr layout);
  [DllImport("user32.dll")] static extern short GetKeyState(int vk);
  [DllImport("user32.dll")] static extern short GetAsyncKeyState(int vk);

  // A key you're pressing yourself (Esc, a letter, Space, Backspace, an arrow...): she stops for you. Hers are all up
  // by the time this looks (each is pressed and let go at once), but the last one or two may still read down for a
  // moment, so those are left out; so are keys held since before she started (the Enter that sent the command).
  static readonly int[] YOURS = BuildYours();
  static int[] BuildYours() {
    var keys = new System.Collections.Generic.List<int> { 0x08, 0x0D, 0x1B, 0x20, 0x25, 0x26, 0x27, 0x28, 0x2E };
    for (int k = 0x30; k <= 0x39; k++) keys.Add(k);
    for (int k = 0x41; k <= 0x5A; k++) keys.Add(k);
    foreach (int k in new[] { 0xBA, 0xBB, 0xBC, 0xBD, 0xBE, 0xBF, 0xC0, 0xDB, 0xDC, 0xDD, 0xDE }) keys.Add(k);
    return keys.ToArray();
  }
  static bool[] heldBefore = new bool[256];
  static void Snapshot() { foreach (int k in YOURS) heldBefore[k] = (GetAsyncKeyState(k) & 0x8000) != 0; }
  static bool YouPressed(int mine, int before) {
    foreach (int k in YOURS) {
      bool down = (GetAsyncKeyState(k) & 0x8000) != 0;
      if (!down) { heldBefore[k] = false; continue; }
      if (k == mine || k == before || heldBefore[k]) continue;
      return true;
    }
    return false;
  }

  // The text, a character at a time, the way a keyboard types it: a key on the window's own keyboard layout (with
  // Shift when it needs it, Caps Lock minded) for whatever is on it, and only what isn't (✓, 中文, emoji) as a
  // Unicode character, given more time. (All as Unicode, a fast burst came out wrong in Windows 11's Notepad: the
  // letters still waiting all turned into the last one, "Hello nnnnnnne".) Enter for a line break, Tab for a tab.
  // 0: typed; 1: the window in front stopped being this one; 2: you pressed a key (she stops for you).
  // soft: a line break is Shift+Enter (a chat box, a page in a browser: Enter there sends the message)
  public static int Type(IntPtr h, string text, bool soft) {
    uint pid;
    IntPtr layout = GetKeyboardLayout(GetWindowThreadProcessId(h, out pid));
    bool caps = (GetKeyState(0x14) & 1) != 0;
    int n = 0, last = 0, before = 0;
    Snapshot();
    foreach (char c in text) {
      if (c == '\r') continue;
      if (n++ % 20 == 0 && GetForegroundWindow() != h) return 1;
      if (YouPressed(last, before)) return 2;
      before = last;
      if (c == '\n') { if (soft) Press(0x0D, false, true, false); else Tap(0x0D); last = 0x0D; Thread.Sleep(12); continue; }
      if (c == '\t') { Tap(0x09); last = 0x09; Thread.Sleep(12); continue; }
      short scan = VkKeyScanEx(c, layout);
      int vk = scan & 0xFF, mods = (scan >> 8) & 0xFF;
      if (scan != -1 && vk != 0xFF && (mods & 6) == 0) {
        bool shift = (mods & 1) != 0;
        if (caps && vk >= 0x41 && vk <= 0x5A) shift = !shift; // Caps Lock on: a letter's Shift turns round
        ushort hw = (ushort)MapVirtualKeyEx((uint)vk, 0, layout);
        if (shift) Send(Key(0x10, (ushort)MapVirtualKeyEx(0x10, 0, layout), 0));
        Send(Key((ushort)vk, hw, 0), Key((ushort)vk, hw, KEYUP));
        if (shift) Send(Key(0x10, (ushort)MapVirtualKeyEx(0x10, 0, layout), KEYUP));
        last = vk;
        Thread.Sleep(9);
      } else {
        Send(Key(0, c, UNICODE), Key(0, c, UNICODE | KEYUP));
        last = 0;
        Thread.Sleep(25);
      }
    }
    return 0;
  }

  static void Tap(ushort vk) { Send(Key(vk, 0, 0), Key(vk, 0, KEYUP)); }

  // a key, with Ctrl / Shift / Alt held
  public static void Press(ushort vk, bool ctrl, bool shift, bool alt) {
    if (ctrl) Send(Key(0x11, 0, 0));
    if (shift) Send(Key(0x10, 0, 0));
    if (alt) Send(Key(0x12, 0, 0));
    Send(Key(vk, 0, 0), Key(vk, 0, KEYUP));
    if (alt) Send(Key(0x12, 0, KEYUP));
    if (shift) Send(Key(0x10, 0, KEYUP));
    if (ctrl) Send(Key(0x11, 0, KEYUP));
  }
}
"@

# the window: the one given, else the newest of the app's windows (by its process name, or a word of its title)
$target = [IntPtr]::Zero
$name = ''
$deadline = (Get-Date).AddMilliseconds($Wait)
$names = @($Process -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
do {
  if ($Hwnd -ne 0) {
    $target = [IntPtr]$Hwnd
    if ([CapriKeys]::IsWindow($target)) {
      $procId = (Get-Process | Where-Object { $_.MainWindowHandle -eq $target } | Select-Object -First 1)
      $name = if ($procId) { $procId.ProcessName } else { '' }
      break
    }
    Done @{ ok = $false; why = 'gone' }
  }
  # the app's window in front first (just opened, it comes up in front; Windows 11's Notepad keeps all its windows in
  # one process, whose "main" window can be an older one)
  $fg = [CapriKeys]::GetForegroundWindow()
  $fgPid = [uint32]0
  [void][CapriKeys]::GetWindowThreadProcessId($fg, [ref]$fgPid)
  $fgProc = if ($fgPid) { Get-Process -Id $fgPid -ErrorAction SilentlyContinue } else { $null }
  if ($fgProc -and (($names.Count -and ($names -contains $fgProc.ProcessName)) -or ($Title -and $fgProc.MainWindowTitle -like "*$Title*"))) {
    $target = $fg; $name = $fgProc.ProcessName; break
  }
  $found = @(Get-Process -ErrorAction SilentlyContinue | Where-Object {
    $_.MainWindowHandle -ne [IntPtr]::Zero -and (
      ($names.Count -and ($names -contains $_.ProcessName)) -or
      ($Title -and $_.MainWindowTitle -like "*$Title*"))
  } | Sort-Object StartTime -Descending)
  if ($found.Count) { $target = $found[0].MainWindowHandle; $name = $found[0].ProcessName; break }
  Start-Sleep -Milliseconds 250
} while ((Get-Date) -lt $deadline)
if ($target -eq [IntPtr]::Zero) { Done @{ ok = $false; why = 'nowindow' } }

# just opened: a moment for its editor to be ready for keys
if ($Fresh -eq 1) { Start-Sleep -Milliseconds 900 }
if (-not [CapriKeys]::Focus($target)) { Done @{ ok = $false; app = $name; why = 'focus' } }
# never into a password box (the box with the keyboard's focus: a classic one, or one UI Automation says is: a
# browser's, a modern app's)
function InPassword {
  if ([CapriKeys]::PasswordBox($target)) { return $true }
  try {
    Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
    $el = [System.Windows.Automation.AutomationElement]::FocusedElement
    return [bool]($el -and $el.Current.IsPassword)
  } catch { return $false }
}
if (InPassword) { Done @{ ok = $false; app = $name; why = 'password' } }
@{ found = $target.ToInt64(); app = $name } | ConvertTo-Json -Compress
[Console]::Out.Flush()
Start-Sleep -Milliseconds 250

if ($words -and $Paste -eq 1) {
  # code: put on the clipboard and pasted with Ctrl+V, all at once (typed, an editor indents every new line again
  # and closes each tag and bracket it sees opened); what was on your clipboard is put back after
  Add-Type -AssemblyName System.Windows.Forms
  $saved = $null
  try {
    $was = [Windows.Forms.Clipboard]::GetDataObject()
    if ($was) {
      $saved = New-Object Windows.Forms.DataObject
      foreach ($format in $was.GetFormats($false)) { try { $saved.SetData($format, $was.GetData($format)) } catch {} }
    }
  } catch { $saved = $null }
  $put = $false
  for ($try = 0; $try -lt 5 -and -not $put; $try++) {
    try { [Windows.Forms.Clipboard]::SetText(($words -replace "(?<!`r)`n", "`r`n")); $put = $true } catch { Start-Sleep -Milliseconds 80 }
  }
  if (-not $put) { Done @{ ok = $false; app = $name; why = 'clipboard' } }
  if ([CapriKeys]::GetForegroundWindow() -ne $target) { Done @{ ok = $false; app = $name; why = 'moved' } }
  [CapriKeys]::Press(0x56, $true, $false, $false)
  Start-Sleep -Milliseconds 700
  try {
    if ($saved -and $saved.GetFormats().Count) { [Windows.Forms.Clipboard]::SetDataObject($saved, $true) } else { [Windows.Forms.Clipboard]::Clear() }
  } catch {}
} elseif ($words) {
  # chat apps and browsers: Enter sends there, so a line break of the text is Shift+Enter
  $soft = @('Discord', 'WhatsApp', 'Telegram', 'slack', 'Teams', 'ms-teams', 'chrome', 'msedge', 'firefox', 'opera', 'brave', 'Signal', 'Messenger') -contains $name
  switch ([CapriKeys]::Type($target, $words, $soft)) {
    1 { Done @{ ok = $false; app = $name; why = 'moved' } }
    2 { Done @{ ok = $false; app = $name; why = 'you' } }
  }
}
foreach ($k in @($Keys -split ',' | ForEach-Object { $_.Trim().ToLower() } | Where-Object { $_ })) {
  if ([CapriKeys]::GetForegroundWindow() -ne $target) { Done @{ ok = $false; app = $name; why = 'moved' } }
  if ($k -eq 'enter' -and (InPassword)) { Done @{ ok = $false; app = $name; why = 'password' } }
  Start-Sleep -Milliseconds 120
  switch ($k) {
    'enter' { [CapriKeys]::Press(0x0D, $false, $false, $false) }
    'tab' { [CapriKeys]::Press(0x09, $false, $false, $false) }
    'save' { [CapriKeys]::Press(0x53, $true, $false, $false) }      # Ctrl+S
    'selectall' { [CapriKeys]::Press(0x41, $true, $false, $false) } # Ctrl+A
    'undo' { [CapriKeys]::Press(0x5A, $true, $false, $false) }      # Ctrl+Z
    'copy' { [CapriKeys]::Press(0x43, $true, $false, $false) }      # Ctrl+C
    'paste' { [CapriKeys]::Press(0x56, $true, $false, $false) }     # Ctrl+V
    'newline' { [CapriKeys]::Press(0x0D, $false, $true, $false) }   # Shift+Enter: a new line in a chat box
  }
}
Done @{ ok = $true; app = $name; why = '' }
