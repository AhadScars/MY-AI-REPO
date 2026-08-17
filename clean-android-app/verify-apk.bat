@echo off
"C:\Users\Shoaib Qazi\AppData\Local\Android\Sdk\build-tools\37.0.0\aapt.exe" dump badging "%~dp0SmartCalculator.apk"
echo.
"C:\Users\Shoaib Qazi\AppData\Local\Android\Sdk\build-tools\37.0.0\apksigner.bat" verify --print-certs "%~dp0SmartCalculator.apk"
