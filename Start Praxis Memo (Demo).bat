@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Praxis Memo - DEMO (lokal)

echo.
echo ================================================
echo   Praxis Memo - DEMO-Modus
echo   Strukturierung laeuft lokal ueber Ollama.
echo   Es werden KEINE Daten in die Cloud gesendet.
echo   Bitte trotzdem KEINE echten Patientendaten eingeben!
echo ================================================
echo.

REM ---- Python finden und lokalen Server starten ----
where py >nul 2>nul
if %errorlevel%==0 (
    py praxis_memo_server.py
    goto :ende
)

where python >nul 2>nul
if %errorlevel%==0 (
    python praxis_memo_server.py
    goto :ende
)

echo.
echo Python wurde nicht gefunden.
echo Bitte aus dem Microsoft Store installieren:
start "" "ms-windows-store://pdp/?ProductId=9NCVDN91XZQP"
echo.
pause

:ende
endlocal
