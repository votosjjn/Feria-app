@echo off
cd /d "%~dp0"
start "Feria Empresarial - servidor local" powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor-feria.ps1"
exit /b 0
