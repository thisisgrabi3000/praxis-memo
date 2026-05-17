# Prod-Spec: Praxis Memo (lokale Produktivversion)

**Status:** Sammelpunkt für die Anforderungen an die Prod-Version. Wird durch Walkthrough mit Miriam ergänzt.

**Grundsatz:** Frische Codebase, nicht den Demo-Code weiterbauen. Demo war zum Diskutieren, Prod muss von Anfang an wie Gesundheitsdaten-Software gebaut sein.

---

## 0. Was aus der Demo komplett rausfällt

- **OpenAI-Branch** (`praxis_memo_server.py:38-43, 211-243` + `kiMode === "openai-demo"` Pfade in `app.js`) — Prod ist Cloud-frei
- **`localStorage` als Primary Storage** — wird in Prod nur Cache zum schnellen Hydrate, nie Source of Truth
- **`Datenordner oeffnen.bat`, `KI einrichten.bat`, `Paket erstellen.bat`** — durch saubere Installer ersetzen

---

## 1. Architektur-Pfeiler

### Local-only, kein Cloud-Sync
- Browser ↔ lokaler Python-Service (`127.0.0.1`) ↔ Ollama (optional) + Whisper (optional)
- Keine externen Network-Calls außer optionalem Update-Check
- Bei `--airgap` Flag auch der Update-Check disabled

### Verschlüsselte Datendatei (at-rest)
- Hauptdaten + Backups: AES-256, Passphrase beim App-Start
- Passphrase **nicht** im OS-Keychain — soll explizite Aktion pro Session sein (zweite Vertrauensebene neben BitLocker)
- Optional: passwortlos via Windows DPAPI / macOS Keychain, wenn Miriam das so will. Default: explizit

### Append-only Architektur statt Overwrite
- Sitzungen + Felder werden **nicht überschrieben**
- Jede Änderung erzeugt einen neuen Versionseintrag mit Timestamp + Diff
- UI zeigt nur die aktuelle Version, aber „Verlauf"-Button enthüllt alle früheren Versionen
- Storage-Model siehe Abschnitt 6

### Disk-Encryption-Gate beim Start
- Beim Boot prüfen: BitLocker (Windows) / FileVault (macOS) aktiv?
- Wenn nicht: rote Modal-Blockade, App startet nicht
- Override nur mit explizitem CLI-Flag `--allow-unencrypted-disk` für Test/Dev

---

## 2. Security (Pflicht)

| # | Anforderung | Implementierung |
|---|-------------|-----------------|
| 2.1 | **Origin-/CSRF-Schutz** auf allen POST-Endpoints | `Origin`/`Sec-Fetch-Site` Check, nur same-origin → 403 |
| 2.2 | **Logging sanitizen** | Keine Bodies, keine Patient-IDs in `server.log`; nur Event-Klassen + Timestamps |
| 2.3 | **Generic Error Messages** an Browser | Browser bekommt nur Error-Klasse + Code; Details ausschließlich ins lokale Log |
| 2.4 | **`beforeunload` Flush** | Letzter Edit via `navigator.sendBeacon` / `keepalive: true` Fetch, dann erst Window schließen |
| 2.5 | **Schema-Versioning + Migration** | Jeder Save trägt `version: N`. Restore prüft + migriert oder lehnt ab |
| 2.6 | **Session-Lock** im Browser | Nach X Min Inaktivität: Re-Login via Passphrase nötig |
| 2.7 | **Audio-Datei-Lifecycle** | TMP-Audio-Datei nach Transkription sofort löschen (Demo macht das schon ✓) |
| 2.8 | **Path-Traversal-Guard** | Schon in Demo gut umgesetzt (`praxis_memo_server.py:454-459`) — übernehmen |
| 2.9 | **Atomic Writes** | Schon in Demo (`write_json_atomic`) — übernehmen |

---

## 3. Rechtliche Pflichten

| # | Quelle | Anforderung |
|---|--------|-------------|
| 3.1 | **§630f BGB Abs. 1** | Append-only Änderungslog pro Sitzung mit Timestamp + Diff. Ursprünglicher Inhalt muss nach Korrektur **erkennbar bleiben**. |
| 3.2 | **§630f BGB Abs. 3** | Hauptdaten **nie automatisch löschen**, mindestens 10 Jahre lesbar nach Behandlungsende. Backup-Rotation nur für Backup-Kopien, nicht Quelle. |
| 3.3 | **§630g BGB** | „Komplette Akte" Export pro Patient als PDF (oder strukturiertes HTML zum Drucken). Pflicht: Patient kann jederzeit Kopie verlangen. |
| 3.4 | **MDR Art. 5(5)** | Klärung mit Miriams DSB / KV: greift die Eigenherstellungs-Ausnahme? Wenn nein → MDR-Konformitätsbewertung Klasse I = größere Baustelle. Vor Prod-Start klären. |
| 3.5 | **DSGVO Art. 32** | TOMs dokumentieren: Verschlüsselung, Zugriffsschutz, Wiederherstellbarkeit, regelmäßige Wirksamkeitsprüfung |
| 3.6 | **DSGVO Art. 9** | Verarbeitung von Gesundheitsdaten: Rechtsgrundlage = Behandlungsvertrag + ggf. Einwilligung für KI-Strukturierung |

