@echo off
REM PowerPoint deck: drag an image onto this file, OR double-click it and type a topic / scenario.
cd /d "%~dp0"
if not exist node_modules (
  echo First run: installing... & call setup.bat
)
node scripts\create.mjs --deck %*
echo.
pause
