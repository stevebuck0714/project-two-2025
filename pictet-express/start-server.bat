@echo off
echo Killing any existing Node processes...
taskkill /F /IM node.exe >nul 2>&1

echo Starting Express server...
cd /D "%~dp0"
node server.js

pause
