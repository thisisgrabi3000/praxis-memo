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
  "Compress-Archive -Force -Path 'index.html','styles.css','app.js','befund.js','praxis_memo_server.py','Start Praxis Memo.bat','KI einrichten.bat','Datenordner oeffnen.bat','PC KI Leistung pruefen.bat','Besseres Modell installieren.bat','Schnelles Modell (3b) zurueck.bat','README_PC_INSTALLATION.txt','VERSION' -DestinationPath '%ZIPNAME%'"

if %errorlevel%==0 (
    echo Fertig: %ZIPNAME%
) else (
    echo Fehler beim Erstellen des Pakets.
)
echo.
pause
endlocal
