@echo off
cd /d "%~dp0"
start "Feria Empresarial - servidor local" powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor-feria.ps1"
timeout /t 2 /nobreak >nul
start "" http://127.0.0.1:8765/

