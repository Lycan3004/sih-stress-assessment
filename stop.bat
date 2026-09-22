@echo off
title Stop Stress Assessment Platform
color 0c
echo ==============================================================================
echo        STOPPING STRESS ^& TRAUMA ASSESSMENT PLATFORM
echo ==============================================================================
echo.

echo Stopping processes running on ports 8000, 4000, and 5173...

:: Kill processes on port 8000 (Python AI Microservice)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    echo Stopping AI Microservice ^(PID: %%a^)...
    taskkill /F /T /PID %%a >nul 2>&1
)

:: Kill processes on port 4000 (Node.js Gateway)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":4000" ^| findstr "LISTENING"') do (
    echo Stopping Backend Gateway ^(PID: %%a^)...
    taskkill /F /T /PID %%a >nul 2>&1
)

:: Kill processes on port 5173 (Vite Frontend)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173" ^| findstr "LISTENING"') do (
    echo Stopping Frontend Server ^(PID: %%a^)...
    taskkill /F /T /PID %%a >nul 2>&1
)

echo.
echo [OK] All services have been stopped successfully.
echo.
pause
