# Praxis Memo — Übergabedokument

Letzte Aktualisierung: 2026-05-21  
Kontext: Lokale Web-App für eine Psychotherapeutin (Miriam), entwickelt auf macOS, Zielplattform Windows-PC im Praxisbetrieb.

---

## 0. Änderungsprotokoll

### 2026-05-21 — Oberfläche vereinfacht + Miriam-Ablaufplan

- Frontend: rechte Kontextspalte aus der Hauptansicht entfernt; Vorbereitung ist jetzt über den Schnellblick und den Tab `Anknüpfen` erreichbar statt doppelt in einer dritten Spalte.
- Leerer Startzustand: Ohne Patient werden Workflow, Aufnahme und Eingabefelder ausgeblendet; sichtbar bleibt nur ein ruhiger Startbereich mit `Patient anlegen`.
- Schritt `01 Einsprechen`: sichtbar bleiben nur Nachnotiz und nächster Termin. `Letzter Fokus`, `Letzte Vereinbarung` und `Offen` liegen unter `Zusätzliche Notizen` und sind standardmäßig zugeklappt.
- Schnellblick: wird nur noch angezeigt, wenn für den ausgewählten Patienten echte Vorbereitung/Verlauf vorhanden ist. Neue leere Patienten starten dadurch ruhiger.
- Datenbereinigung: alter Beispielpatient `P-001` mit Panik-/Supermarkt-Beispieltext aus `data/praxismemo-data.json` entfernt. `app.js` filtert genau diesen alten Beispieltext zusätzlich aus altem Browser-Cache, damit er nicht wieder hochgespeichert wird.
- Neue Doku: `docs/ablaufplan-miriam.md` beschreibt den realen Ablauf über mehrere Sitzungen und erklärt, was beim Vorbereiten wo angezeigt wird. `docs/anleitung-miriam.html` wurde auf diesen Ablauf umgeschrieben.
- Test: `tests/test_patient_export.js` prüft zusätzlich, dass nur der alte Beispielpatient entfernt wird und normale `P-001`-Einträge nicht pauschal gelöscht werden.

### 2026-05-21 — Patientenakte-Export

- Frontend: neuer Button `Akte drucken` in der Patiententopbar.
- Export: `buildPatientExportHtml()` erzeugt eine lokale, druckoptimierte HTML-Akte für den ausgewählten Patienten.
- Inhalt: aktuelle Übersicht, strukturierte Felder, Vorbereitung, Patientenregister, archivierte Sitzungen und frühere Versionen (`session.revisions`).
- Bedienung: Druckansicht öffnet in einem neuen Browserfenster; im Druckdialog kann als PDF gespeichert werden. Falls das Fenster blockiert wird, lädt die App eine HTML-Datei herunter.
- Test: `tests/test_patient_export.js` prüft die Exportausgabe inkl. Archiv, Register und Revisionen.

### 2026-05-21 — Umschaltbares KI-Modell (Release v1.0.6)

