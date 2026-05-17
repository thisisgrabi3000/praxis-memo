@echo off
setlocal enabledelayedexpansion
title Praxis Memo aktualisieren
cd /d "%~dp0"

echo.
echo ================================================
echo   Praxis Memo aktualisieren
echo ================================================
echo.
echo Dieses Fenster aktualisiert die KI-Bestandteile.
echo Deine Patientendaten werden vorher gesichert.
echo.
echo Geschaetzte Dauer: 2-10 Minuten je nach Internet.
echo.
pause

REM ============================================================
REM Schritt 1: Sicherheits-Backup vor dem Update
REM ============================================================
echo.
echo ------------------------------------------------
echo Schritt 1: Sicherheits-Backup anlegen
echo ------------------------------------------------
if exist "data\praxismemo-data.json" (
    for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm-ss"') do set BACKUP_STAMP=%%i
    if not exist "backups\vor-update" mkdir "backups\vor-update"
    copy /Y "data\praxismemo-data.json" "backups\vor-update\praxismemo-vor-update-!BACKUP_STAMP!.json" >nul
    echo Backup erstellt: backups\vor-update\praxismemo-vor-update-!BACKUP_STAMP!.json
) else (
    echo Noch keine Patientendaten vorhanden - Backup uebersprungen.
)

REM ============================================================
REM Schritt 2: Python pruefen
REM ============================================================
echo.
echo ------------------------------------------------
echo Schritt 2: Python pruefen
echo ------------------------------------------------
set PY_EXE=
where py >nul 2>nul
if %errorlevel%==0 set PY_EXE=py
if not defined PY_EXE (
    where python >nul 2>nul
    if %errorlevel%==0 set PY_EXE=python
)
if not defined PY_EXE (
    echo.
    echo Python nicht gefunden.
    echo Bitte zuerst "KI einrichten.bat" ausfuehren.
    pause
    exit /b 1
)
echo Python OK: %PY_EXE%

REM ============================================================
REM Schritt 3: Diktat-KI aktualisieren (faster-whisper)
REM ============================================================
echo.
echo ------------------------------------------------
echo Schritt 3: Diktat-KI aktualisieren
echo ------------------------------------------------
%PY_EXE% -m pip install --upgrade pip >nul 2>nul
%PY_EXE% -m pip install --upgrade faster-whisper
if %errorlevel% neq 0 (
    echo.
    echo WARNUNG: faster-whisper konnte nicht aktualisiert werden.
    echo Bestehende Version laeuft weiter.
)

REM ============================================================
REM Schritt 4: Ollama pruefen
REM ============================================================
echo.
echo ------------------------------------------------
echo Schritt 4: Strukturierungs-KI pruefen
echo ------------------------------------------------
set OLLAMA_EXE=
where ollama >nul 2>nul
if %errorlevel%==0 set OLLAMA_EXE=ollama
if not defined OLLAMA_EXE (
    if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" set OLLAMA_EXE="%LOCALAPPDATA%\Programs\Ollama\ollama.exe"
)
if not defined OLLAMA_EXE (
    echo.
    echo Ollama nicht gefunden.
    echo Bitte zuerst "KI einrichten.bat" ausfuehren.
    pause
    exit /b 1
)
echo Ollama OK.

REM ============================================================
REM Schritt 5: Strukturierungs-Modell aktualisieren
REM ============================================================
echo.
echo ------------------------------------------------
echo Schritt 5: Strukturierungs-Modell pruefen/aktualisieren
echo ------------------------------------------------
echo Ollama prueft ob eine neuere Version verfuegbar ist.
echo Wenn das Modell aktuell ist, geht das in Sekunden.
echo.
%OLLAMA_EXE% pull qwen2.5:3b
if %errorlevel% neq 0 (
    echo.
    echo WARNUNG: Strukturierungs-Modell konnte nicht aktualisiert werden.
    echo Bestehende Version laeuft weiter.
)

REM ============================================================
REM Schritt 6: Desktop-Verknuepfung neu anlegen (falls geloescht)
REM ============================================================
echo.
echo ------------------------------------------------
echo Schritt 6: Desktop-Verknuepfung pruefen
echo ------------------------------------------------
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$desktop = [Environment]::GetFolderPath('Desktop');" ^
  "if (-not (Test-Path ($desktop + '\Praxis Memo.lnk'))) {" ^
  "  $ws = New-Object -ComObject WScript.Shell;" ^
  "  $lnk = $ws.CreateShortcut($desktop + '\Praxis Memo.lnk');" ^
  "  $lnk.TargetPath = '%~dp0Start Praxis Memo.bat';" ^
  "  $lnk.WorkingDirectory = '%~dp0';" ^
  "  $lnk.IconLocation = '%SystemRoot%\System32\imageres.dll,144';" ^
  "  $lnk.Description = 'Praxis Memo lokal starten';" ^
  "  $lnk.Save();" ^
  "  Write-Host 'Verknuepfung neu angelegt.';" ^
  "} else { Write-Host 'Verknuepfung vorhanden.' }"

REM ============================================================
REM Fertig
REM ============================================================
echo.
echo ================================================
echo   Update fertig.
echo.
echo   Bei Problemen: Backup liegt in
echo   backups\vor-update\
echo.
echo   App starten: Doppelklick auf das
echo   Desktop-Icon "Praxis Memo".
echo ================================================
echo.
pause
endlocal
