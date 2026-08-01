@echo off
rem Atomic Knockout launcher - starts the server if needed, opens the game
cd /d "%~dp0"

netstat -ano | findstr ":5173" | findstr "LISTENING" >nul
if errorlevel 1 (
  start "Atomic Knockout Server" /min cmd /c "node server.js"
  timeout /t 2 /nobreak >nul
)

start "" http://localhost:5173
