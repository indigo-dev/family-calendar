@echo off
cd /d "%~dp0"
echo ==== START %date% %time% > install-log.txt
where node >> install-log.txt 2>&1
if errorlevel 1 (
  echo NODE_FEHLT >> install-log.txt
  exit /b 1
)
node -v >> install-log.txt 2>&1
call npm -v >> install-log.txt 2>&1
echo ==== NPM INSTALL >> install-log.txt
call npm install >> install-log.txt 2>&1
echo ==== BUILD >> install-log.txt
call npm run build >> install-log.txt 2>&1
echo ==== ENDE errorlevel %errorlevel% >> install-log.txt
