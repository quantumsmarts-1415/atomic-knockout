@echo off
rem Atomic Knockout — prefer the packaged desktop app when present.
cd /d "%~dp0"

if exist "%~dp0release\win-unpacked\Atomic Knockout.exe" (
  start "" "%~dp0release\win-unpacked\Atomic Knockout.exe"
  exit /b 0
)

where electron >nul 2>nul
if not errorlevel 1 (
  start "Atomic Knockout" cmd /c "npx electron ."
  exit /b 0
)

netstat -ano | findstr ":5173" | findstr "LISTENING" >nul
if errorlevel 1 (
  start "Atomic Knockout Server" /min cmd /c "node server.js"
  timeout /t 2 /nobreak >nul
)

start "" http://localhost:5173
