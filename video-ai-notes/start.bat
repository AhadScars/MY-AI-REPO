@echo off
cd /d "%~dp0"
if not exist .env (
  echo.
  echo  [!] No .env file found.
  echo  Copy .env.example to .env and add your GEMINI_API_KEY from https://aistudio.google.com/apikey
  echo.
  if not exist node_modules (
    call npm install
  )
  copy .env.example .env >nul
  notepad .env
)
if not exist node_modules (
  call npm install
)
echo.
echo  Starting Video AI Notes at http://localhost:3847
echo.
start http://localhost:3847
node server/index.js
pause
