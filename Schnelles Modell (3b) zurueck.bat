@echo off
setlocal
title Praxis Memo - Zurueck auf schnelles Modell
cd /d "%~dp0"

echo.
echo Stellt die App zurueck auf das schnelle Modell qwen2.5:3b.
echo.

if not exist "data" mkdir "data"
> "data\ki-modell.txt" echo qwen2.5:3b

echo FERTIG: Aktives Modell ist wieder qwen2.5:3b.
echo Wirksam ab der naechsten Strukturierung in der App.
echo.
pause
endlocal
