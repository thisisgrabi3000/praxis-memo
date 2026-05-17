@echo off
setlocal
cd /d "%~dp0"

if not exist "data" mkdir "data"
if not exist "backups" mkdir "backups"

start "" "%~dp0data"
start "" "%~dp0backups"

endlocal
