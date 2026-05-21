@echo off
setlocal enabledelayedexpansion
title Praxis Memo - Besseres KI-Modell installieren
cd /d "%~dp0"

echo.
echo ================================================
echo   Besseres KI-Modell (qwen2.5:7b) installieren
echo ================================================
echo.

REM RAM ermitteln (Gesamt-GB, gerundet)
for /f "usebackq delims=" %%R in (`powershell -NoProfile -Command "[math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory/1GB)"`) do set RAMGB=%%R
echo Erkannter Arbeitsspeicher: %RAMGB% GB
echo.

if %RAMGB% LSS 16 (
    echo ABBRUCH: Dieser PC hat weniger als 16 GB RAM.
    echo Das groessere Modell qwen2.5:7b wird NICHT installiert.
    echo Die App bleibt beim schnellen Modell qwen2.5:3b.
    echo.
    pause
    exit /b 1
)

REM Ollama finden
set OLLAMA_EXE=
where ollama >nul 2>nul && set OLLAMA_EXE=ollama
if not defined OLLAMA_EXE if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" set OLLAMA_EXE="%LOCALAPPDATA%\Programs\Ollama\ollama.exe"
if not defined OLLAMA_EXE (
    echo ABBRUCH: Ollama nicht gefunden. Bitte zuerst "KI einrichten.bat" ausfuehren.
    echo.
    pause
    exit /b 1
)

echo Lade qwen2.5:7b herunter ^(kann einige Minuten dauern^)...
%OLLAMA_EXE% pull qwen2.5:7b
if %errorlevel% neq 0 (
    echo.
    echo FEHLER: Download fehlgeschlagen. Modell wurde NICHT aktiviert.
    echo Die App bleibt beim schnellen Modell qwen2.5:3b.
    echo.
    pause
    exit /b 1
)

if not exist "data" mkdir "data"
> "data\ki-modell.txt" echo qwen2.5:7b

echo.
echo FERTIG: qwen2.5:7b ist installiert und aktiviert.
echo Wirksam ab der naechsten Strukturierung in der App.
echo Zurueck zum schnellen Modell: "Schnelles Modell (3b) zurueck.bat".
echo.
pause
endlocal
