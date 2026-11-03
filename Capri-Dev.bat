@echo off
rem Capri with her logs in this window (and her debug routes), for chasing a bug. Closing this window closes her.
setlocal
cd /d "%~dp0"
if not exist "node_modules\electron\dist\electron.exe" (
  call npm install --no-audit --no-fund || goto :fail
  call node node_modules\electron\install.js || goto :fail
)
"%~dp0node_modules\electron\dist\electron.exe" "%~dp0." --dev
pause
exit /b 0

:fail
echo Gagal menyiapkan Capri. Pastikan Node.js 20 atau lebih baru terpasang.
pause
exit /b 1
