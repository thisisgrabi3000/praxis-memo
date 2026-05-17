@echo off
setlocal enabledelayedexpansion
title Praxis Memo aktualisieren
cd /d "%~dp0"

echo.
echo ================================================
echo   Praxis Memo aktualisieren
echo ================================================
echo.
echo Dieses Fenster aktualisiert die App und die KI.
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
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm-ss"') do set BACKUP_STAMP=%%i

if exist "data\praxismemo-data.json" (
    if not exist "backups\vor-update" mkdir "backups\vor-update"
    copy /Y "data\praxismemo-data.json" "backups\vor-update\praxismemo-vor-update-!BACKUP_STAMP!.json" >nul
    echo Daten-Backup: backups\vor-update\praxismemo-vor-update-!BACKUP_STAMP!.json
) else (
    echo Noch keine Patientendaten vorhanden - Daten-Backup uebersprungen.
)

REM Backup der alten App-Dateien (falls Code-Update fehlschlaegt -> Rollback moeglich)
if not exist "backups\vor-update\code-!BACKUP_STAMP!" mkdir "backups\vor-update\code-!BACKUP_STAMP!"
for %%F in (app.js index.html styles.css praxis_memo_server.py VERSION) do (
    if exist "%%F" copy /Y "%%F" "backups\vor-update\code-!BACKUP_STAMP!\%%F" >nul
)
echo Code-Backup: backups\vor-update\code-!BACKUP_STAMP!\

REM ============================================================
REM Schritt 2: App-Code von GitHub aktualisieren
REM ============================================================
echo.
echo ------------------------------------------------
echo Schritt 2: App-Code aktualisieren (von GitHub)
echo ------------------------------------------------
set CODE_URL=https://github.com/thisisgrabi3000/praxis-memo/releases/latest/download/praxis-memo-app.zip
set CODE_ZIP=%TEMP%\praxis-memo-app.zip

echo Lade neueste Version...
curl -L --fail --silent --show-error -o "%CODE_ZIP%" "%CODE_URL%"
if %errorlevel% neq 0 (
    echo.
    echo WARNUNG: Download fehlgeschlagen ^(Internet?^).
    echo App-Code bleibt unveraendert. KI-Update wird trotzdem versucht.
    goto :skip_code_update
)

echo Entpacke neue Version...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { Expand-Archive -Path '%CODE_ZIP%' -DestinationPath '%~dp0' -Force; exit 0 } catch { Write-Host $_.Exception.Message; exit 1 }"
if %errorlevel% neq 0 (
    echo.
    echo WARNUNG: Entpacken fehlgeschlagen. App-Code wird aus Backup wiederhergestellt.
    for %%F in (app.js index.html styles.css praxis_memo_server.py VERSION) do (
        if exist "backups\vor-update\code-!BACKUP_STAMP!\%%F" copy /Y "backups\vor-update\code-!BACKUP_STAMP!\%%F" "%%F" >nul
    )
    goto :skip_code_update
)

del /Q "%CODE_ZIP%" >nul 2>nul
if exist "VERSION" (
    set /p NEW_VER=<VERSION
    echo App-Code aktualisiert auf Version !NEW_VER!
) else (
    echo App-Code aktualisiert.
)

:skip_code_update

REM ============================================================
REM Schritt 3: Python pruefen
REM ============================================================
echo.
echo ------------------------------------------------
echo Schritt 3: Python pruefen
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
REM Schritt 4: Diktat-KI aktualisieren (faster-whisper)
REM ============================================================
echo.
echo ------------------------------------------------
echo Schritt 4: Diktat-KI aktualisieren
echo ------------------------------------------------
%PY_EXE% -m pip install --upgrade pip >nul 2>nul
%PY_EXE% -m pip install --upgrade faster-whisper
if %errorlevel% neq 0 (
    echo.
    echo WARNUNG: faster-whisper konnte nicht aktualisiert werden.
    echo Bestehende Version laeuft weiter.
)

REM ============================================================
REM Schritt 5: Ollama pruefen
REM ============================================================
echo.
echo ------------------------------------------------
echo Schritt 5: Strukturierungs-KI pruefen
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
REM Schritt 6: Strukturierungs-Modell aktualisieren
REM ============================================================
echo.
echo ------------------------------------------------
echo Schritt 6: Strukturierungs-Modell pruefen/aktualisieren
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
REM Schritt 7: Desktop-Verknuepfung neu anlegen (falls geloescht)
REM ============================================================
echo.
echo ------------------------------------------------
echo Schritt 7: Desktop-Verknuepfung pruefen
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
echo   Bei Problemen: Backups liegen in
echo   backups\vor-update\
echo.
echo   App starten: Doppelklick auf das
echo   Desktop-Icon "Praxis Memo".
echo ================================================
echo.
pause
endlocal
