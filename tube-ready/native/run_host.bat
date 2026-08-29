@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %ERRORLEVEL%==0 (
  py -3 -u "%~dp0host.py"
  exit /b %ERRORLEVEL%
)
where python >nul 2>nul
if %ERRORLEVEL%==0 (
  python -u "%~dp0host.py"
  exit /b %ERRORLEVEL%
)
echo {"type":"error","ok":false,"error":"Python not found"} 1>&2
exit /b 1
