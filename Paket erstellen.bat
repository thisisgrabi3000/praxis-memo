@echo off
setlocal
cd /d "%~dp0"
title Praxis Memo Paket erstellen

echo.
echo Praxis Memo Paket wird erstellt...
echo.

REM Zieldatei
set ZIPNAME=PraxisMemo-%date:~6,4%-%date:~3,2%-%date:~0,2%.zip

REM Mit PowerShell packen (Windows 10+ eingebaut)
powershell -NoProfile -Command ^
  "Compress-Archive -Force -Path 'index.html','styles.css','app.js','praxis_memo_server.py','Start Praxis Memo.bat','KI einrichten.bat','Datenordner oeffnen.bat','PC KI Leistung pruefen.bat','README_PC_INSTALLATION.txt' -DestinationPath '%ZIPNAME%'"

if %errorlevel%==0 (
    echo Fertig: %ZIPNAME%
) else (
    echo Fehler beim Erstellen des Pakets.
)
echo.
pause
endlocal
