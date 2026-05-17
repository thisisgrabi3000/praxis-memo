@echo off
setlocal
cd /d "%~dp0"

echo.
echo Praxis Memo wird lokal gestartet...
echo Dieses Fenster bitte offen lassen, solange die App genutzt wird.
echo.

where py >nul 2>nul
if %errorlevel%==0 (
  py praxis_memo_server.py
  goto ende
)

where python >nul 2>nul
if %errorlevel%==0 (
  python praxis_memo_server.py
  goto ende
)

echo Python wurde nicht gefunden.
echo Bitte Python aus dem Microsoft Store installieren und danach diese Datei erneut starten.
echo.
pause

:ende
endlocal
