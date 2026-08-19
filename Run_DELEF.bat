@echo off
setlocal
cd /d "%~dp0"
title DELEF FEST GOPASS

echo ========================================
echo       DELEF FEST GOPASS
echo      WHITE PREMIUM VERSION
echo ========================================
echo.

if not exist node_modules (
  echo [1/2] Installing packages...
  call npm install
  if errorlevel 1 (
    echo.
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo [2/2] Starting server...
echo.
echo Open: http://localhost:3000
echo.
call npm start
pause
