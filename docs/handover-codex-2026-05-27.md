# Praxis Memo — Stand & Handover (für Weiterarbeit, z. B. mit Codex)

Stand: 2026-05-27. Eine Version, Branch `main` (lokal, **nicht gepusht**).

## 1. Was die App ist
Lokaler, **offline** laufender Dokumentations-/Vorbereitungsassistent für eine psychotherapeutische Praxis. Kein Cloud-Dienst (Datenschutz: § 203 StGB, Art. 9 DSGVO). Frontend: Vanilla JS, kein Build-Step. Backend: ein Python-HTTP-Server, der lokal Ollama (Sprachmodell) und faster-whisper (Diktat) anspricht.

## 2. Lokal starten / testen
```bash
# Server (aus dem Projekt-Root)
~/praxismemo-whisper-venv/bin/python praxis_memo_server.py --port 3000 --no-browser
# Browser: http://127.0.0.1:3000/   (KI: Ollama mit qwen2.5:3b muss laufen)

# Tests (kein package.json; reine node-/python-Skripte)
for f in tests/*.js; do node "$f"; done
for f in tests/*.py; do ~/praxismemo-whisper-venv/bin/python "$f"; done
```
Tests nutzen `tests/helpers/load-app.js` (lädt `app.js` in einen vm-Context; Top-Level-`function`s sind testbar). `befund.js` ist dual-mode (`module.exports` für Node + globale Konstanten im Browser).

## 3. Dateien / Architektur
- `index.html` — Markup; Tabs `record/review/prep/befund`; lädt `befund.js` **vor** `app.js`.
- `styles.css` — Styles inkl. `--surface-*`-Farbflächen (Navyblau-Familie) und Befund-Styles.
- `app.js` (~2300 Z.) — gesamte Frontend-Logik: Patienten (`normalizePatient`, `createSession`), Liste (`renderPatients`, `sortPatientsById`, `partitionPatientsByArchived`), Strukturierung (`structureTranscript`, `validateStructuredResult`), Sitzungs-Archiv (`buildSessionFromCurrent`, `archiveCurrentSession`, `startNewSession`), Befund-UI (`renderBefund` + Handler), KI-Vorbelegung (`requestBefundSuggest`).
- `befund.js` — Befund-Engine + 18-Sektionen-AMDP-Katalog (`BEFUND_CATALOG`) + reine Funktionen (`befundDefaultSelection`, `befundSetNormal`, `befundToggleItem`, `befundSetFreitext`, `befundApplySuggestions`, `befundSectionText`, `befundFliesstext`).
- `praxis_memo_server.py` — HTTP-Server. Wichtig: `STATIC_ALLOWLIST` (nur erlaubte Frontend-Dateien werden ausgeliefert), `Cache-Control: no-store` auf Statik, Endpunkte `/api/structure`, `/api/befund-suggest`, `/api/transcribe`, `/api/save`, `/api/load`, Status-Endpunkte.

## 4. Befund-Datenmodell (zentral)
```
Sektion: { id, label, group:"kognitiv|erscheinung|vegetativ|psychotisch|gefahr", icon, normal, clusters:[Cluster] }
Cluster: { id, label, items:[Item] }
Item:    { id, label, text, normal?:true }   // normal:true = unauffälliger Punkt (z. B. "wach")
Auswahl je Sektion: { normal:bool, itemIds:[...], freitext?:{clusterId:text}, nichtErhebbar?:bool }
```
- "Normalbefund"/"Alles unauffällig" hakt die `normal:true`-Items an.
- Cluster-Logik: Abweichung anhaken entfernt das Normal-Item des Clusters und umgekehrt.
- Fließtext: pro Sektion `section.normal`-Text, solange keine Abweichung/Freitext gewählt ist — sonst die Texte der gewählten Abweichungs-Items (+ Freitext). Normal-Items liefern keinen eigenen Fließtext.
- KI-Vorbelegung (`/api/befund-suggest`): Client schickt Transkript + kompakten Katalog; Server fragt lokal Ollama, gibt `{sectionId:[itemId,...]}` zurück (nur gültige IDs, serverseitig gegen den Katalog validiert); `befundApplySuggestions` setzt nur Abweichungen.

