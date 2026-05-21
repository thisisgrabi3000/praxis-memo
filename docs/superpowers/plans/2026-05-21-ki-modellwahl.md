# Umschaltbares KI-Modell (3b ↔ 7b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die behandelnde Person kann per Doppelklick vom Standardmodell `qwen2.5:3b` auf `qwen2.5:7b` umstellen (nur ab 16 GB RAM) und jederzeit zurück, ohne dass App-Updates die Wahl zurücksetzen.

**Architecture:** Der Server liest das aktive Modell pro `/api/structure`-Anfrage aus `data/ki-modell.txt` (Allowlist + 3b-Fallback). Zwei Windows-`.bat`-Dateien schreiben diese Datei (Installieren+Aktivieren bzw. Zurückschalten). `data/` überlebt App-Updates, daher bleibt die Wahl bestehen.

**Tech Stack:** Python-Standardbibliothek (`http.server`), Vanilla JS, Windows-Batch + PowerShell, Ollama. Tests: stdlib-`assert`-Skripte (`python3`), `node --check`, isolierter Temp-Server via `curl`.

---

## File Structure

- `praxis_memo_server.py` — Modell-Konstanten, Allowlist, `active_model()`, Nutzung in `structure_via_ollama()`, `model`-Feld in `/api/structure-status`.
- `app.js` — KI-Status zeigt aktives Modell.
- `Besseres Modell installieren.bat` (neu) — RAM-Gate + `ollama pull` + Aktivierung.
- `Schnelles Modell (3b) zurueck.bat` (neu) — Zurückschalten auf 3b.
- `Paket erstellen.bat` — beide neuen Bats ins ZIP.
- `tests/test_active_model.py` (neu) — Unit-Tests für `active_model()`.
- `tests/test_structure_status.sh` (neu) — Integrationstest `model`-Feld im Status.
- `docs/HANDOVER.md`, `docs/release-notes-v1.0.6.md` — Doku.

Hinweis: `data/ki-modell.txt` ist eine pro-PC-Laufzeitdatei — **nicht** ins Repo, **nicht** ins ZIP. (`data/` ist bereits gitignored.)

---

### Task 1: Server — `active_model()` mit Allowlist und 3b-Fallback

**Files:**
- Modify: `praxis_memo_server.py:37` (Konstanten) und neue Funktion direkt nach `ollama_available()` (um Zeile 130)
- Modify: `praxis_memo_server.py` — `structure_via_ollama()` Body (`"model": OLLAMA_MODEL`)
- Test: `tests/test_active_model.py` (neu)

- [ ] **Step 1: Failing test schreiben**

`tests/test_active_model.py`:
```python
import importlib.util, tempfile, os
from pathlib import Path

spec = importlib.util.spec_from_file_location("pms", "praxis_memo_server.py")
pms = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pms)

def with_model_file(content):
    tmp = Path(tempfile.mkdtemp()) / "ki-modell.txt"
    if content is not None:
        tmp.write_text(content, encoding="utf-8")
    pms.MODEL_FILE = tmp
    return tmp

def run():
    fails = []
    def ck(name, cond):
        print(("  OK " if cond else "  FAIL ") + name)
        if not cond: fails.append(name)

    with_model_file(None)            # Datei fehlt
    ck("fehlt -> 3b", pms.active_model() == "qwen2.5:3b")
    with_model_file("")              # leer
    ck("leer -> 3b", pms.active_model() == "qwen2.5:3b")
    with_model_file("qwen2.5:7b")
    ck("7b -> 7b", pms.active_model() == "qwen2.5:7b")
    with_model_file("  qwen2.5:7b\n")
    ck("whitespace -> 7b", pms.active_model() == "qwen2.5:7b")
    with_model_file("qwen2.5:3b")
    ck("3b -> 3b", pms.active_model() == "qwen2.5:3b")
    with_model_file("gpt-4")         # nicht in Allowlist
    ck("ungueltig -> 3b", pms.active_model() == "qwen2.5:3b")

    print("RESULT:", "ALL OK" if not fails else f"{len(fails)} FAIL")
    raise SystemExit(1 if fails else 0)

if __name__ == "__main__":
    run()
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `python3 tests/test_active_model.py`
Expected: FAIL — `AttributeError: module 'pms' has no attribute 'MODEL_FILE'` bzw. `active_model`.

- [ ] **Step 3: Konstanten + `active_model()` implementieren**

In `praxis_memo_server.py` Zeile 37 ersetzen:
```python
OLLAMA_MODEL = "qwen2.5:3b"
```
durch:
```python
DEFAULT_OLLAMA_MODEL = "qwen2.5:3b"
ALLOWED_MODELS = {"qwen2.5:3b", "qwen2.5:7b"}
```

Neue Funktion direkt nach `ollama_available()` einfügen (nach deren `return`-Block):
```python
MODEL_FILE = DATA_DIR / "ki-modell.txt"


