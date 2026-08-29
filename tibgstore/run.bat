@echo off
cd /d "%~dp0"
if not exist node_modules npm install
echo TIBGSTORE → http://localhost:5174
node server.js
pause
