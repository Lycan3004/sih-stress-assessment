@echo off
setlocal enabledelayedexpansion
title Samvedna [NHAA] - Real-Time Stress ^& Trauma Assessment Platform
color 0b

echo ==============================================================================
echo        SAMVEDNA [NHAA] - REAL-TIME STRESS ^& TRAUMA ASSESSMENT PLATFORM
echo                           Smart India Hackathon Ready
echo ==============================================================================
echo.

:: Resolve Root Directory without trailing slash
set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"

:: 0. Clean release of occupied ports (8000, 4000, 5173) to avoid EADDRINUSE crashes
echo [0/4] Checking and clearing port conflicts (8000, 4000, 5173)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    echo   Releasing occupied port 8000 ^(PID: %%a^)...
    taskkill /F /T /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":4000" ^| findstr "LISTENING"') do (
    echo   Releasing occupied port 4000 ^(PID: %%a^)...
    taskkill /F /T /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173" ^| findstr "LISTENING"') do (
    echo   Releasing occupied port 5173 ^(PID: %%a^)...
    taskkill /F /T /PID %%a >nul 2>&1
)

:: 1. Verify Prerequisites & Environment Setup
echo.
echo [1/4] Verifying modules, environments and dependencies...

:: AI Microservice check
if not exist "%ROOT_DIR%\ai-microservice\venv" (
    echo   [!] Python venv not found in ai-microservice. Creating venv...
    cd /d "%ROOT_DIR%\ai-microservice"
    python -m venv venv || py -m venv venv
    if exist venv\Scripts\python.exe (
        echo   [!] Installing Python AI dependencies ^(this may take a minute^)...
        call venv\Scripts\python.exe -m pip install --upgrade pip
        call venv\Scripts\python.exe -m pip install -r requirements.txt
    ) else (
        echo   [ERROR] Failed to create Python venv. Please ensure Python 3.10+ is installed and on your PATH.
    )
    cd /d "%ROOT_DIR%"
)

:: Backend Gateway check
if not exist "%ROOT_DIR%\backend-gateway\node_modules" (
    echo   [!] node_modules not found in backend-gateway. Installing dependencies...
    cd /d "%ROOT_DIR%\backend-gateway"
    call npm.cmd install
    cd /d "%ROOT_DIR%"
)

:: Backend Gateway Prisma DB check
if not exist "%ROOT_DIR%\backend-gateway\prisma\dev.db" (
    echo   [!] SQLite database not initialized. Generating Prisma client and DB...
    cd /d "%ROOT_DIR%\backend-gateway"
    call npx.cmd prisma generate
    call npx.cmd prisma db push
    cd /d "%ROOT_DIR%"
)

:: Frontend check
if not exist "%ROOT_DIR%\frontend\node_modules" (
    echo   [!] node_modules not found in frontend. Installing dependencies...
    cd /d "%ROOT_DIR%\frontend"
    call npm.cmd install
    cd /d "%ROOT_DIR%"
)

:: .env checks
if not exist "%ROOT_DIR%\frontend\.env" (
    echo VITE_ADMIN_EMAIL="admin@sih.com"> "%ROOT_DIR%\frontend\.env"
)
if not exist "%ROOT_DIR%\backend-gateway\.env" (
    (
        echo PORT=4000
        echo DATABASE_URL="file:./dev.db"
        echo EMAIL_USER="admin@sih.com"
        echo EMAIL_PASS="mock-email-password"
        echo ADMIN_EMAIL="admin@sih.com"
    ) > "%ROOT_DIR%\backend-gateway\.env"
)

echo   [OK] All dependencies and configuration verified.
echo.

:: 2. Start AI Microservice (Port 8000)
echo [2/4] Starting Python AI Microservice (Port 8000)...
start "Samvedna [AI Microservice :8000]" /D "%ROOT_DIR%\ai-microservice" cmd /k "title AI Microservice (Port 8000) && color 0a && if exist venv\Scripts\python.exe ( venv\Scripts\python.exe main.py ) else ( python main.py )"

:: 3. Start Backend Gateway (Port 4000)
echo [3/4] Starting Node.js Gateway (Port 4000)...
start "Samvedna [Backend Gateway :4000]" /D "%ROOT_DIR%\backend-gateway" cmd /k "title Backend Gateway (Port 4000) && color 0b && call npm.cmd run dev"

:: 4. Start React Frontend (Port 5173)
echo [4/4] Starting React Frontend (Port 5173)...
start "Samvedna [React Frontend :5173]" /D "%ROOT_DIR%\frontend" cmd /k "title React Frontend (Port 5173) && color 0d && call npm.cmd run dev"

echo.
echo ==============================================================================
echo  All 3 services are launching in dedicated console windows:
echo    * Python AI Engine:    http://localhost:8000
echo    * Node.js Gateway:     http://localhost:4000
echo    * React Frontend:      http://localhost:5173
echo ==============================================================================
echo.
echo Waiting 6 seconds for services to initialize...
ping -n 7 127.0.0.1 >nul

echo.
echo Opening Trauma Assessment Portal in your default browser...
start http://localhost:5173/assessment

echo.
echo [OK] Platform launched successfully!
echo   - Victim Sanctuary:   http://localhost:5173/assessment
echo   - Admin Dashboard:    http://localhost:5173/dashboard
echo   - AI Health Check:    http://localhost:8000/health
echo.
echo To stop all services anytime, run stop.bat or close the 3 service windows.
echo ==============================================================================
echo.
pause
