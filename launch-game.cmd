@echo off
rem Browser fallback launcher. Prefer the Windows desktop build from
rem `npm run dist:win` (installer or portable) for an icon + chrome-less window.
cd /d "%~dp0"

netstat -ano | findstr ":5173" | findstr "LISTENING" >nul
if errorlevel 1 (
  start "Atomic Knockout Server" /min cmd /c "node server.js"
  timeout /t 2 /nobreak >nul
)

start "" http://localhost:5173