def active_model() -> str:
    """Liest das aktive Strukturierungsmodell aus data/ki-modell.txt.
    Fallback auf DEFAULT_OLLAMA_MODEL bei fehlender/leerer/ungültiger Datei."""
    try:
        name = MODEL_FILE.read_text(encoding="utf-8").strip()
    except OSError:
        return DEFAULT_OLLAMA_MODEL
    return name if name in ALLOWED_MODELS else DEFAULT_OLLAMA_MODEL
```
(`DATA_DIR` ist bereits in Zeile 20 definiert; `MODEL_FILE` daher gültig.)

In `structure_via_ollama()` den Body-Eintrag ändern:
```python
        "model": OLLAMA_MODEL,
```
zu:
```python
        "model": active_model(),
```

- [ ] **Step 4: Test laufen lassen, grün bestätigen**

Run: `python3 tests/test_active_model.py`
Expected: alle `OK`, `RESULT: ALL OK`, Exit 0.

- [ ] **Step 5: Compile-Check**

Run: `python3 -m py_compile praxis_memo_server.py`
Expected: keine Ausgabe, Exit 0.

- [ ] **Step 6: Commit**

```bash
git add praxis_memo_server.py tests/test_active_model.py
git commit -m "feat: active_model() liest Strukturierungsmodell aus data/ki-modell.txt"
```

---

### Task 2: Server — aktives Modell in `/api/structure-status`

**Files:**
- Modify: `praxis_memo_server.py:443`
- Test: `tests/test_structure_status.sh` (neu)

- [ ] **Step 1: Failing test schreiben**

`tests/test_structure_status.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
TDIR=$(mktemp -d /tmp/pms-status-test.XXXXXX)
cp praxis_memo_server.py app.js index.html styles.css "$TDIR"/
PORT=3066
( cd "$TDIR" && python3 praxis_memo_server.py --port $PORT --no-browser >/dev/null 2>&1 & echo $! > "$TDIR/pid" )
sleep 1
B="http://127.0.0.1:$PORT"
for i in $(seq 1 20); do curl -s -o /dev/null "$B/api/structure-status" && break; sleep 0.3; done

echo "Default (keine Datei):"; DEF=$(curl -s "$B/api/structure-status"); echo "  $DEF"
echo "$DEF" | grep -q '"model": "qwen2.5:3b"' && echo "  OK default 3b" || { echo "  FAIL default"; kill "$(cat "$TDIR/pid")"; exit 1; }

# 7b aktivieren (Server liest pro Anfrage neu)
mkdir -p "$TDIR/data"; printf 'qwen2.5:7b' > "$TDIR/data/ki-modell.txt"
echo "Nach 7b-Aktivierung:"; SET=$(curl -s "$B/api/structure-status"); echo "  $SET"
echo "$SET" | grep -q '"model": "qwen2.5:7b"' && echo "  OK 7b" || { echo "  FAIL 7b"; kill "$(cat "$TDIR/pid")"; exit 1; }

kill "$(cat "$TDIR/pid")" 2>/dev/null || true
rm -rf "$TDIR"
echo "RESULT: ALL OK"
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `bash tests/test_structure_status.sh`
Expected: FAIL — Status-Antwort enthält noch kein `"model"`-Feld (`FAIL default`).

- [ ] **Step 3: Status-Handler erweitern**

In `praxis_memo_server.py:443` ersetzen:
```python
            self.send_json(200, {"available": ollama_available(), "mode": "local"})
```
durch:
```python
            self.send_json(200, {"available": ollama_available(), "mode": "local", "model": active_model()})
```

