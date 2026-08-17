@echo off
setlocal
set "JAVA_HOME=C:\Program Files\Java\jdk-17"
set "PATH=%JAVA_HOME%\bin;%PATH%"
cd /d "%~dp0"

echo Building release APK...
call gradlew.bat assembleRelease --no-daemon
if errorlevel 1 exit /b 1

if exist app\build\outputs\apk\release\app-release.apk (
  copy /Y app\build\outputs\apk\release\app-release.apk SmartCalculator.apk
  echo.
  echo SUCCESS: SmartCalculator.apk
  dir SmartCalculator.apk
)
