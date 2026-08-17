@echo off
cd /d "%~dp0"
echo Building SchoolAttendance.exe with PyInstaller...
if not exist ".venv\Scripts\python.exe" (
  python -m venv .venv
  call .venv\Scripts\activate.bat
  pip install -r requirements.txt
) else (
  call .venv\Scripts\activate.bat
)
pip install pyinstaller
pyinstaller --noconfirm --clean ^
  --name SchoolAttendance ^
  --onefile ^
  --console ^
  --add-data "app/templates;app/templates" ^
  --add-data "app/static;app/static" ^
  --hidden-import=openpyxl ^
  --hidden-import=qrcode ^
  --hidden-import=PIL ^
  main.py

echo.
echo Done. EXE is in dist\SchoolAttendance.exe
echo Data folder (DB, Excel exports) is created next to the EXE on first run.
pause
