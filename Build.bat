@echo off
rem Builds Capri into Windows programs, in the dist folder:
rem   Capri-Setup-<version>.exe     the installer (Start menu, Desktop shortcut, starts with Windows)
rem   Capri-Portable-<version>.exe  one file you can run from anywhere, nothing installed
rem Needs Node.js 20+ (https://nodejs.org) and an internet connection the first time.
setlocal
cd /d "%~dp0"

echo [1/3] Memasang dependency...
call npm install --no-audit --no-fund || goto :fail
if not exist "node_modules\electron\dist\electron.exe" call node node_modules\electron\install.js || goto :fail

echo [2/3] Membangun Capri (beberapa menit)...
call npx electron-builder --win || goto :fail

echo [3/3] Selesai! File exe ada di folder dist:
dir /b dist\*.exe
start "" "%~dp0dist"
pause
exit /b 0

:fail
echo.
echo Build gagal. Lihat pesan di atas.
pause
exit /b 1
