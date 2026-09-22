@echo off
title Samvedna [NHAA] - Real-Time Stress ^& Trauma Assessment Platform
color 0b
echo ==============================================================================
echo        SAMVEDNA [NHAA] - REAL-TIME STRESS ^& TRAUMA ASSESSMENT PLATFORM
echo                           Smart India Hackathon Ready
echo ==============================================================================
echo.

:: Get current directory
set "ROOT_DIR=%~dp0"

:: 1. Start AI Microservice (Port 8000)
echo [1/3] Starting Python AI Microservice (Port 8000)...
start "AI Microservice (FastAPI + ML Engine)" cmd /k "cd /d "%ROOT_DIR%ai-microservice" && call venv\Scripts\activate && python main.py"

:: 2. Start Backend Gateway (Port 4000)
echo [2/3] Starting Node.js Gateway (Port 4000)...
start "Backend Gateway (Node.js + Socket.io)" cmd /k "cd /d "%ROOT_DIR%backend-gateway" && npm run dev"

:: 3. Start React Frontend (Port 5173)
echo [3/3] Starting React Frontend (Port 5173)...
start "Frontend UI (Vite + React)" cmd /k "cd /d "%ROOT_DIR%frontend" && npm run dev"

echo.
echo ==============================================================================
echo  All 3 services are launching in separate console windows:
echo    * Python AI Engine:    http://localhost:8000
echo    * Node.js Gateway:     http://localhost:4000
echo    * React Frontend:      http://localhost:5173
echo ==============================================================================
echo.
echo Waiting 5 seconds for services to initialize...
ping -n 6 127.0.0.1 >nul

echo.
echo Opening Trauma Assessment Portal in Google Chrome / default browser...
start http://localhost:5173/assessment

echo.
echo [OK] Platform launched successfully!
echo To stop all services anytime, run stop.bat or close the 3 service windows.
echo.
pause
