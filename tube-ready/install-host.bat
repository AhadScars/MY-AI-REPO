@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo.
echo  TubeReady  -  install yt-dlp helper
echo  ----------------------------------
echo.

where py >nul 2>nul
if %ERRORLEVEL%==0 (
  echo Updating yt-dlp...
  py -3 -m pip install -U yt-dlp
  echo Registering helper with Chrome...
  py -3 "%~dp0native\install_host.py"
  goto :done
)

where python >nul 2>nul
if %ERRORLEVEL%==0 (
  echo Updating yt-dlp...
  python -m pip install -U yt-dlp
  echo Registering helper with Chrome...
  python "%~dp0native\install_host.py"
  goto :done
)

echo ERROR: Python was not found.
echo Install Python 3 from https://www.python.org/downloads/
echo and tick "Add python.exe to PATH".
pause
exit /b 1

:done
echo.
echo  Helper installed.
echo  1. Open chrome://extensions
echo  2. Reload TubeReady
echo  3. Open a YouTube video and click Download
echo.
echo  Files save to:  %%USERPROFILE%%\Downloads\TubeReady
echo.
pause
