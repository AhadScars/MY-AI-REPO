@echo off
REM Generate a release keystore (Windows). Requires JDK keytool on PATH.
cd /d "%~dp0.."
if exist keystore\release.jks (
  echo Already exists: keystore\release.jks
  exit /b 0
)

where keytool >nul 2>&1
if errorlevel 1 (
  echo keytool not found. Install JDK 17+ and add it to PATH.
  exit /b 1
)

set STORE_PASS=CleanAppStore1!
set KEY_PASS=CleanAppKey1!
set ALIAS=cleanapp

keytool -genkeypair -v -keystore keystore\release.jks -alias %ALIAS% -keyalg RSA -keysize 2048 -validity 10000 -storepass %STORE_PASS% -keypass %KEY_PASS% -dname "CN=Clean App, OU=Mobile, O=DigiHub, L=City, ST=State, C=US"

(
echo storeFile=keystore/release.jks
echo storePassword=%STORE_PASS%
echo keyAlias=%ALIAS%
echo keyPassword=%KEY_PASS%
) > keystore\keystore.properties

echo.
echo Created keystore\release.jks and keystore\keystore.properties
echo Back up the JKS and passwords. Never commit them.
echo Default passwords: store=%STORE_PASS% key=%KEY_PASS%
