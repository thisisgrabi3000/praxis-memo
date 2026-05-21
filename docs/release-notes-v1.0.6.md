# Release Notes v1.0.6 — Umschaltbares KI-Modell

Stand: 2026-05-21

## Neu
- Optionaler Wechsel auf das größere Strukturierungsmodell `qwen2.5:7b` auf RAM-starken PCs.

## Bedienung
1. `PC KI Leistung pruefen.bat` doppelklicken → RAM prüfen (Bericht in `data/pc-ki-check.txt`).
2. Ab 16 GB RAM: `Besseres Modell installieren.bat` doppelklicken → lädt und aktiviert qwen2.5:7b.
   Unter 16 GB bricht das Skript ab und ändert nichts.
3. Zu langsam? `Schnelles Modell (3b) zurueck.bat` doppelklicken → zurück auf qwen2.5:3b.
4. Das aktive Modell steht im KI-Status oben in der App („KI bereit (lokal, qwen2.5:7b)").

## Technisch
- Server liest das aktive Modell pro Anfrage aus `data/ki-modell.txt` (überlebt App-Updates), Allowlist `{qwen2.5:3b, qwen2.5:7b}`, Fallback `qwen2.5:3b`.
- `/api/structure-status` meldet das aktive Modell im Feld `model`.
- `available` ist nur `true`, wenn das aktive Modell auch in Ollama installiert ist; eine veraltete/manuell gesetzte Modell-Datei zeigt die KI nicht fälschlich als bereit.
- KI-Ausgaben müssen weiterhin fachlich geprüft werden; qwen2.5:7b ist deutlich langsamer als qwen2.5:3b.

## Deploy-Dateien (Release-ZIP)
- Zusätzlich zu v1.0.5: `Besseres Modell installieren.bat`, `Schnelles Modell (3b) zurueck.bat`.
- `data/ki-modell.txt` gehört NICHT ins ZIP/Repo (pro-PC-Laufzeitdatei).
