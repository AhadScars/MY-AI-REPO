@echo off
cd /d "%~dp0"
start http://localhost:5174
python -m http.server 5174
