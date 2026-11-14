@echo off
REM Drag an image onto this file, OR double-click it and type a scenario.
cd /d "%~dp0"
if not exist node_modules (
  echo First run: installing... & call setup.bat
)
node scripts\create.mjs %*
echo.
pause
