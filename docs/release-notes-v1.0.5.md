# Release Notes v1.0.5 — Patientenkontext und NUC-Check

Stand: 2026-05-21

## Zweck

Dieses Release härtet den longitudinalen Praxisworkflow weiter: keine fremden Patientenkürzel in KI-Ergebnissen, kein Verlust fertiger Re-Strukturierungen bei Patientenwechsel, bessere Langzeitablage sensibler Themen und ein lokales NUC-Prüfskript für die Modellentscheidung `qwen2.5:3b` vs. `qwen2.5:7b`.

Fachlicher Zielkontext: psychologische Psychotherapeutin, Verhaltenstherapie, Erwachsene, Einzel- und Gruppenpsychotherapie. Typische Testfälle sollten ADHS, Angststörungen/soziale Angst, Depression, arbeitsplatzbezogene psychische Störungen (Mobbing/Burnout), Entspannungsverfahren und Schematherapie berücksichtigen.

## Enthaltene Änderungen

- `praxis_memo_server.py`: `/api/structure` akzeptiert `patientId`; Server-Prompt und Server-Validierung blockieren fremde `P-*`-IDs in KI-Antworten.
- `app.js`: Frontend-Validierung blockiert fremde Patientenkürzel vor Übernahme.
- `app.js`: `pendingStructure` speichert fertige Strukturierungsergebnisse, wenn während der Anfrage zu einem anderen Patienten gewechselt wurde und bestehende Felder überschrieben würden.
- `app.js`: Risiken, Schutzfaktoren und sensible Themen werden robuster aus Zusammenfassung und Rohtranskript ins Patientengedächtnis übernommen; Schutzfaktor-Snippets werden so getrennt, dass „Gewalt in der Familie“ nicht als Schutzfaktor mitgespeichert wird.
- `PC KI Leistung pruefen.bat`: prüft RAM, CPU, Ollama und vorhandene Modelle auf dem Windows-NUC; schreibt `data/pc-ki-check.txt`; lädt nichts herunter.
- `Paket erstellen.bat`: packt das neue NUC-Prüfskript mit ins ZIP.
- `README_DEMO.txt` und `docs/walkthrough-checklist.md`: alte OpenAI/Cloud-Demo-Hinweise entfernt.

## Verifikation

- `python -m py_compile praxis_memo_server.py`
- `node --check app.js`
- Frontend-Workflow-Simulation:
  - Feldnachträge bleiben nach Re-Strukturierung erhalten.
  - Re-Strukturierung bei Patientenwechsel wird als `pendingStructure` gespeichert und beim Zurückwechseln übernommen.
  - Audio-Patientenlock schreibt Transkription weiter zum ursprünglichen Patienten.
  - Sensible Themen, Risiko und Schutzfaktor werden ins Gedächtnis übernommen; Gewalt/Trauma bleibt aus der Schutzfaktorenliste heraus, Schwester wird als Schutzfaktor gespeichert.
- Echter Ollama-Test:
  - Input mit `Patient P-001 ... Kein Bezug zu P-007`.
  - Output enthielt nach Fix kein `P-007` mehr.

## Deployment-Hinweise für Claude

Commit muss enthalten:

- `app.js`
- `praxis_memo_server.py`
- `README.md`
- `README_DEMO.txt`
- `Paket erstellen.bat`
- `PC KI Leistung pruefen.bat`
- `docs/HANDOVER.md`
- `docs/walkthrough-checklist.md`
- `docs/installation-guide.html`
- `docs/update-anleitung.html`
- `docs/release-notes-v1.0.5.md`

Release-ZIP für `Praxis Memo Update.bat` muss enthalten:

- `index.html`
- `styles.css`
- `app.js`
- `praxis_memo_server.py`
- `Start Praxis Memo.bat`
- `KI einrichten.bat`
- `Datenordner oeffnen.bat`
- `PC KI Leistung pruefen.bat`
- `README_PC_INSTALLATION.txt`
- optional `VERSION`

Nach Deployment auf dem NUC:

1. `Praxis Memo Update.bat` ausführen oder neues ZIP einspielen.
2. `PC KI Leistung pruefen.bat` per Doppelklick starten.
3. `data/pc-ki-check.txt` prüfen.
4. `qwen2.5:7b` nur testen, wenn das Skript mindestens 16 GB RAM meldet.
5. USB-Mikrofon am NUC mit echter Browseraufnahme testen.
