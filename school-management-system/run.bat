@echo off
setlocal
cd /d "%~dp0"

if not exist out mkdir out

echo Compiling...
javac -d out src\school\*.java
if errorlevel 1 (
    echo Compilation failed. Make sure JDK is installed and on PATH.
    pause
    exit /b 1
)

echo Starting School Management System...
echo.
java -cp out school.SchoolManagementSystem
pause