## 5. Fertig (auf `main`)
- **UI-Farbflächen** seitenweit (gesättigte `--surface-*`-Töne); alle vier Tabs haben klar abgesetzte, getönte Blöcke (Einsprechen blau/grün, Prüfen die 4 Feldfarben, Anknüpfen blau/grün/amber, Befund domänen-farbig).
- **Patientenliste**: nur Kürzel, alphabetisch; **Archivierung** (Flag `archived`, Abschnitt „Archiviert (N)").
- **Befund-Modul**: 18 AMDP-Sektionen, Cluster-Checkboxen + „eigener Text", Normal-Items, „Normalbefund"/„Alles unauffällig", Marker je Sektion (✓ grün unauffällig, ● rot Abweichung), Live-Fließtext + Kopieren, KI-Vorbelegung.
- Server-Fixes: Static-Allowlist inkl. `befund.js`, `no-store`-Header, Strukturierung akzeptiert `open/watch` auch als Array.

## 6. NOCH OFFEN (Reihenfolge wie besprochen)
1. **Befund pro Sitzung speichern + Fortschreibung** (Hauptlücke). Aktuell liegt die Auswahl auf `patient.befund` (persistiert), aber NICHT pro Sitzung archiviert und eine neue Sitzung übernimmt sie noch nicht explizit.
   - Umsetzungsstellen in `app.js`: `buildSessionFromCurrent` (Befund-Snapshot `session.befund = clone(patient.befund)` ergänzen), `normalizeSession` (`befund` erhalten), `startNewSession` (`patient.befund` aus letzter geprüfter Sitzung übernehmen = Fortschreibung), `normalizePatient` (Default; aber **nicht** `befundDefaultSelection(BEFUND_CATALOG)` darin aufrufen — `BEFUND_CATALOG` ist im vm-Test-Context nicht vorhanden → Tests brechen; lazy-Default bleibt in `renderBefund`). Optional: Befund-Fließtext in die Akte-Druckansicht (`exportPrepFields`/Export) und in `renderSessionDetails` (read-only).
2. **Klinische Freigabe des Befund-Katalogs durch Miriam** — `BEFUND_CATALOG` ist ein fachlicher ENTWURF (eigene AMDP-Formulierungen, NICHT Befundomats geschützte Texte/PPB3). Vor echter klinischer Nutzung prüfen/ergänzen.
3. **Optional/kosmetisch**: Textfeld-Innere von „Absprachen/Offene Punkte" an die Feldfarbe angleichen.

## 7. Deploy auf Miriams PC (Auto-Update per „Update"-Klick)
Mechanik: `Praxis Memo Update.bat` lädt `releases/latest/download/praxis-memo-app.zip` und entpackt es per `Expand-Archive -Force` in den App-Ordner. Der GitHub-Release-Asset MUSS exakt `praxis-memo-app.zip` heißen.

**Deploy-kritische Checkliste (sonst kaputt/403 auf dem NUC):**
- [x] `befund.js` ist in `Paket erstellen.bat` aufgenommen (erledigt 2026-05-27).
- [x] `STATIC_ALLOWLIST` enthält `befund.js` (in `praxis_memo_server.py`).
- [x] `Cache-Control: no-store` auf Statik (verhindert hängende alte JS nach Updates).
- [x] Strukturierungs-Fix (open/watch als Array) ist in `app.js`.
- [ ] Beim Release: ZIP als Asset `praxis-memo-app.zip` an `releases/latest` hängen (gh release).
- [ ] `VERSION` hochzählen.
Ablauf (laut Memory): Branch → ff `main` → push → `gh release` Asset `praxis-memo-app.zip` an „latest". **Push/Release nur auf ausdrückliches Wort des Users** (läuft live auf dem Praxis-PC).

## 8. Konventionen & Fallstricke
- **Static-Server-Allowlist**: jede NEUE Frontend-Datei muss in `STATIC_ALLOWLIST` UND in `Paket erstellen.bat`/ZIP, sonst 403 bzw. fehlt auf dem NUC.
- **Medizinische/rechtliche Inhalte**: keine Platzhalter/erfundenen Inhalte fabrizieren; geprüfte Stände append-only (Revisionen).
- **Edit/Write-Tool-Falle**: hat mehrfach ASCII-Anführungszeichen in JS zu Unicode-„Curly-Quotes" gemacht → nach Edits prüfen (`grep`/Python-Byte-Check) und Tests laufen lassen.
- HTTP-Handler: Endpunkt-Routing vor JSON-Parse verzweigen (Binär-Uploads).

## 9. User-WIP (uncommittet auf `main`)
Eigenes Feature des Users: „nicht belegte Versorgungs-/Therapieempfehlungen blocken" (Facharzt/Überweisung/Medikation/Klinik) in `app.js` (`UNSUPPORTED_CARE_PATTERNS`, in `validateStructuredResult`) + `praxis_memo_server.py` (`_validate_care_recommendations`, `_normalize_structure_result`) + Tests `tests/test_frontend_workflow_smoke.js`, `tests/test_structure_result_normalization.py`. Bewusst **uncommittet** gelassen (unfertige Arbeit des Users). Koexistiert konfliktfrei mit dem obigen Stand (alle Tests grün).
