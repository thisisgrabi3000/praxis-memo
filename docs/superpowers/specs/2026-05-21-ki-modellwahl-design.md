# Design: Umschaltbares KI-Strukturierungsmodell (3b ↔ 7b)

Stand: 2026-05-21
Status: freigegeben (Brainstorming)

## Ziel

Auf einem RAM-starken Praxis-PC soll die behandelnde Person (nicht-technisch) per
Doppelklick vom schnellen Standardmodell `qwen2.5:3b` auf das größere `qwen2.5:7b`
umstellen können — und jederzeit wieder zurück. Ohne Code-Kenntnis, und ohne dass ein
App-Update die Wahl zurücksetzt.

Nicht-Ziel: keine In-App-UI zum Umschalten, keine weiteren Modelle, keine automatische
RAM-Erkennung innerhalb der Web-App.

## Kontext (Ist-Zustand)

- `praxis_memo_server.py`: `OLLAMA_MODEL = "qwen2.5:3b"` ist fest verdrahtet und wird in
  `structure_via_ollama()` an Ollama gegeben.
- `data/` ist gitignored und wird von `Praxis Memo Update.bat` (`Expand-Archive -Force`)
  **nicht** überschrieben → geeignet für eine pro-PC-Einstellung, die App-Updates überlebt.
- `PC KI Leistung pruefen.bat` misst RAM und empfiehlt 3b/7b, **installiert aber nichts**.
- Release-Mechanik: `Praxis Memo Update.bat` entpackt das komplette `praxis-memo-app.zip`;
  jede Deploy-Datei muss daher ins ZIP **und** in `Paket erstellen.bat`.

## Architektur

Gewählter Ansatz: **Konfig-Datei in `data/`**, die der Server pro Anfrage liest.

```
[Doppelklick .bat]  ->  schreibt data/ki-modell.txt  ->  Server liest pro /api/structure
                                                          ->  Ollama-Aufruf mit gewähltem Modell
```

### Komponenten

1. **`data/ki-modell.txt`** (Laufzeit-Artefakt, nicht im Repo, nicht im ZIP)
   - Inhalt: genau ein Modellname, z. B. `qwen2.5:7b`.
   - Fehlt/leer/unbekannt → Server nutzt Default `qwen2.5:3b`.

2. **`praxis_memo_server.py`**
   - Konstante `DEFAULT_OLLAMA_MODEL = "qwen2.5:3b"` und Allowlist
     `ALLOWED_MODELS = {"qwen2.5:3b", "qwen2.5:7b"}`.
   - `MODEL_FILE = DATA_DIR / "ki-modell.txt"`.
   - Neue Funktion `active_model() -> str`: liest `MODEL_FILE`, strippt Whitespace,
     gibt den Wert zurück wenn in `ALLOWED_MODELS`, sonst `DEFAULT_OLLAMA_MODEL`.
     Liest defensiv (try/except → Default).
   - `structure_via_ollama()` nutzt `active_model()` statt der festen Konstante für das
     `"model"`-Feld des Ollama-Requests. Gelesen **pro Anfrage** → kein Neustart nötig.

3. **`/api/structure-status` (GET)**
   - Antwort zusätzlich um `"model": active_model()` ergänzt.
   - Frontend (`app.js`, `checkKiAvailability()`/`renderKiStatus()`) zeigt den aktiven
     Modellnamen klein im KI-Status an, z. B. „Strukturierung bereit (qwen2.5:7b)".

4. **`Besseres Modell installieren.bat`** (neu)
   - Prüft Gesamt-RAM via PowerShell (`Win32_ComputerSystem.TotalPhysicalMemory`).
   - `< 16 GB` → klare Abbruchmeldung, **lädt/aktiviert nichts**, `exit /b 1`.
   - `>= 16 GB` → `ollama pull qwen2.5:7b`.
   - **Nur bei erfolgreichem Pull** (`errorlevel == 0`) → schreibt `qwen2.5:7b` nach
     `data\ki-modell.txt`. Sonst Fehlermeldung, Datei unverändert.
   - Schlussmeldung: aktiv ab nächster Strukturierung (App-Neustart nicht nötig, aber
     unschädlich).

5. **`Schnelles Modell (3b) zurueck.bat`** (neu)
   - Schreibt `qwen2.5:3b` nach `data\ki-modell.txt`. Lädt nichts, kann nicht fehlschlagen.
   - Sofortige Rückfahrkarte, falls 7b auf dem NUC zu langsam ist.

6. **Packaging**
   - Beide neuen `.bat` in `Paket erstellen.bat` ergänzen.
   - Beide in das Release-ZIP `praxis-memo-app.zip` aufnehmen.
   - `data/ki-modell.txt` gehört **nicht** ins ZIP/Repo (pro-PC-Laufzeitdatei).

## Datenfluss

1. Miriam doppelklickt `Besseres Modell installieren.bat`.
2. RAM-Gate ok → Ollama lädt 7b → `data/ki-modell.txt = "qwen2.5:7b"`.
3. Nächste Strukturierung: Server `active_model()` → `qwen2.5:7b` → Ollama-Aufruf.
4. KI-Status zeigt `qwen2.5:7b`.
5. Bei Bedarf `Schnelles Modell (3b) zurueck.bat` → `data/ki-modell.txt = "qwen2.5:3b"`.

## Edge Cases

- Datei fehlt/leer/unbekannter Wert → `qwen2.5:3b` (sicherer Default).
- 7b gewählt, aber nicht installiert → Ollama-Aufruf schlägt fehl → bestehende
  503-Fehlerbehandlung in `/api/structure`. Die Install-Bat verhindert diesen Zustand,
  weil sie nur nach erfolgreichem Pull aktiviert.
- App-Update läuft → `data/ki-modell.txt` bleibt erhalten → Wahl bleibt aktiv.
- Allowlist verhindert Injektion beliebiger Modellnamen über die Datei.
- Datei mit fremdem/altem Modellnamen (z. B. nach manueller Bearbeitung) → Default 3b.

## Tests (isoliert, temporäre Daten, keine echten Patientendaten)

- `active_model()`: Datei fehlt → 3b; leer → 3b; `qwen2.5:7b` → 7b; `qwen2.5:3b` → 3b;
  ungültig (`gpt-4`, `foo`) → 3b; mit Whitespace/Zeilenumbruch → korrekt gestrippt.
- `/api/structure-status` gibt `model` passend zur Datei zurück (isolierter Temp-Datenordner).
- `python3 -m py_compile praxis_memo_server.py`, `node --check app.js`.
- Frontend: KI-Status zeigt den vom Status-Endpoint gemeldeten Modellnamen.
- Bat-Logik per Review: RAM-Gate `< 16 GB` blockt; Aktivierung nur nach erfolgreichem Pull;
  geschriebener Wert liegt in der Allowlist.

## Doku-Folgeänderungen

- `docs/HANDOVER.md`: neue Konfig-Datei `data/ki-modell.txt`, `active_model()`,
  Status-Feld `model`, die zwei Bat-Dateien.
- `docs/release-notes-v1.0.6.md`: Feature + Bedienhinweis (erst RAM-Check, dann
  Installieren, Rückweg über die 3b-Datei).
- README/Installations-/Update-Anleitung: kurzer Hinweis auf die optionale Modellumstellung.
