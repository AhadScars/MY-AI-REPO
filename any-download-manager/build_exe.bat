@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo Creating venv...
    python -m venv .venv
    ".venv\Scripts\python.exe" -m pip install --upgrade pip
    ".venv\Scripts\python.exe" -m pip install -r requirements.txt
)

echo Installing PyInstaller...
".venv\Scripts\python.exe" -m pip install -q "pyinstaller>=6.0"

echo.
echo Building ADM.exe (this may take a few minutes)...
".venv\Scripts\python.exe" -m PyInstaller ^
  --noconfirm ^
  --clean ^
  --windowed ^
  --onefile ^
  --name "ADM" ^
  --paths "." ^
  --collect-all customtkinter ^
  --collect-all yt_dlp ^
  --hidden-import PIL ^
  --hidden-import PIL._tkinter_finder ^
  --hidden-import adm ^
  --hidden-import adm.app ^
  --hidden-import adm.engine ^
  --hidden-import adm.queue ^
  --hidden-import adm.models ^
  --hidden-import adm.storage ^
  --hidden-import adm.utils ^
  main.py

if errorlevel 1 (
    echo BUILD FAILED
    pause
    exit /b 1
)

echo.
echo ============================================
echo  SUCCESS: dist\ADM.exe
echo ============================================
echo You can copy dist\ADM.exe anywhere and run it.
echo Downloads save next to the exe in a downloads folder.
echo.
explorer dist
pause
endlocal
