@echo off
title Smart Attendance System - Face Recognition
cd /d "%~dp0"

where python >nul 2>&1
if %errorlevel%==0 (
  python -c "import cv2, PIL, numpy" >nul 2>&1
  if errorlevel 1 (
    echo Installing required packages...
    python -m pip install -r requirements.txt
  )
  python main.py
  goto :end
)

echo Python was not found on PATH.
echo Install Python 3 from https://www.python.org/downloads/
echo Make sure to check "Add python.exe to PATH".
pause
:end
