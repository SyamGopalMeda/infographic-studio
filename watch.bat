@echo off
REM Auto mode: every image or .txt scenario dropped into the "inbox" folder becomes an animation.
cd /d "%~dp0"
if not exist node_modules (
  echo First run: installing... & call setup.bat
)
start "" explorer "%~dp0inbox"
node scripts\create.mjs --watch
