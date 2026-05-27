@echo off
setlocal enabledelayedexpansion
title KI fuer Praxis Memo einrichten

echo.
echo ================================================
echo   KI fuer Praxis Memo einrichten
echo ================================================
echo.
echo Dieses Fenster richtet die lokale KI ein.
echo Alle Daten bleiben auf diesem PC.
echo.
echo Geschaetzte Dauer: 15-30 Minuten je nach Internet.
echo.
pause

REM ============================================================
REM Schritt 0: Python pruefen
REM ============================================================
echo.
echo ------------------------------------------------
echo Pruefe Python-Installation...
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
    echo Python wurde nicht gefunden.
    echo.
    echo Bitte zuerst Python aus dem Microsoft Store installieren:
    echo Suche im Store nach "Python 3.12" und installiere die Version
    echo von der "Python Software Foundation".
    echo.
    echo Der Microsoft Store oeffnet sich gleich automatisch.
    timeout /t 4 /nobreak >nul
    start "" "ms-windows-store://pdp/?ProductId=9NCVDN91XZQP"
    echo.
    echo Nach der Installation bitte dieses Fenster nochmal starten.
    pause
    exit /b 1
)
echo Python gefunden: %PY_EXE%

REM ============================================================
REM Schritt 1: Visual C++ Redistributable
REM ============================================================
echo.
echo ------------------------------------------------
echo Schritt 1: Visual C++ Redistributable pruefen
echo ------------------------------------------------
where winget >nul 2>nul
if %errorlevel%==0 (
    winget install --id Microsoft.VCRedist.2015+.x64 --accept-source-agreements --accept-package-agreements --silent --disable-interactivity 2>nul
) else (
    echo winget nicht verfuegbar - VC++ Redistributable wird uebersprungen.
    echo Falls Whisper spaeter nicht startet, bitte manuell installieren:
    echo https://aka.ms/vs/17/release/vc_redist.x64.exe
)

REM ============================================================
REM Schritt 2: Ollama (Strukturierungs-KI)
REM ============================================================
echo.
echo ------------------------------------------------
echo Schritt 2: Ollama installieren
echo ------------------------------------------------
set OLLAMA_EXE=
where ollama >nul 2>nul
if %errorlevel%==0 set OLLAMA_EXE=ollama
if not defined OLLAMA_EXE (
    if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" set OLLAMA_EXE="%LOCALAPPDATA%\Programs\Ollama\ollama.exe"
)
if defined OLLAMA_EXE (
    echo Ollama bereits installiert.
    goto :install_python_pkgs
)

echo Ollama herunterladen ^(ca. 150 MB^)...
curl -L --progress-bar -o "%TEMP%\OllamaSetup.exe" "https://ollama.com/download/OllamaSetup.exe"
if %errorlevel% neq 0 (
    echo.
    echo FEHLER: Datei konnte nicht heruntergeladen werden.
    echo Bitte Internetverbindung pruefen und nochmal versuchen.
    pause
    exit /b 1
)

echo.
echo Ollama installieren - bitte den Anweisungen im Fenster folgen.
"%TEMP%\OllamaSetup.exe"
timeout /t 5 /nobreak >nul

set OLLAMA_EXE=ollama
if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" set OLLAMA_EXE="%LOCALAPPDATA%\Programs\Ollama\ollama.exe"

REM ============================================================
REM Schritt 3: Python-Pakete (Diktat-KI)
REM ============================================================
:install_python_pkgs
echo.
echo ------------------------------------------------
echo Schritt 3: Diktat-KI installieren (Whisper)
echo ------------------------------------------------
%PY_EXE% -m pip install --upgrade pip >nul 2>nul
%PY_EXE% -m pip install --upgrade faster-whisper
if %errorlevel% neq 0 (
    echo.
    echo FEHLER: faster-whisper konnte nicht installiert werden.
    echo Pruefe die Internetverbindung und Python-Installation.
    pause
    exit /b 1
)

REM ============================================================
REM Schritt 4: Diktat-Modell vorladen
REM ============================================================
echo.
echo ------------------------------------------------
echo Schritt 4: Diktat-Modell vorladen (ca. 500 MB)
echo ------------------------------------------------
%PY_EXE% -c "from faster_whisper import WhisperModel; WhisperModel('small', device='cpu', compute_type='int8'); print('OK')"
if %errorlevel% neq 0 (
    echo.
    echo WARNUNG: Diktat-Modell konnte nicht vorgeladen werden.
    echo Wird beim ersten Diktat automatisch geladen.
)

REM ============================================================
REM Schritt 5: Strukturierungs-Modell laden
REM ============================================================
echo.
echo ------------------------------------------------
echo Schritt 5: Strukturierungs-KI laden (ca. 2 GB)
echo ------------------------------------------------
echo Das kann 5-15 Minuten dauern. Bitte warten.
echo.
%OLLAMA_EXE% pull qwen2.5:3b
if %errorlevel% neq 0 (
    echo.
    echo FEHLER beim Laden des Strukturierungs-Modells.
    echo Pruefe Ollama-Installation und Internet.
    pause
    exit /b 1
)

REM ============================================================
REM Schritt 6: Desktop-Verknuepfung anlegen
REM ============================================================
echo.
echo ------------------------------------------------
echo Schritt 6: Desktop-Verknuepfung anlegen
echo ------------------------------------------------
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell;" ^
  "$lnk = $ws.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\Praxis Memo.lnk');" ^
  "$lnk.TargetPath = '%~dp0Start Praxis Memo.bat';" ^
  "$lnk.WorkingDirectory = '%~dp0';" ^
  "$lnk.IconLocation = '%SystemRoot%\System32\imageres.dll,144';" ^
  "$lnk.Description = 'Praxis Memo lokal starten';" ^
  "$lnk.Save()"
if %errorlevel%==0 (
    echo Verknuepfung "Praxis Memo" auf dem Desktop angelegt.
) else (
    echo Hinweis: Desktop-Verknuepfung konnte nicht angelegt werden ^(nicht kritisch^).
)

REM ============================================================
REM Fertig
REM ============================================================
echo.
echo ================================================
echo   Fertig! Alle KI-Funktionen sind bereit:
echo.
echo   - Diktat (Einsprechen) in jedem Browser
echo   - Strukturierung der Notizen
echo   - Desktop-Verknuepfung "Praxis Memo"
echo.
echo   Doppelklick auf das Desktop-Icon startet die App.
echo ================================================
echo.
pause
endlocal
