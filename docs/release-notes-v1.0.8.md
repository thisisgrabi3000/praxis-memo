# Release Notes v1.0.8 — Verlaufsbuch & abhakbare offene Punkte

Stand: 2026-05-22

## Neu
- Im Schritt **Anknüpfen** gibt es jetzt ein chronologisches **Verlaufsbuch** neben einer lebenden **„Noch offen"-Liste**. Das Buch ist **pro Tag gebündelt** (ein Block je Termin, neueste oben): die Sitzung(en) des Tages plus kompakte Zeilen „✓ erledigt: …" / „➕ ergänzt: …". So wächst es pro Termin statt pro einzelnem Punkt.
- Archivierte Sitzungen sind im Verlaufsbuch **aufklappbar und rückwirkend editierbar** (Kernpunkte/Absprachen/Offen/Transkript).
- **Offene Punkte abhaken** mit einem Klick — mit Erledigt-Datum; der Haken erscheint datiert im Verlaufsbuch. Abgehakte Punkte werden nicht gelöscht, sondern als „erledigt" durchgestrichen und in einer ausklappbaren Liste aufbewahrt.
- **Offene Punkte selbst hinzufügen** — Eingabezeile „+ Hinzufügen"; eigene Punkte tragen die Herkunft `selbst` mit Datum, KI-Punkte `aus Sitzung <Datum>`.
- **KI-Vorschlag „scheint erledigt"**: Beim Strukturieren schlägt die KI vor, welche bereits offenen Punkte in der neuen Nachnotiz behandelt wurden. Der Vorschlag wird **nie automatisch angewendet** — er erscheint als „Scheint erledigt — stimmt das? [Ja, abhaken] [Nein]" und wird erst durch Bestätigung gesetzt.
- **Folgetermin-Erinnerung**: Beim Freigeben einer Sitzung ohne zukünftigen Folgetermin fragt die App nach („trotzdem freigeben?"); bei Abbruch springt sie zum Datumsfeld. Übergehbar, kein Zwang.

## Logik / Nachvollziehbarkeit
- Jeder Register-Eintrag merkt sich Herkunft (`origin`: ki/manuell), Quelldatum (`sourceDate`) und beim Abhaken das Erledigt-Datum (`resolvedAt`).
- Das Verlaufsbuch wird **deterministisch aus diesen Zeitstempeln abgeleitet** — keine doppelte Datenhaltung. So bleibt nachvollziehbar, wann ein Punkt entstand und wann er abgehakt wurde.
- Append-only: Abhaken überschreibt keine Inhalte und löscht nichts.

## Technisch
- Keine neuen Abhängigkeiten; alles läuft lokal im Browser.
- Server-Strukturierung liefert zusätzlich ein `resolved`-Array (Pass-through, abwärtskompatibel: alte Antworten ohne `resolved` führen einfach zu keinen Vorschlägen).
- KI-Vorschläge sind beim kleinen Modell `qwen2.5:3b` nicht perfekt — deshalb strikt nur Vorschlag + Pflicht-Bestätigung; manuelles Abhaken bleibt der Hauptweg.
- Register-IDs werden in HTML-Attributen escaped (Schutz gegen manipulierte Backup-Dateien).

## Test
- `node tests/test_memory_model.js`, `test_memory_resolve.js`, `test_memory_add.js`, `test_history_book.js`, `test_resolve_suggestions.js`, `test_followup_reminder.js`, `test_patient_export.js` — alle grün.
- `node --check app.js`, `python3 -m py_compile praxis_memo_server.py`.
- UI-Smoketest (Verlaufsbuch, Abhaken, Hinzufügen, KI-Vorschlag bestätigen) in isolierter `file://`-Sandbox verifiziert.