- [ ] **Step 4: Test laufen lassen, grün bestätigen**

Run: `bash tests/test_structure_status.sh`
Expected: `OK default 3b`, `OK 7b`, `RESULT: ALL OK`.

- [ ] **Step 5: Commit**

```bash
git add praxis_memo_server.py tests/test_structure_status.sh
git commit -m "feat: /api/structure-status meldet aktives Modell"
```

---

### Task 3: Frontend — aktives Modell im KI-Status anzeigen

**Files:**
- Modify: `app.js` — globale Variable bei `kiMode`, `checkKiAvailability()`, `renderKiStatus()`

- [ ] **Step 1: Globale Modell-Variable ergänzen**

Bei der Deklaration von `kiMode` (Suche `let kiMode` bzw. `var kiMode`/`kiMode =`) eine Variable ergänzen:
```javascript
let kiModel = "";
```
(Falls `kiMode` ohne `let`/`var` als bloße Zuweisung existiert, dieselbe Stelle nutzen und `kiModel` analog deklarieren.)

- [ ] **Step 2: Modell aus Status übernehmen**

In `checkKiAvailability()` nach `kiMode = data.mode || "local";` ergänzen:
```javascript
      kiModel = data.model || "";
```

- [ ] **Step 3: Modell im Status-Text anzeigen**

In `renderKiStatus()` den Erfolgszweig ändern von:
```javascript
  } else {
    kiStatus.textContent = "KI bereit (lokal)";
  }
```
zu:
```javascript
  } else {
    kiStatus.textContent = kiModel ? `KI bereit (lokal, ${kiModel})` : "KI bereit (lokal)";
  }
```

- [ ] **Step 4: Syntax-Check**

Run: `node --check app.js`
Expected: keine Ausgabe, Exit 0.

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "feat: KI-Status zeigt aktives Strukturierungsmodell"
```

---

### Task 4: `Besseres Modell installieren.bat` (RAM-Gate + Pull + Aktivierung)

**Files:**
- Create: `Besseres Modell installieren.bat`

- [ ] **Step 1: Datei anlegen**

`Besseres Modell installieren.bat`:
```bat
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
```

- [ ] **Step 2: Review-Check der Logik**

Prüfen (visuell, da Windows-only): RAM-Gate `LSS 16` blockt und schreibt nichts; `data\ki-modell.txt` wird nur nach erfolgreichem `ollama pull` geschrieben; geschriebener Wert `qwen2.5:7b` liegt in der Server-Allowlist (Task 1). `> "data\ki-modell.txt" echo qwen2.5:7b` schreibt genau eine Zeile.

- [ ] **Step 3: Commit**

```bash
git add "Besseres Modell installieren.bat"
git commit -m "feat: Bat zum Installieren/Aktivieren von qwen2.5:7b (Hard-Block <16 GB)"
```

---

### Task 5: `Schnelles Modell (3b) zurueck.bat` (Rückfahrkarte)

**Files:**
- Create: `Schnelles Modell (3b) zurueck.bat`

- [ ] **Step 1: Datei anlegen**

`Schnelles Modell (3b) zurueck.bat`:
```bat
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
```

- [ ] **Step 2: Review-Check**

Prüfen: schreibt genau `qwen2.5:3b` (in Allowlist), lädt nichts, kein Fehlerpfad nötig.

- [ ] **Step 3: Commit**

```bash
git add "Schnelles Modell (3b) zurueck.bat"
git commit -m "feat: Bat zum Zurueckschalten auf qwen2.5:3b"
```

---

### Task 6: Packaging — beide Bats ins Release-ZIP

**Files:**
- Modify: `Paket erstellen.bat`

- [ ] **Step 1: ZIP-Inhaltsliste erweitern**

In `Paket erstellen.bat` die `Compress-Archive`-`-Path`-Liste erweitern um die beiden neuen Dateien. Aktuell:
```
'index.html','styles.css','app.js','praxis_memo_server.py','Start Praxis Memo.bat','KI einrichten.bat','Datenordner oeffnen.bat','PC KI Leistung pruefen.bat','README_PC_INSTALLATION.txt'
```
ergänzen zu (neue Einträge am Ende vor `README_PC_INSTALLATION.txt`):
```
'index.html','styles.css','app.js','praxis_memo_server.py','Start Praxis Memo.bat','KI einrichten.bat','Datenordner oeffnen.bat','PC KI Leistung pruefen.bat','Besseres Modell installieren.bat','Schnelles Modell (3b) zurueck.bat','README_PC_INSTALLATION.txt'
```

- [ ] **Step 2: Review-Check**

Prüfen: Datei-Namen exakt (Leerzeichen, Klammern). Hinweis für den Release-Build: das hochzuladende `praxis-memo-app.zip` muss beide Bats enthalten (sonst kommen sie per `Praxis Memo Update.bat` nicht auf den NUC — siehe Lessons Learned in CLAUDE.md).

- [ ] **Step 3: Commit**

```bash
git add "Paket erstellen.bat"
git commit -m "build: Modell-Bats ins Release-ZIP aufnehmen"
```

---

### Task 7: Dokumentation

**Files:**
- Modify: `docs/HANDOVER.md`
- Create: `docs/release-notes-v1.0.6.md`

- [ ] **Step 1: HANDOVER ergänzen**

In `docs/HANDOVER.md` im Änderungsprotokoll oben einen Abschnitt einfügen:
```markdown
### 2026-05-21 — Umschaltbares KI-Modell (Release v1.0.6)

