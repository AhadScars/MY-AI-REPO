@echo off
setlocal
cd /d "C:\Users\Shoaib Qazi\Desktop\Ai\terminal-ide"

echo Killing Terminal - IDE processes...
taskkill /F /IM "Terminal - IDE.exe" >nul 2>&1
taskkill /F /IM "Terminal - IDE.exe" >nul 2>&1

timeout /t 3 /nobreak >nul

echo Removing release folder...
if exist "release" (
  rmdir /s /q "release"
)

if exist "release" (
  echo FAILED: release still locked. Close Terminal - IDE and run this script again.
  exit /b 1
) else (
  echo SUCCESS: release folder removed.
  exit /b 0
)
