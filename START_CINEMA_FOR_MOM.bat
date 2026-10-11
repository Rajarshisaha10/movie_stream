@echo off
title Family Cinema - Private Movie Streaming Host
cd /d "%~dp0"
color 0A

echo ===================================================================
echo             STARTING FAMILY CINEMA STREAMING HOST
echo ===================================================================
echo.

:: 1. Launch Sleep Prevention in background so laptop stays awake
start /min powershell -ExecutionPolicy Bypass -File "%~dp0scripts\keep_awake.ps1"

:: 2. Launch Unified Server + Cloudflare Tunnel in this window
node scripts\start_all.js

pause
