@echo off
setlocal
title Praxis Memo - PC KI Leistung pruefen
cd /d "%~dp0"

if not exist "data" mkdir "data"
set "REPORT=data\pc-ki-check.txt"

echo.
echo ================================================
echo   Praxis Memo - PC KI Leistung pruefen
echo ================================================
echo.
echo Dieses Skript prueft RAM, CPU und lokale Ollama-Modelle.
echo Es startet KEINEN Download und aendert keine App-Daten.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'SilentlyContinue';" ^
  "$cs = Get-CimInstance Win32_ComputerSystem;" ^
  "$os = Get-CimInstance Win32_OperatingSystem;" ^
  "$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1;" ^
  "$ramGb = [math]::Round($cs.TotalPhysicalMemory / 1GB, 1);" ^
  "$freeGb = [math]::Round($os.FreePhysicalMemory / 1MB, 1);" ^
  "$ollama = Get-Command ollama -ErrorAction SilentlyContinue;" ^
  "$models = if ($ollama) { (& ollama list 2>$null | Out-String).Trim() } else { '' };" ^
  "$has3b = $models -match 'qwen2\.5:3b';" ^
  "$has7b = $models -match 'qwen2\.5:7b';" ^
  "$recommendation = if ($ramGb -ge 16) { 'OK fuer qwen2.5:7b-Test. 3b bleibt schneller; 7b nur uebernehmen, wenn Strukturierung deutlich besser und Wartezeit akzeptabel ist.' } elseif ($ramGb -ge 12) { 'EINGESCHRAENKT: qwen2.5:7b kann knapp werden. Fuer Praxisbetrieb eher qwen2.5:3b behalten.' } else { 'NICHT EMPFOHLEN: Fuer qwen2.5:7b zu wenig RAM. qwen2.5:3b verwenden.' };" ^
  "$lines = @();" ^
  "$lines += 'Praxis Memo - PC KI Check';" ^
  "$lines += ('Datum: ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'));" ^
  "$lines += '';" ^
  "$lines += ('Computer: ' + $env:COMPUTERNAME);" ^
  "$lines += ('CPU: ' + $cpu.Name);" ^
  "$lines += ('RAM gesamt: ' + $ramGb + ' GB');" ^
  "$lines += ('RAM aktuell frei: ' + $freeGb + ' GB');" ^
  "$lines += ('Ollama gefunden: ' + [bool]$ollama);" ^
  "$lines += ('qwen2.5:3b vorhanden: ' + $has3b);" ^
  "$lines += ('qwen2.5:7b vorhanden: ' + $has7b);" ^
  "$lines += '';" ^
  "$lines += 'Empfehlung:';" ^
  "$lines += $recommendation;" ^
  "$lines += '';" ^
  "$lines += 'Installierte Ollama-Modelle:';" ^
  "$lines += ($(if ($models) { $models } else { 'Keine oder Ollama nicht erreichbar.' }));" ^
  "$lines | Tee-Object -FilePath '%REPORT%';"

echo.
echo Bericht gespeichert in: %REPORT%
echo.
pause

endlocal
