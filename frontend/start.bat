@echo off
title StegoChain Frontend Launcher
cd /d "%~dp0"

echo =======================================================
echo          STEGOCHAIN FRONTEND LAUNCHER
echo =======================================================
echo.

:: Check Node.js requirement
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js was not found on your system PATH.
    echo Please install Node.js version 18 or newer from https://nodejs.org.
    pause
    exit /b
)

if not exist node_modules (
    echo node_modules not found. Installing dependencies...
    call npm install
)

echo Clearing Next.js cache to prevent build corruption...
if exist .next (
    rmdir /s /q .next
)

echo Starting Next.js Dev Server on port 3001...
call npm run dev
if errorlevel 1 (
    echo.
    echo [ERROR] Next.js dev server exited with an error.
    pause
)