---

## 4. UX-Verbesserungen aus dem Demo-Review

| # | Was | Wieso |
|---|-----|-------|
| 4.1 | **Manueller Patient-Wechsel** statt Auto-Switch | Schon in Demo entfernt — bleibt so. Miriam wechselt selbst, kein Zeitdruck |
| 4.2 | **AI-Result mit „übernehmen"-Highlight** | Statt stillem Overwrite des fokussierten Felds — Therapeutin entscheidet pro Feld |
| 4.3 | **Wartezeit-Anzeige** während AI | Mehr als nur „läuft…": geschätzte Restzeit, ggf. abbrechbar |
| 4.4 | **Suche über Verlauf** verbessern | Demo hat naive O(n²) Suche; Prod: indizierte Volltext-Suche (FTS5 in SQLite) |
| 4.5 | **Diktat-Modus pro Feld**: append vs. replace | Im Walkthrough mit Miriam klären, dann konsistent umsetzen |

---

## 5. Code-Hygiene

- Files < 500 LOC: `app.js` (1282 LOC) und `praxis_memo_server.py` (539 LOC) splitten
- JS: ES Modules ohne Build-Step — `state.js`, `storage.js`, `dictation.js`, `rendering.js`, `ki.js`, `events.js`
- Python: `handlers.py`, `transcription.py`, `structuring.py`, `backup.py`, `audit.py`
- Typing: JSDoc-Annotations für JS, Type-Hints für Python (mypy strict)
- Tests: pytest für Server-Logik, Playwright für End-to-End Browser-Workflow

---

## 6. Daten-Modell (Append-only)

Vorschlag — wird im Walkthrough mit Miriam validiert.

```
Patient
├── uid, id, status                       (mutable header)
├── nextDate, nextTime, focus              (current pointer fields)
└── sessions[]
    └── Session
        ├── id, createdAt, status
        ├── versions[]                     (immutable history)
        │   ├── version: N
        │   ├── editedAt: ISO-Timestamp
        │   ├── editedBy: "user" | "ki"    (wer hat geändert)
        │   ├── fields: { core, agreement, open, watch, transcript }
        │   └── diff: { field → previousValue }
        └── currentVersion: N              (Index in versions[])
```

**Vorteile:**
- Vollständige Historie pro Sitzung — §630f-konform
- Restore einer alten Version ist trivial (currentVersion-Pointer ändern)
- Audit-Anfragen: einfach `versions[]` exportieren
- Speicherbedarf: vertretbar, da Diff nur geänderte Felder

---

## 7. Aus dem Walkthrough — Platzhalter

Nach dem Treffen mit Miriam hier ergänzen:

- [ ] Felder-Layout (welche 4 KI-Felder sind die richtigen?)
- [ ] Status-Modell (Offen/Entwurf/Geprüft — reicht das?)
- [ ] Diktat-Append vs. -Replace per Feld
- [ ] Backup-Strategie (USB? Network-Share? wohin?)
- [ ] Export-Format für Auskunftsersuchen (PDF? HTML zum Drucken?)
- [ ] Sortier-Wünsche in der Patientenliste
- [ ] Suche-Anforderungen (Volltext? nur Patient-IDs?)
- [ ] Vertretungs-Fall: Sieht jemand anders die Daten? Wenn ja, wie?

---

## 8. Reihenfolge der Implementation

**Phase 1: Foundation (nicht UI-sichtbar)**
1. Datenmodell Append-only umsetzen + Migration aus Demo-Format
2. Verschlüsselung at-rest + Passphrase-Flow
3. Origin-Check + sanitized Logging
4. Disk-Encryption-Gate

**Phase 2: Rechtliche Pflichten**
1. Audit-Trail UI (Versionen anzeigen + restoren)
2. PDF-Export „Komplette Akte"
3. Backup-Rotation mit 10-Jahres-Schutz für Hauptdaten

**Phase 3: UX aus Walkthrough**
- Was Miriam an Wünschen geliefert hat

**Phase 4: Härtung**
- Schema-Versioning + Migration
- Session-Lock
- Code-Split
- Tests

---

## 9. Nicht-Ziele (bewusst nicht eingebaut)

- ❌ Multi-User / Praxis-Team-Sharing (Miriam arbeitet allein)
- ❌ Cloud-Sync (DSGVO-Risiko, gegen Praxis-Policy)
- ❌ App-level Authentication mit Passwort (BitLocker + Windows-Login + Session-Lock reichen)
- ❌ Mobile-App (Praxis-PC ist Anker)
- ❌ Praxissoftware-Integration (Psyprax-Only-Policy — Daten bleiben separat)
- ❌ KI-Diagnostik / Therapieempfehlungen (rein Dokumentation, keine Klinische Entscheidungs-Unterstützung — sonst Klasse-IIa MDR)
