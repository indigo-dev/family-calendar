@echo off
rem Startet HomeWally lokal (Entwicklungsserver) und oeffnet ihn im Browser.
rem Im WLAN ist er auch vom iPad erreichbar - die Adresse steht unten bei "Network".
cd /d "%~dp0"
title HomeWally (lokal)
where node >NUL 2>&1
if errorlevel 1 (
  echo Node.js fehlt - bitte von https://nodejs.org installieren.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installiere Abhaengigkeiten ...
  call npm install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo.
echo HomeWally startet ... Zum Beenden dieses Fenster schliessen oder Strg+C druecken.
echo.
call npm run dev -- --open
pause
