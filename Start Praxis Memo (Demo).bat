@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Praxis Memo - DEMO mit Cloud-KI

echo.
echo ================================================
echo   Praxis Memo - DEMO-Modus
echo   Strukturierung laeuft ueber OpenAI (Cloud)
echo   Bitte KEINE echten Patientendaten eingeben!
echo ================================================
echo.

REM ---- OpenAI-Key aus Datei lesen ----
if not exist "openai-key.txt" (
    echo FEHLER: Datei "openai-key.txt" fehlt im App-Ordner.
    echo.
    echo Bitte die Datei anlegen und den OpenAI-API-Key
    echo als einzige Zeile hineinschreiben.
    echo.
    pause
    exit /b 1
)

set /p OPENAI_API_KEY=<openai-key.txt
if "%OPENAI_API_KEY%"=="" (
    echo FEHLER: openai-key.txt ist leer.
    pause
    exit /b 1
)

REM ---- Python finden und Server starten ----
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
