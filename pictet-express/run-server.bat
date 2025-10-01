@echo off
echo Starting Lombard Odier Express Server...
cd /d "%~dp0"
echo Current directory: %cd%
echo Starting server on port 4001...
node server.js
pause







