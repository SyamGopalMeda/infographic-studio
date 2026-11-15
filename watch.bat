@echo off
REM Auto mode. Drop images or .txt scenarios into:
REM   inbox\        -> animated infographic (MP4 + GIF + PPTX)
REM   inbox\deck\   -> PowerPoint presentation
cd /d "%~dp0"
if not exist node_modules (
  echo First run: installing... & call setup.bat
)
if not exist inbox\deck mkdir inbox\deck
start "" explorer "%~dp0inbox"
node scripts\create.mjs --watch
