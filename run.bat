@echo off
setlocal enabledelayedexpansion
title SynCura Launcher
set "ROOT=%~dp0"
echo ============================================
echo   SynCura - starting MySQL + AI Service + Backend + Frontend
echo ============================================
echo.

if not exist "%~dp0backend\.env" (
    echo [ERROR] backend\.env not found. Run setup.bat first.
    pause
    exit /b 1
)
if not exist "%~dp0backend\vendor" (
    echo [ERROR] backend\vendor not found. Run setup.bat first.
    pause
    exit /b 1
)

REM --- Locate PHP (PATH first, then common XAMPP location) ---
set "PHP=php"
where php >nul 2>&1
if errorlevel 1 (
    if exist "C:\xampp\php\php.exe" (
        set "PHP=C:\xampp\php\php.exe"
    ) else (
        echo [ERROR] PHP not found on PATH and C:\xampp\php\php.exe does not exist. Install PHP or run setup.bat.
        pause
        exit /b 1
    )
)

REM --- Locate MySQL client (PATH first, then common XAMPP location) ---
set "MYSQL=mysql"
where mysql >nul 2>&1
if errorlevel 1 (
    if exist "C:\xampp\mysql\bin\mysql.exe" (
        set "MYSQL=C:\xampp\mysql\bin\mysql.exe"
    ) else (
        set "MYSQL="
    )
)

REM --- 1. MySQL (XAMPP) ---
echo [1/4] Checking MySQL...
if defined MYSQL (
    "%MYSQL%" -u root -e "SELECT 1;" >nul 2>&1
    if errorlevel 1 (
        echo   Starting MySQL...
        if exist "C:\xampp\mysql_start.bat" (
            start "SynCura - MySQL" cmd /k "cd /d C:\xampp && mysql_start.bat"
            echo   Waiting for MySQL to come up...
            timeout /t 6 /nobreak >nul
        ) else (
            echo   [WARN] Could not reach MySQL and no XAMPP start script was found. Start your MySQL server manually.
        )
    ) else (
        echo   MySQL is already running.
    )
) else (
    echo   [WARN] mysql client not found; skipping the MySQL check. Make sure it's running.
)

REM --- 2. AI service (Flask, ML models) ---
echo [2/4] Starting AI service on http://127.0.0.1:5000 ...
curl -fs --connect-timeout 2 --max-time 3 -o nul "http://127.0.0.1:5000/health"
if errorlevel 1 (
    set "VENV_PY=%~dp0ai-service\.venv\Scripts\python.exe"
    if not exist "!VENV_PY!" set "VENV_PY=%~dp0ai-service\.venv\bin\python.exe"
    if not exist "!VENV_PY!" (
        echo   [ERROR] ai-service\.venv not found. Run setup.bat first.
        goto :startup_failed
    ) else (
        start "SynCura - AI Service" /D "%ROOT%ai-service" cmd /k ""!VENV_PY!" app.py"
        echo   Waiting for the AI service to train its models and become healthy...
        set "AI_READY="
        for /l %%N in (1,1,60) do (
            curl -fs --connect-timeout 2 --max-time 3 -o nul "http://127.0.0.1:5000/health"
            if not errorlevel 1 (
                set "AI_READY=1"
                goto :ai_ready
            )
            timeout /t 2 /nobreak >nul
        )
        :ai_ready
        if not defined AI_READY (
            echo   [ERROR] AI service did not become healthy within 120 seconds.
            echo           Leave its window open to inspect the Python error, then run setup.bat if needed.
            goto :startup_failed
        )
        echo   AI service is healthy.
    )
) else (
    echo   AI service is already running.
)

REM --- 3. Laravel backend ---
echo [3/4] Starting Laravel backend on http://127.0.0.1:8000 ...
curl -s -o nul "http://127.0.0.1:8000/up"
if errorlevel 1 (
    start "SynCura - Backend" /D "%ROOT%backend" cmd /k ""%PHP%" artisan serve --port=8000"
) else (
    echo   Backend is already running.
)

REM --- 4. React frontend ---
echo [4/4] Starting React frontend on http://localhost:5173 ...
if not exist "%~dp0frontend\node_modules" (
    echo   [ERROR] frontend\node_modules not found. Run setup.bat first.
) else (
    curl -s -o nul "http://127.0.0.1:5173"
    if errorlevel 1 (
        start "SynCura - Frontend" /D "%ROOT%frontend" cmd /k "npm run dev"
    ) else (
        echo   Frontend is already running.
    )
)

echo.
echo Waiting for everything to boot...
timeout /t 6 /nobreak >nul
start "" "http://localhost:5173"

echo.
echo ============================================
echo   All set. Up to four windows are now running:
echo     - MySQL             (if it wasn't already up)
echo     - AI service         http://127.0.0.1:5000
echo     - Laravel backend    http://127.0.0.1:8000
echo     - React frontend     http://localhost:5173
echo.
echo   Close those windows to stop the servers.
echo   This window can be closed safely.
echo ============================================
pause
exit /b 0

:startup_failed
echo.
echo ============================================
echo   SynCura could not start all required services.
echo   The frontend was not opened because AI Consultation would not work.
echo ============================================
pause
exit /b 1