- `data/ki-modell.txt` (pro PC, überlebt App-Updates, da `data/` nicht überschrieben wird) bestimmt das Strukturierungsmodell.
- Server: `active_model()` liest die Datei pro `/api/structure`-Anfrage, Allowlist `{qwen2.5:3b, qwen2.5:7b}`, Fallback `qwen2.5:3b`. `/api/structure-status` meldet zusätzlich `model`.
- Härtetest-Fix: `/api/structure-status` meldet `available: true` nur, wenn das aktive Modell auch in `ollama /api/tags` installiert ist. Ein manuell/stale gesetztes `qwen2.5:7b` ohne installiertes Modell zeigt die KI dadurch nicht mehr fälschlich als bereit.
- Frontend: KI-Status zeigt das aktive Modell an („KI bereit (lokal, qwen2.5:7b)").
- `Besseres Modell installieren.bat` (Hard-Block <16 GB RAM, `ollama pull qwen2.5:7b`, aktiviert nur nach erfolgreichem Pull) und `Schnelles Modell (3b) zurueck.bat` (Rückfahrkarte).
- `Paket erstellen.bat` und Release-ZIP enthalten beide neuen Bats.

### 2026-05-21 — Deploy-Handover + NUC-Leistungscheck (Release v1.0.5-Kandidat)

Diese Änderungen wurden nach dem zweiten Härtetest eingebaut und sind für Claude/Deployment relevant:

1. **Fremde Patienten-IDs doppelt abgesichert** — `/api/structure` bekommt jetzt `patientId`; Server-Prompt und Server-Validierung blockieren fremde `P-*`-IDs in der KI-Antwort. Frontend-Validierung blockiert ebenfalls jede fremde ID vor Übernahme. Der reale Ollama-Test „P-001, kein Bezug zu P-007“ gab danach kein `P-007` mehr aus.
2. **Re-Strukturierung bei Patientenwechsel abgesichert** — wenn eine KI-Strukturierung fertig wird, während die Behandlerin zu einem anderen Patienten gewechselt hat und vorhandene Felder überschrieben würden, wird das Ergebnis als `patient.pendingStructure` gespeichert. Beim Zurückwechseln wird aktiv gefragt, ob die fertige Strukturierung übernommen oder verworfen werden soll. Ergebnis geht nicht mehr still verloren.
3. **Langzeitgedächtnis für sensible Inhalte geschärft** — Risiken, Schutzfaktoren und sensible Themen werden zusätzlich aus dem Rohtranskript extrahiert, nicht nur aus der KI-Zusammenfassung. `Familie` wurde als zu breiter Schutzfaktor entfernt; Memory-Snippets werden außerdem an Semikolon/Pipe/Newline getrennt, damit „Gewalt in der Familie“ nicht als Teil eines Schutzfaktors gespeichert wird.
4. **NUC-Leistungscheck ergänzt** — neue Datei `PC KI Leistung pruefen.bat` prüft auf dem Windows-NUC RAM, CPU, Ollama, `qwen2.5:3b` und `qwen2.5:7b`. Sie schreibt `data/pc-ki-check.txt`, lädt nichts herunter und ändert keine Patientendaten.
5. **Deploy-Paket aktualisiert** — `Paket erstellen.bat` packt `PC KI Leistung pruefen.bat` jetzt mit ins ZIP. Release-ZIP muss diese Datei enthalten.
6. **Doku-Reste korrigiert** — `README_DEMO.txt` und `docs/walkthrough-checklist.md` sprechen nicht mehr von OpenAI/Cloud-Demo.

**Verifikation am 2026-05-21:**
- `/private/tmp/praxismemo-whisper-venv/bin/python -m py_compile praxis_memo_server.py`
- `node --check app.js`
- Frontend-Workflow-Simulation: Feldnachträge, Pending-Strukturierung nach Patientenwechsel, Audio-Patientenlock, sensible Memory-Klassifikation inklusive Trauma/Gewalt, passiver Todesgedanken und Schutzfaktor Schwester.
- Echter Ollama-Test mit `P-001`/negiertem `P-007`: keine fremde ID in der Ausgabe.

**Für Claude beim Deploy:**
- Commit/Release muss mindestens enthalten: `index.html`, `styles.css`, `app.js`, `praxis_memo_server.py`, `README.md`, `README_DEMO.txt`, `Paket erstellen.bat`, `PC KI Leistung pruefen.bat`, `Besseres Modell installieren.bat`, `Schnelles Modell (3b) zurueck.bat`, `docs/HANDOVER.md`, `docs/ablaufplan-miriam.md`, `docs/anleitung-miriam.html`, `docs/anleitung-miriam.pdf`, `docs/walkthrough-checklist.md`, `docs/installation-guide.html`, `docs/installation-guide.pdf`, `docs/update-anleitung.html`, `docs/release-notes-v1.0.7.md`, `tests/test_patient_export.js`.
- Release-ZIP für `Praxis Memo Update.bat` muss enthalten: `index.html`, `styles.css`, `app.js`, `praxis_memo_server.py`, `Start Praxis Memo.bat`, `KI einrichten.bat`, `Datenordner oeffnen.bat`, `PC KI Leistung pruefen.bat`, `README_PC_INSTALLATION.txt`, optional `VERSION`.
- Nach Deployment auf dem NUC zuerst `PC KI Leistung pruefen.bat` ausführen und `data/pc-ki-check.txt` prüfen, bevor `qwen2.5:7b` als Standard erwogen wird.

### 2026-05-20 — Gedächtnisregister + ID-Härtung (Release v1.0.4)

Neue Härtung für psychiatrische/psychotherapeutische Längsschnittnutzung:

1. **Kollisionsfreie IDs** — neue Patienten-, Sitzungs- und Register-IDs laufen über `makeId()` mit `crypto.randomUUID()` und Fallback. Schnelle Folgesitzungen können dadurch nicht mehr per `Date.now()` kollidieren.
2. **Patienten-Gedächtnisregister** — `patient.memory` führt Risiken/Warnhinweise, Schutzfaktoren, offene Fragen, Vereinbarungen und sensible Themen mit Quellen-Sitzung und Datum.
3. **Vorbereitungsansicht erweitert** — `renderContextPanel()` zeigt neben letzter Sitzung auch die Registereinträge prominent an.
4. **KI-Kontext erweitert** — `buildStructureInput()` gibt dauerhafte Patientennotizen und Top-Level-Felder an Ollama weiter, damit offene Risiken/Vereinbarungen nicht bei späteren Strukturierungen verschwinden.
5. **KI-Validierung** — fehlende Pflichtfelder, nicht belegte Patientenkürzel und nicht im Transkript belegte klinische Diagnosebegriffe werden vor Übernahme blockiert.
6. **Prompt-Kontext angepasst** — Server-Prompt spricht jetzt ausdrücklich von psychiatrischer oder psychotherapeutischer Praxis und verbietet Diagnose-/Therapieentscheidungen.

### 2026-05-20 — Workflow-Härtetest-Fixes (Release v1.0.3)

Behebung von 8 im Härtetest gefundenen Befunden:

1. **`/api/transcribe` repariert** — `do_POST` parste jeden POST-Body zuerst als JSON; Audio-Bytes scheiterten mit „400 Invalid JSON“, Whisper wurde nie erreicht. Der Transcribe-Zweig läuft jetzt **vor** dem JSON-Parsing.
2. **Patienten-Lock ab Aufnahmestart** — die Patienten-UID wird jetzt in `startMediaRecordingForField()` festgehalten (vorher erst beim Stop). Ein Patientenwechsel während laufender Aufnahme ordnet das Audio nicht mehr dem falschen Patienten zu.
3. **Re-Strukturierung ohne Datenverlust** — bereits in Felder eingetragene Notizen gehen jetzt als Kontext mit an die KI (`buildStructureInput`), und vor dem Überschreiben nicht-leerer Felder erscheint eine Bestätigung.
4. **Static-Allowlist** — der Server liefert nur noch `index.html`, `app.js`, `styles.css` aus (`STATIC_ALLOWLIST`). `data/*.json`, `server.log`, `.git/` etc. sind nicht mehr per Browser abrufbar.
5. **KI-Prompt** verbietet das Erfinden/Ändern von Patienten-Kürzeln; fehlerhafte „P-007“-Demo-Daten korrigiert.
6. **Append-only Sitzungsverlauf** — beim erneuten Archivieren einer bereits geprüften Sitzung bleibt die Vorversion als unveränderbare Revision erhalten (`session.revisions`, `revisedAt`). `createSession()` fabriziert keine Platzhalter/künstlichen Transkripte mehr.
7. **Backup-Pruning** löscht jetzt auch Backup-Dateien in Ordnern älter als 90 Tage (vorher nur leere Ordner).
8. **Doku** an aktuellen Code angeglichen (siehe unten — Auto-Switch/busyOperation gestrichen, SpeechRecognition/OpenAI korrigiert).

### 2026-05-20 — Security-Härtung + Doku-Bereinigung (Release v1.0.2)

> **Status-Wechsel:** Die App wird jetzt mit **echten Patientendaten** betrieben (nicht mehr nur Demo). Damit greifen DSGVO Art. 9/32 und §630f BGB ab sofort.

**Code:**
- `praxis_memo_server.py`: neuer Trust-Guard `_is_trusted()` auf allen GET/POST-Endpoints — der `Host`-Header muss Loopback sein (Schutz gegen **DNS-Rebinding**, das sonst `/api/load` = alle Patientendaten auslesbar gemacht hätte) und Cross-Origin-/Cross-Site-POSTs werden mit 403 abgewiesen (**CSRF**-Schutz). Per Unit- und Integrationstest verifiziert.
- **OpenAI-/Demo-Pfad komplett entfernt** (Server, `app.js`, `index.html`, `styles.css` inkl. Demo-Banner). App ist cloud-frei — Strukturierung nur noch über Ollama lokal. `import ssl`/TLS-Kontext entfielen mit.
- Release **v1.0.2** auf GitHub veröffentlicht. Einspielen vor Ort via „Praxis Memo Update.bat".

**Neue/aktualisierte Docs (in `docs/`):**
- `bitlocker-datenschutz.pdf` (+ `.html`): Seite 1–2 = einfache Info + Entscheidungsbox für Miriam (DSGVO, will sie Verschlüsselung?), Seite 3–4 = technische BitLocker-Checkliste für CMG.
- `bitlocker-check.bat`: Doppelklick-Statusskript (zeigt Windows-Edition + BitLocker-Status, ändert nichts).
- `bitlocker-checkliste.md`: Markdown-Variante der Checkliste.
- `installation-guide` + `update-anleitung` (HTML + PDF): **AnyDesk-Passagen entfernt** (kein Fernzugriff installiert; Wartung vor Ort) und Sicherheits-Status auf „Übergangsbetrieb mit echten Daten" korrigiert.

**Entscheidungen:**
- **Kein AnyDesk** auf Miriams PC → CMG macht Updates/Wartung **vor Ort**.
- GitHub-Repo bleibt **public** (keine Daten/Secrets im Repo, Sicherheit hängt nicht an Geheimhaltung; spart Token im Update-Flow). **2FA** auf dem Account aktiviert.

**Noch offen (nach Priorität):**
1. **BitLocker** auf Miriams NUC aktivieren (vor Ort) — Recovery-Key extern sichern.
2. **Off-Site-Backup** (externe, verschlüsselte Platte) — sonst Totalverlust-Risiko + §630f-Aufbewahrungsverstoß.
3. **DSB-/KV-Klärung** (MDR Art. 5(5), DSGVO).
4. **prod-spec Phase 1**: Verschlüsselung at-rest *in* der App. (§630f append-only ist für den Sitzungsverlauf umgesetzt — geprüfte Versionen bleiben als `revisions` erhalten; ein durchgängiges Änderungslog über alle Feldänderungen steht noch aus.)

---

## 1. Projektübersicht

**Was ist das?**  
Eine lokale Browser-App zur Sitzungsdokumentation. Miriam ist Dipl.-Psych., psychologische Psychotherapeutin mit Kassenzulassung, Verhaltenstherapie, Zielgruppe Erwachsene, Einzel- und Gruppenpsychotherapie. Behandlungsschwerpunkte: ADHS, Angststörungen, arbeitsplatzbezogene psychische Störungen (Mobbing/Burnout), Depression und soziale Angst; ergänzende Verfahren u.a. Entspannungsverfahren und Schematherapie. Sie spricht nach jeder Sitzung eine Nachnotiz ein. Die KI strukturiert den Text in vier Felder (Kernpunkte, Absprachen, Offene Punkte, Beobachtungsfokus). Die App zeigt vor dem nächsten Termin automatisch die Vorbereitung für den jeweiligen Patienten.

**Fachlicher Zuschnitt für Tests/Prompts:**  
Nicht primär psychiatrische Medikation testen, sondern psychotherapeutische Verläufe in Verhaltenstherapie: Exposition/Angstbewältigung, Aktivitätsaufbau, ADHS-Organisation, Arbeitsplatzbelastung, Mobbing/Burnout, soziale Angst, depressive Symptomatik, Entspannung/Skills, Schematherapie-Themen, Einzel- und Gruppenkontext. Risiko-/Krisenhinweise bleiben wichtig, die App darf aber keine Diagnosen oder Therapieentscheidungen treffen.

**Technischer Stack:**
- `index.html` + `styles.css` + `app.js` — reines Vanilla-JS, kein Framework, kein Build-Step
- `praxis_memo_server.py` — Python-Standardbibliothek HTTP-Server (`ThreadingHTTPServer`), läuft lokal auf `127.0.0.1:3000`
- Start über `Start Praxis Memo.bat` (Windows), öffnet Browser automatisch
- KI lokal via [Ollama](https://ollama.com) (`qwen2.5:3b`) + [faster-whisper](https://github.com/SYSTRAN/faster-whisper) (`base`)
- Einrichtung via `KI einrichten.bat` (Ein-Klick)

**Datenpfade:**
```
data/praxismemo-data.json   ← aktive Arbeitsdatei
data/backup-state.json      ← Zeitstempel letztes Auto-Backup
backups/YYYY-MM-DD/*.json   ← tägliche Backups (auto + manuell)
```

**Datenschutz:**  
Alle Daten bleiben auf dem PC. Kein Text, kein Audio verlässt das Gerät. Miriam darf aus datenschutzrechtlichen Gründen keine Termine in einem externen Kalender führen (Psyprax-Only-Policy).

---

## 2. Datenmodell

### Patient
```js
{
  uid: string,           // intern, z.B. "p-1234567890"
  id: string,            // Anzeigename, z.B. "P-014"
  status: "Offen" | "Entwurf" | "Geprüft",
  nextDate: string,      // ISO "YYYY-MM-DD" — nächster Termin
  nextTime: string,      // "HH:MM" — Uhrzeit nächster Termin
  focus: string,         // letzter Therapiefokus
  agreement: string,     // letzte Vereinbarung
  open: string,          // offene Punkte
  transcript: string,    // aktuelles Diktat (aktuelle Sitzung)
  summary: {
    core: string,        // Kernpunkte
    agreement: string,   // Absprachen
    open: string,        // Offene Punkte
    watch: string        // Beobachtungsfokus
  },
  prep: {
    anchor: string,      // Woran anknüpfen
    opening: string,     // Einstiegsfrage
    caution: string      // Vorsicht/fachlich prüfen
  },
  memory: {
    risks: MemoryItem[],
    protectiveFactors: MemoryItem[],
    openQuestions: MemoryItem[],
    agreements: MemoryItem[],
    sensitiveTopics: MemoryItem[]
  },
  currentSessionId: string,
  sessions: Session[]    // archivierte Sitzungen
}
```

**Migration:** `normalizePatient()` in `app.js` mappt alte Felder (`followUpDate`/`followUpTime`) auf das neue Schema (`nextDate`/`nextTime`). Vorhandene localStorage-Daten aus `STORAGE_KEY = "praxismemo-demo-v7"` (alter Demo-Stand) werden NICHT migriert — neuer Key `"praxismemo-v8"` startet fresh. Das ist beabsichtigt.

### Session (archivierte Sitzung)
```js
{
  id: string,
  date: string,          // ISO "YYYY-MM-DD"
  time: string,          // "HH:MM"
  status: "Geprüft" | "Entwurf",
  focus: string,
  transcript: string,
  summary: { core, agreement, open, watch },
  prep: { anchor, opening, caution },
  revisedAt?: string,    // ISO-Zeitstempel der letzten Überarbeitung (nur wenn überarbeitet)
  revisions?: Session[]  // Append-only: frühere geprüfte Versionen, neueste zuerst
}
```

**Append-only:** Wird eine bereits geprüfte Sitzung erneut archiviert (Bearbeitung + „Geprüft speichern“), ersetzt `archiveCurrentSession()` die alte Version nicht, sondern legt sie als Snapshot in `revisions` ab. Frühere Stände bleiben so nachweisbar (§630f). Die UI zeigt die Zahl früherer Versionen im Verlauf an.

### MemoryItem (patientenbezogenes Register)
```js
{
  id: string,
  text: string,
  status: "offen" | "erledigt" | string,
  sourceSessionId: string,
  sourceDate: string,
  createdAt: string,
  lastSeenAt: string
}
```

**Zweck:** Diese Register sind die eigentliche Längsschnitt-Gedächtnisschicht. Sie entstehen beim Archivieren geprüfter Sitzungen aus `summary.agreement`, `summary.open` und `summary.watch`, bleiben pro Patient erhalten und werden in der Vorbereitungsansicht sowie im nächsten KI-Prompt wiederverwendet. Das ersetzt keine fachliche Prüfung, verhindert aber, dass Risiken, Schutzfaktoren, offene Fragen oder sensible Themen nur in alten Transkripten verborgen bleiben.

### Backup-Format (JSON)
```json
{
  "schema": "praxismemo-backup",
  "version": 2,
  "savedAt": "2026-05-10T14:30:00.000Z",
  "patients": [ ... ]
}
```

---

## 3. Architektur & Datenfluss

```
Browser (index.html + app.js)
  │   Spricht NUR mit dem eigenen Server (127.0.0.1:3000) — niemals mit
  │   externen Diensten. Kein CORS, kein Cloud-Call, keine Web Speech API.
  │
  ├── localStorage["praxismemo-v8"]     ← primärer State
  │
  ├── /api/load              (GET)   ← Server-Daten laden
  ├── /api/save              (POST)  ← nach Änderung (650ms debounced)
  ├── /api/backup            (POST)  ← manuelles Backup
  ├── /api/transcribe        (POST)  ← Audio-Blob → Whisper → Text
  ├── /api/transcribe-status (GET)   ← faster-whisper verfügbar?
  ├── /api/structure         (POST)  ← Transkript → strukturiertes JSON
  └── /api/structure-status  (GET)   ← Ollama erreichbar?

Python-Server (praxis_memo_server.py)
  ├── Statische Dateien servieren (index.html, app.js, styles.css)
  ├── Daten atomar schreiben (os.replace via .tmp)
  ├── Auto-Backup alle 30 Min (on-save-trigger)
  ├── Backup-Pruning: max. 30/Tag, 90 Tage Aufbewahrung
  ├── Whisper-Transkription (faster-whisper "base", lazy-loaded, gecacht)
  ├── Ollama-Proxy (qwen2.5:3b → /api/chat)
  ├── Audio-Temp in data/tmp/ (beim Start gesäubert, max 50 MB pro Aufnahme)
  └── Fehler-Log in data/server.log

Ollama (separater lokaler Dienst auf 127.0.0.1:11434)
  └── nur vom Python-Server angesprochen, NICHT vom Browser
```

### Speicher-Hierarchie beim Start
1. `renderAll()` mit localStorage-Daten (sofort sichtbar)
2. `hydrateFromServer()` lädt Server-Daten → überschreibt localStorage wenn Server-Daten vorhanden
3. `checkKiAvailability()` + `checkWhisperAvailability()` — Status-Checks

> Hinweis: Es gibt **keinen** automatischen Patientenwechsel. Die Therapeutin wählt Patienten manuell in der Liste. (Ein früher dokumentierter „Auto-Switch“ ist im aktuellen Code nicht implementiert.)

---

## 4. KI-Funktionen

### 4.1 Diktat (Sprache → Text)

**Nur ein Pfad: faster-whisper lokal.** Aus Datenschutzgründen wurde der Web-Speech-API-Fallback komplett entfernt — der hätte Audio an Google/Microsoft gesendet.

**Ablauf:** Browser nimmt mit `MediaRecorder` auf → Audio-Blob (WebM/OGG Opus) per POST an `/api/transcribe` → Python schreibt in `data/tmp/audio-*.webm` → faster-whisper transkribiert → Datei wird gelöscht → Text zurück.

**Wenn faster-whisper nicht installiert ist:** Klare Meldung, kein Fallback.

**Schutz:**
- Audio > 50 MB → 413 vom Server
- Audio < 4 KB (zu kurz) → Toast, kein POST
- Temp-Datei wird beim Server-Start ge-`unlink`-t und nach jeder Transkription
- Bei Patientenwechsel während laufender Aufnahme/Transkription: Die Patienten-UID wird beim **Aufnahmestart** in `startMediaRecordingForField()` festgehalten und an `sendAudioForTranscription()` durchgereicht. Der Text landet dadurch immer beim ursprünglichen Patienten (`lockedPatientUid`)

**Whisper-Modell:** `base` (~150 MB). `small` war zu langsam auf Praxis-Hardware. `base` reicht für Deutsch in ruhiger Umgebung.

**Wo im Code:**
- Browser: `checkWhisperAvailability()`, `startMediaRecordingForField()`, `sendAudioForTranscription()`, `stopDictation()`
- Server: `transcribe_audio()`, `_load_whisper_model()`

### 4.2 Strukturierung (Text → Felder)

**Modell:** Ollama `qwen2.5:3b`, lokal auf 127.0.0.1:11434.

**Wichtig:** Browser ruft NICHT direkt Ollama auf (CORS-Probleme + Datenflusskontrolle). Stattdessen Server-Proxy:

```
Browser → POST /api/structure { transcript } → Python → POST 11434/api/chat → JSON zurück
```

`transcript` enthält das eigentliche Diktat **plus** bereits in Felder eingetragene Notizen und dauerhafte Registereinträge (`buildStructureInput()`), damit Nachträge, Risiken, sensible Themen und offene Fragen nach der ersten Strukturierung nicht verloren gehen. Der Prompt verbietet zusätzlich das Erfinden/Ändern von Patienten-Kürzeln, Diagnosen und Therapieentscheidungen.

**Ollama-Aufruf-Parameter:**
- `model: "qwen2.5:3b"` (war qwen2.5:7b — zu langsam auf NUC, ~120s pro Memo)
- `format: "json"` — erzwingt strict JSON von Ollama
- `temperature: 0.1` — deterministisch
- `stream: false`
- System-Prompt: Rolle als medizinisches Dokumentationssystem

**JSON-Extraktion:** `content.find("{") ... content.rfind("}")` als Sicherheitsnetz. Danach prüft das Frontend Pflichtfelder, neu erfundene Patientenkürzel und nicht im Quelltext belegte klinische Diagnosebegriffe, bevor Felder überschrieben werden.

**Schutz bei Patientenwechsel:**  
Die Strukturierung merkt sich den `lockedUid` (zum Start des Requests) und schreibt das Ergebnis in den ursprünglichen Patienten, auch wenn die Auswahl während des Requests wechselt. Tab-Wechsel auf „Prüfen“ passiert nur, wenn der Patient noch ausgewählt ist. Ist er nicht mehr ausgewählt, werden bereits gefüllte Felder **nicht** stillschweigend überschrieben (nur leere Felder werden ergänzt); beim aktiven Patienten fragt vor dem Überschreiben nicht-leerer Felder ein Bestätigungsdialog.

> Es gibt kein `busyOperation`-Flag und keinen `checkAutoSwitch` mehr — diese waren in einer früheren Doku-Version beschrieben, sind im Code aber nicht (mehr) vorhanden.

**Wo im Code:**
- Browser: `structureTranscript()`, `checkKiAvailability()`
- Server: `structure_via_ollama()`, `ollama_available()`

---

## 5. Workflow der Psychotherapeutin

```
Einmalig pro Patient
  → "Patient anlegen"
  → Kürzel prüfen
  → nächsten Termin eintragen

Vor einem Termin
  → Miriam wählt den Patienten links
  → Schnellblick lesen: Termin, Anknüpfen, Offen, Vorsicht
  → falls nötig "Anknüpfen öffnen" und Verlauf aufklappen

Nach einer Sitzung
  → Patient links auswählen
  → bei Folgesitzung ggf. "Neue Sitzung"
  → Tab "Einsprechen": Nachnotiz diktieren oder eintippen
  → "Strukturieren" → KI verteilt auf 4 Felder
  → Tab "Prüfen": Felder kontrollieren, ggf. anpassen
  → "Geprüft speichern" → Sitzung wird archiviert, Tab "Anknüpfen" öffnet sich
  → nächsten Termin eintragen
```

**Was bei Vorbereitung angezeigt wird:**  
Der Schnellblick erscheint nur, wenn bereits Verlauf/Vorbereitung existiert. Er zeigt den eingetragenen Folgetermin, den wichtigsten Anknüpfpunkt, offene Punkte und den wichtigsten Vorsichtshinweis aus Memory/Register/Vorbereitung. Im Tab `Anknüpfen` stehen dieselben Vorbereitungstexte editierbar plus der archivierte Sitzungsverlauf. Ältere Sitzungen sind aufgeklappt lesbar, aber nicht als Dauer-Panel rechts sichtbar.

**Mehrere Sitzungen pro Patient:**  
Jede geprüfte Sitzung wird in `patient.sessions[]` archiviert. `Neue Sitzung` leert das aktuelle Transkript und erzeugt eine neue `currentSessionId`, übernimmt aber sinnvolle Anknüpfpunkte aus der letzten geprüften Sitzung. `Geprüft speichern` schreibt die neue Sitzung in den Verlauf und aktualisiert `patient.prep` sowie das Memory-Register.

**Patientenwechsel ist manuell.** Es gibt keinen zeit-/terminbasierten automatischen Wechsel. Die Patientenliste ist nach `nextDate`/`nextTime` sortiert, sodass anstehende Termine oben stehen; die Auswahl trifft die Therapeutin selbst per Klick.

> Eine frühere Doku-Version beschrieb hier einen automatischen Wechsel (`checkAutoSwitch`, `autoSwitchBlocked`, Zeitfenster). Diese Mechanismen existieren im aktuellen `app.js` nicht.

---

## 6. Kalender-Situation

**Wichtig:** Miriam darf Termine aus datenschutzrechtlichen Gründen NUR in Psyprax führen. Kein Sync mit Google, Outlook oder Apple Kalender möglich.

**Aktuelle Lösung:** Termine werden direkt in der App gepflegt — pro Patient `nextDate` + `nextTime`. Das ist ein einmaliger Aufwand beim ersten Anlegen eines Patienten. Danach trägt sie nach jeder Sitzung den nächsten Termin ein (5 Sekunden).

**Kein `.ics`-Import** implementiert. Das Feld ist offen, falls Psyprax jemals einen lokalen Export ermöglicht.

---

## 7. Backup

| Mechanismus | Wann | Wo |
|---|---|---|
| Auto (Server) | Alle 30 Min, on-save-trigger | `backups/YYYY-MM-DD/praxismemo-auto-*.json` |
| Manuell (Server) | Button-Klick | `backups/YYYY-MM-DD/praxismemo-manuell-*.json` |
| Browser-Download | Bei jedem Backup-Klick zusätzlich | Downloads-Ordner, `praxismemo-backup-*.json` |
| Restore | Button → Datei wählen | Überschreibt aktive Daten nach Bestätigung |

**Pruning:** max. 30 Backups/Tag; Backups älter als 90 Tage werden gelöscht (erst die JSON-Dateien, dann der nun leere Tages-Ordner).  
**Atomares Schreiben:** `write_json_atomic()` — schreibt in `.tmp`, dann `os.replace()`.

---

## 8. Offene Punkte / nächste Schritte

### Kürzlich erledigt
- **Oberfläche vereinfacht:** Rechte Kontextspalte entfernt, leerer Startzustand reduziert, Schnellblick nur bei echtem Verlauf, Zusatzfelder in `Einsprechen` zugeklappt. Alter `P-001`-Beispieltext wurde aus `data/praxismemo-data.json` entfernt und per Cache-Migration abgesichert.
- **Miriam-Ablaufplan:** `docs/ablaufplan-miriam.md` und `docs/anleitung-miriam.html/.pdf` beschreiben den realen Ablauf über mehrere Sitzungen pro Patient und was bei der Vorbereitung wo angezeigt wird.
- **Patientenakte-Export:** Button `Akte drucken` öffnet für den ausgewählten Patienten eine lokale HTML-Druckansicht. Enthalten sind aktueller Stand, strukturierte Felder, Vorbereitung, Patientenregister, archivierte Sitzungen und frühere Versionen. PDF entsteht über den Browser-Druckdialog (`Als PDF speichern`). Fallback bei blockiertem Popup: HTML-Download.

### Bestätigt offen
- **Miriams RAM-Angabe fehlt noch** (Intel NUC 2022, vermutlich 16 GB). Aktuell qwen2.5:3b + whisper base — läuft auch auf 8 GB. Vor einer Modellumstellung auf `qwen2.5:7b` auf dem NUC `PC KI Leistung pruefen.bat` ausführen und `data/pc-ki-check.txt` prüfen. Faustregel im Skript: ab 16 GB `7b` testbar, 12-15 GB eingeschränkt, unter 12 GB nicht empfohlen.
- **Kein Import aus Psyprax.** Psyprax hat keinen bekannten direkten Datenexport für Termine. Wenn sich das ändert, wäre ein `.ics`-Reader der naheliegende Ansatz (Datei in `data/calendar.ics` legen, App liest alle 5 Min).

### Empfohlen
- **Verschlüsselung der Daten** sobald echte Patientendaten genutzt werden. `praxismemo-data.json` liegt aktuell im Klartext. Ansatz: AES-256 via Python `cryptography`-Paket, Passwort beim Server-Start abfragen.
- **Passwortschutz für den Server.** Aktuell ist `http://127.0.0.1:3000` ohne Auth erreichbar. Für eine Einzelnutzerin im Praxisbetrieb akzeptabel, aber ein einfaches Server-seitiges Token wäre besser.
- **Psyprax-RAM-abhängige Modellwahl** in `KI einrichten.bat` automatisieren: `wmic MemoryChip get Capacity` auslesen, bei < 12 GB auf kleinere Modelle wechseln.

---

## 9. Datei-Übersicht

| Datei | Zweck | Letzte Änderung |
|---|---|---|
| `index.html` | App-Struktur, vereinfachte Hauptansicht, `Akte drucken`-Button | 2026-05-21 |
| `app.js` | Gesamte App-Logik inkl. Diktat, KI, Verlauf, Export, Beispieltext-Cleanup (~2000 Zeilen) | 2026-05-21 |
| `styles.css` | Design inkl. Zwei-Spalten-Layout und zugeklappte Zusatzfelder | 2026-05-21 |
| `praxis_memo_server.py` | Lokaler HTTP-Server + Whisper-Transkription + Ollama-Proxy | 2026-05-21 |
| `Start Praxis Memo.bat` | Startet Python-Server, öffnet Browser | unverändert |
| `KI einrichten.bat` | Installiert Ollama + faster-whisper + Modelle | 2026-05-10 |
| `Datenordner oeffnen.bat` | Öffnet data/ und backups/ im Explorer | unverändert |
| `PC KI Leistung pruefen.bat` | Prüft RAM/CPU/Ollama-Modelle auf dem NUC, schreibt `data/pc-ki-check.txt` | 2026-05-21 |
| `Besseres Modell installieren.bat` | Lädt/aktiviert optional `qwen2.5:7b` ab 16 GB RAM | 2026-05-21 |
| `Schnelles Modell (3b) zurueck.bat` | Schaltet zurück auf `qwen2.5:3b` | 2026-05-21 |
| `Paket erstellen.bat` | Packt Lieferdateien als ZIP (ohne data/) | 2026-05-21 |
| `tests/test_patient_export.js` | Isolierter Test für Patientenakte-Export inkl. Escaping, Register, Revisionen | 2026-05-21 |
| `docs/ablaufplan-miriam.md` | Realer Bedienablauf über mehrere Sitzungen pro Patient | 2026-05-21 |
| `docs/anleitung-miriam.html/.pdf` | Druckbare Anleitung für Miriam | 2026-05-21 |
| `README_PC_INSTALLATION.txt` | Kurzanleitung für lokale Windows-Installation und Aktenexport | 2026-05-21 |
| `data/` | Arbeitsdaten, nicht ins Repo | — |
| `backups/` | Backups, nicht ins Repo | — |
| `docs/HANDOVER.md` | Dieses Dokument | 2026-05-21 |

### Gelöschte Dateien
- `AnyDesk.exe` — alter lokaler Installer; AnyDesk ist nicht Teil des Betriebs
- `architecture-map.html` — ungetracktes Analyse-Artefakt, nicht Teil der App/Doku
- `.DS_Store`, `__pycache__/`, `.claude/`, `.claude-flow/` — lokale Cache-/Tool-Artefakte
- `PraxisMemo-PC/` — war ein vollständiges Duplikat aller App-Dateien
- `praxismemo-demo-strato.zip` — Build-Artefakt
- `PraxisMemo-PC.zip` — Build-Artefakt

---

## 10. Wichtige Hinweise für die nächste KI

- **Kein Framework, kein Build-Step.** Alles läuft direkt im Browser. Keine npm, kein Webpack, kein TypeScript. Änderungen an `.js` und `.html` sind sofort wirksam.
- **Design nicht anfassen.** `styles.css` bleibt wie ist. Neue Klassen ans Ende anhängen. Keine bestehenden Klassen umbenennen.
- **`STORAGE_KEY = "praxismemo-v8"`** — wenn Datenmodell inkompatibel geändert wird, auf v9 bumpen und in `normalizePatient()` migrieren.
- **`normalizePatient()` ist der Migrations-Einstiegspunkt.** Jede strukturelle Datenänderung muss dort abwärtskompatibel gemacht werden.
- **Python-Server braucht keine Abhängigkeiten außer `faster-whisper`** (nur für Diktat). Alles andere ist Standardbibliothek.
- **Ollama muss separat laufen.** Die App prüft `http://localhost:11434/api/tags` beim Start. Wenn Ollama nicht läuft, ist Strukturierung deaktiviert, aber der Rest funktioniert.
- **Miriam hat kein technisches Verständnis.** Jede Änderung an der UX muss selbsterklärend sein. Keine Dialoge mit mehr als zwei Optionen. Keine Fachbegriffe.
- **Datenschutz ist kritisch.** Die App soll nie Audio oder Patientendaten nach außen senden. Vor jeder Änderung am Netzwerk-Code prüfen.
- **Export bleibt lokal.** `Akte drucken` erzeugt nur Browser-HTML aus dem vorhandenen State; kein Upload, kein externer PDF-Dienst. Beim Weiterbau auf HTML-Escaping achten (`escapeHtml`) und keine Patientendaten in Dateinamen außer dem Kürzel.
