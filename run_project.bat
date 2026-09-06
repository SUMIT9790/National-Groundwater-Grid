@echo off
title Hydro-Analytics Pro - Exhibition Mode
echo Starting Local Backend...
cd backend
start /b node server.js
echo Waiting for backend to initialize...
timeout /t 3 /nobreak > nul
echo Opening Frontend...
start http://localhost:3000
echo.
echo ==========================================
echo PROJECT IS LIVE LOCALLY AT http://localhost:3000
echo Keep this window open during the demo!
echo ==========================================
pause