@echo off
setlocal enabledelayedexpansion
title SynCura Setup
echo ============================================
echo   SynCura - first-time setup
echo ============================================
echo.
echo This installs/prepares everything needed to run the app on this PC:
echo   - PHP dependencies (Composer)
echo   - the MySQL database (imports database\syncura.sql + syncura_auth.sql)
echo   - Laravel's own migrations (adds the ai_consultations table)
echo   - frontend dependencies (npm)
echo   - the AI service's Python virtual environment
echo.

set "ROOT=%~dp0"

REM --- Locate PHP ---
set "PHP=php"
where php >nul 2>&1
if errorlevel 1 (
    if exist "C:\xampp\php\php.exe" (
        set "PHP=C:\xampp\php\php.exe"
    ) else (
        echo [ERROR] PHP not found on PATH and C:\xampp\php\php.exe does not exist.
        echo         Install PHP 8.2+ ^(e.g. via XAMPP: https://www.apachefriends.org/^) and re-run this script.
        goto :fail
    )
)

REM --- Locate MySQL client ---
set "MYSQL=mysql"
where mysql >nul 2>&1
if errorlevel 1 (
    if exist "C:\xampp\mysql\bin\mysql.exe" (
        set "MYSQL=C:\xampp\mysql\bin\mysql.exe"
    ) else (
        echo [ERROR] mysql client not found on PATH and C:\xampp\mysql\bin\mysql.exe does not exist.
        echo         Install MySQL/MariaDB ^(e.g. via XAMPP^) and re-run this script.
        goto :fail
    )
)

REM --- Locate Composer ---
where composer >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Composer not found on PATH.
    echo         Install it from https://getcomposer.org/download/ and re-run this script.
    goto :fail
)

REM --- Locate npm ---
where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm not found on PATH.
    echo         Install Node.js ^(https://nodejs.org/^) and re-run this script.
    goto :fail
)

REM --- Locate Python ^(optional - only needed for the AI service^) ---
set "PYTHON="
where python >nul 2>&1
if not errorlevel 1 (
    set "PYTHON=python"
) else (
    where py >nul 2>&1
    if not errorlevel 1 set "PYTHON=py -3"
)

echo [1/5] Checking MySQL is reachable...
"%MYSQL%" -u root -e "SELECT 1;" >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Could not connect to MySQL as root with no password at 127.0.0.1:3306.
    echo         Start MySQL ^(e.g. XAMPP's Control Panel -^> Start next to MySQL^) and re-run this script.
    goto :fail
)

echo [2/5] Setting up the backend ^(Laravel^)...
pushd "%ROOT%backend"

if not exist .env (
    copy /y .env.example .env >nul
    echo   Created backend\.env from .env.example
)

call composer install --no-interaction
if errorlevel 1 goto :failpop

findstr /r "^APP_KEY=.+" .env >nul 2>&1
if errorlevel 1 (
    echo   Generating APP_KEY...
    "%PHP%" artisan key:generate --force
)

echo   Ensuring the "syncura" database exists...
"%MYSQL%" -u root -e "CREATE DATABASE IF NOT EXISTS syncura CHARACTER SET utf8mb4;"
if errorlevel 1 goto :failpop

"%MYSQL%" -u root -D syncura -e "SELECT 1 FROM users LIMIT 1;" >nul 2>&1
if errorlevel 1 (
    echo   Importing database schema ^(syncura.sql + syncura_auth.sql^)...
    "%MYSQL%" -u root syncura < "%ROOT%database\syncura.sql"
    if errorlevel 1 goto :failpop
    "%MYSQL%" -u root syncura < "%ROOT%database\syncura_auth.sql"
    if errorlevel 1 goto :failpop
) else (
    echo   Schema already present, skipping import.
)

echo   Running Laravel migrations...
"%PHP%" artisan migrate --force
if errorlevel 1 goto :failpop

popd

echo [3/5] Setting up the frontend ^(React^)...
pushd "%ROOT%frontend"
if not exist .env (
    copy /y .env.example .env >nul
    echo   Created frontend\.env from .env.example
)
call npm install
if errorlevel 1 goto :failpop
popd

echo [4/5] Setting up the AI service ^(Python^)...
if "%PYTHON%"=="" (
    echo   [SKIPPED] No Python found on PATH. Install Python 3.10+ from https://www.python.org/
    echo             then run: python -m venv ai-service\.venv ^&^& ai-service\.venv\Scripts\pip install -r ai-service\requirements.txt
) else (
    pushd "%ROOT%ai-service"
    if not exist .venv (
        %PYTHON% -m venv .venv
    )
    set "VENV_PY=.venv\Scripts\python.exe"
    if not exist "!VENV_PY!" set "VENV_PY=.venv\bin\python.exe"
    "!VENV_PY!" -m pip install --upgrade pip >nul
    "!VENV_PY!" -m pip install -r requirements.txt
    if errorlevel 1 goto :failpop
    popd
)

echo [5/5] Done.
echo.
echo ============================================
echo   Setup complete. Run run.bat to start SynCura.
echo ============================================
pause
exit /b 0

:failpop
popd
:fail
echo.
echo Setup did not complete. Fix the issue above and re-run setup.bat.
pause
exit /b 1
