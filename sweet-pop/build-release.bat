@echo off
setlocal
cd /d "%~dp0"
if not defined JAVA_HOME set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "PATH=%JAVA_HOME%\bin;%PATH%"
call gradlew.bat assembleRelease --no-daemon
if errorlevel 1 exit /b 1
copy /Y "app\build\outputs\apk\release\app-release.apk" "SweetPop.apk"
copy /Y "SweetPop.apk" "..\SweetPop.apk"
echo Built SweetPop.apk
endlocal