- `data/ki-modell.txt` (pro PC, überlebt App-Updates) bestimmt das Strukturierungsmodell.
- Server: `active_model()` liest die Datei pro `/api/structure`-Anfrage, Allowlist
  `{qwen2.5:3b, qwen2.5:7b}`, Fallback `qwen2.5:3b`. `/api/structure-status` meldet `model`.
- Frontend zeigt das aktive Modell im KI-Status.
- `Besseres Modell installieren.bat` (Hard-Block <16 GB, `ollama pull qwen2.5:7b`,
  aktiviert nur nach erfolgreichem Pull) und `Schnelles Modell (3b) zurueck.bat`.
```

- [ ] **Step 2: Release-Notes anlegen**

`docs/release-notes-v1.0.6.md`:
```markdown
# Release Notes v1.0.6 — Umschaltbares KI-Modell

Stand: 2026-05-21

## Neu
- Optionaler Wechsel auf das größere Strukturierungsmodell `qwen2.5:7b` auf RAM-starken PCs.

## Bedienung
1. `PC KI Leistung pruefen.bat` doppelklicken → RAM prüfen (`data/pc-ki-check.txt`).
2. Ab 16 GB RAM: `Besseres Modell installieren.bat` doppelklicken → lädt und aktiviert 7b.
   Unter 16 GB bricht das Skript ab und ändert nichts.
3. Zu langsam? `Schnelles Modell (3b) zurueck.bat` doppelklicken → zurück auf 3b.
4. Das aktive Modell steht im KI-Status oben in der App.

## Technisch
- Server liest das aktive Modell aus `data/ki-modell.txt` (überlebt App-Updates), Fallback 3b.
- KI-Ausgaben müssen weiterhin fachlich geprüft werden; 7b ist langsamer als 3b.

## Deploy-Dateien (Release-ZIP)
- zusätzlich zu v1.0.5: `Besseres Modell installieren.bat`, `Schnelles Modell (3b) zurueck.bat`.
```

- [ ] **Step 3: Commit**

```bash
git add docs/HANDOVER.md docs/release-notes-v1.0.6.md
git commit -m "docs: v1.0.6 Modellwahl in HANDOVER und Release-Notes"
```

---

## Abschluss (nach allen Tasks)

- Gesamt-Verifikation: `python3 tests/test_active_model.py`, `bash tests/test_structure_status.sh`, `python3 -m py_compile praxis_memo_server.py`, `node --check app.js`.
- **Manuell auf dem NUC (nicht lokal testbar):** beide Bats doppelklicken, RAM-Gate prüfen, echte 7b-Strukturierung gegen Ollama, KI-Status zeigt korrektes Modell, Zurückschalten wirkt.
- Deploy (push + Release v1.0.6 mit aktualisiertem `praxis-memo-app.zip`) erst nach ausdrücklicher Freigabe.
