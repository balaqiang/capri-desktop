# What Capri reads when you ask her to look (Look): the text in a picture of your screen, through Windows'
# own OCR (offline, nothing leaves the PC), and which program the window in front belongs to. Run once per
# look. Prints one JSON line: { app, title, text }.
#
#   powershell -File ocr.ps1 <png path> <hwnd of the window in front, or 0>

param([string]$Image = '', [long]$Window = 0)
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [Text.Encoding]::UTF8

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class CapriOcr {
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr hwnd, StringBuilder text, int max);
  public static string Title(long hwnd) { var b = new StringBuilder(512); GetWindowText(new IntPtr(hwnd), b, 512); return b.ToString(); }
  public static uint Pid(long hwnd) { uint pid; GetWindowThreadProcessId(new IntPtr(hwnd), out pid); return pid; }
}
"@

$app = ''
$title = ''
if ($Window -ne 0) {
  $title = [CapriOcr]::Title($Window)
  $proc = Get-Process -Id ([CapriOcr]::Pid($Window))
  if ($proc) { $app = if ($proc.Description) { $proc.Description } else { $proc.ProcessName } }
}

# WinRT's async calls, awaited from PowerShell 5
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]
function Await($op, [Type]$type) {
  $task = $asTask.MakeGenericMethod($type).Invoke($null, @($op))
  $task.Wait(-1) | Out-Null
  $task.Result
}

$text = ''
if ($Image -and (Test-Path $Image)) {
  [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime] | Out-Null
  [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime] | Out-Null
  [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
  [Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime] | Out-Null
  $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
  if (-not $engine) { $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new('en-US')) }
  if ($engine) {
    $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($Image)) ([Windows.Storage.StorageFile])
    $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
    $text = (($result.Lines | ForEach-Object { $_.Text }) -join "`n")
    $stream.Dispose()
  }
}

[Console]::Out.WriteLine((@{ app = $app; title = $title; text = $text } | ConvertTo-Json -Compress))
