@echo off
setlocal
cd /d "%~dp0.."

echo ============================================
echo  Terminal - IDE  -  Windows Installer Build
echo ============================================
echo.
echo This creates:
echo   release\Terminal - IDE-Setup-x.x.x.exe
echo.
echo Installer wizard:
echo   1. Welcome
echo   2. License agreement  (I Agree)
echo   3. Choose install folder
echo   4. Install
echo   5. Finish  (optional Run)
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js not found. Install Node 20+ from https://nodejs.org
  exit /b 1
)

echo [1/3] Installing dependencies...
call npm install
if errorlevel 1 exit /b 1

echo.
echo [2/3] Building app (renderer + electron)...
call npm run build
if errorlevel 1 (
  echo.
  echo Build failed. If Rollup/esbuild errors, run:  npm run fix:win-deps
  exit /b 1
)

echo.
echo [3/3] Packaging NSIS installer...
call npx electron-builder --win nsis --x64
if errorlevel 1 exit /b 1

echo.
echo ============================================
echo  DONE
echo ============================================
echo Installer is in the "release" folder:
dir /b "release\*Setup*.exe" 2>nul
echo.
echo Double-click the Setup .exe to install.
echo.
pause
