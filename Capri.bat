@echo off
rem Capri, started on her own: no terminal stays open, closing this window doesn't close her.
rem The first time, it gets what she needs (Node.js 20+ must be installed: https://nodejs.org).
setlocal
cd /d "%~dp0"

if not exist "node_modules\electron\dist\electron.exe" (
  echo Menyiapkan Capri untuk pertama kali, tunggu sebentar...
  call npm install --no-audit --no-fund || goto :fail
  call node node_modules\electron\install.js || goto :fail
)

start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0."
exit /b 0

:fail
echo.
echo Gagal menyiapkan Capri. Pastikan Node.js 20 atau lebih baru terpasang: https://nodejs.org
pause
exit /b 1
