# Release Notes v1.0.7 — Patientenakte-Export, ruhigere Ansicht

Stand: 2026-05-21

## Neu
- Neuer Button `Akte drucken` für den aktuell ausgewählten Patienten.
- Die App erzeugt lokal eine druckoptimierte Patientenakte als HTML-Ansicht.
- Im Browser-Druckdialog kann die Ansicht als PDF gespeichert werden.
- Die Hauptansicht ist ruhiger: keine rechte Doppelspalte mehr, leerer Startzustand statt voller Eingabemaske ohne Patient, Schnellblick nur bei echtem Verlauf, Zusatzfelder in `Einsprechen` sind standardmäßig zugeklappt.
- Alter `P-001`-Beispieltext wurde aus der lokalen Datendatei entfernt und wird beim Start aus altem Browser-Cache gefiltert.
- Neuer Ablaufplan für Miriam: `docs/ablaufplan-miriam.md` und aktualisierte `docs/anleitung-miriam.html/.pdf`.

## Inhalt der Akte
- aktuelle Übersicht mit Status, nächstem Termin, Fokus, Vereinbarung, offenen Punkten und aktuellem Transkript
- strukturierte Felder: Kernpunkte, Absprachen, offene Punkte, Beobachtungsfokus
- Vorbereitung für die nächste Sitzung
- Patientenregister: Risiken/Warnhinweise, sensible Themen, Schutzfaktoren, offene Fragen, Vereinbarungen
- archivierte Sitzungen inklusive Transkript, strukturierter Zusammenfassung und früherer Versionen

## Technisch
- Keine neuen Abhängigkeiten und kein externer PDF-Dienst.
- Export läuft vollständig im Browser aus dem vorhandenen lokalen App-State.
- Patiententexte werden für die HTML-Ausgabe escaped; Test deckt u. a. Script-Escaping, Register, Archiv und Revisionen ab.
- Fallback: Wenn das neue Druckfenster blockiert wird, lädt die App eine `.html`-Datei herunter.
- `removeLegacyExamplePatients()` entfernt nur den alten eindeutigen Beispielpatienten, nicht pauschal echte `P-001`-Einträge.

## Test
- `node tests/test_patient_export.js`
- `node --check app.js`
- bestehende Server-/Modellstatus-Tests bleiben grün.
