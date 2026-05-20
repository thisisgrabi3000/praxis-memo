@echo off
REM ============================================================
REM  BitLocker- / Verschluesselungs-Status pruefen
REM  Doppelklick auf Miriams PC. Zeigt Windows-Edition,
REM  BitLocker-Status und TPM. Aendert NICHTS, nur Anzeige.
REM ============================================================

REM --- Selbst-Elevation: manage-bde / Get-Tpm brauchen Adminrechte ---
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Starte mit Administratorrechten neu... bitte UAC mit "Ja" bestaetigen.
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

title BitLocker- und Windows-Status
echo ================================================
echo   BitLocker- / Verschluesselungs-Status
echo ================================================
echo.
echo --- Windows-Edition (BitLocker nur in Pro/Enterprise/Education) ---
powershell -NoProfile -Command "(Get-CimInstance Win32_OperatingSystem).Caption"
echo.
echo --- BitLocker-Status Laufwerk C: ---
manage-bde -status C:
echo.
echo --- TPM-Chip vorhanden? ---
powershell -NoProfile -Command "try { $t = Get-Tpm; 'TpmPresent : ' + $t.TpmPresent + '   TpmReady : ' + $t.TpmReady } catch { 'TPM-Info nicht abrufbar.' }"
echo.
echo ================================================
echo  So liest du das Ergebnis:
echo.
echo   Edition "Pro/Enterprise/Education" = BitLocker verfuegbar.
echo   Edition "Home"                     = kein BitLocker -> Alternative (siehe Checkliste).
echo.
echo   "Conversion Status: Fully Encrypted" + "Protection On"  = verschluesselt + aktiv  -> GUT.
echo   "Protection Off" oder "Fully Decrypted"                 = NICHT geschuetzt        -> einschalten.
echo ================================================
echo.
echo  Hinweis: Liegt der Datenordner der App nicht auf C:,
echo  pruefe das betreffende Laufwerk: manage-bde -status X:
echo.
pause
