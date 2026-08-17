@echo off
cd /d "%~dp0"

if not exist keystore\keystore.properties (
  echo No release keystore yet. Generating one...
  call keystore\generate-keystore.bat
)

if exist gradlew.bat (
  call gradlew.bat assembleRelease
  if errorlevel 1 exit /b 1
  if exist app\build\outputs\apk\release\app-release.apk (
    copy /Y app\build\outputs\apk\release\app-release.apk SmartCalculator.apk >nul
    echo.
    echo APK ready:
    echo   app\build\outputs\apk\release\app-release.apk
    echo   SmartCalculator.apk
  )
) else (
  echo Gradle wrapper missing. Open in Android Studio once, or run setup-wrapper.
  exit /b 1
)
