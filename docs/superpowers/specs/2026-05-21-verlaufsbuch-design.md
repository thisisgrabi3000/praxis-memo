# Design: Verlaufsbuch & abhakbare offene Punkte

Stand: 2026-05-21

## Problem

Zwischen den Sitzungen ist heute nicht nachvollziehbar, was wann besprochen wurde und ob
ein in Sitzung 1 als „offen" strukturierter Punkt später erledigt wurde. Ursache im Code:
`status: "erledigt"` wird **nirgends gesetzt** — `updatePatientMemoryFromSession` schiebt
`summary.open`/`summary.agreement`/`summary.watch` nur in die Register-Eimer (dedupliziert
per exaktem Text-Match), und die `status !== "erledigt"`-Filter greifen nie. Das Register
wächst dadurch nur an; es gibt kein Abhaken, keine Datums-Provenienz und keinen lesbaren Faden.

## Zielbild

Ein chronologisches **Verlaufsbuch** („wie ein Buch": Datum, Bemerkungen, Punkte je Sitzung)
plus eine lebende **„Noch offen"-Liste**, in der offene Punkte jederzeit — auch zwischen
Sitzungen — mit Datum abgehakt und manuell ergänzt werden können.

## Entscheidungen (vom Nutzer bestätigt)

1. **Layout = Variante B**: zweispaltig — links datiertes Verlaufsbuch (lesen), rechts
   „Noch offen"-Liste (handeln).
2. **Manuelles Hinzufügen** offener Punkte durch die Nutzerin (mit Datum).
3. **Abhaken mit Datum**; das Erledigt-Ereignis erscheint datiert im Buch.
4. **KI-Vorschlag mit Pflicht-Bestätigung**: Beim Strukturieren schlägt die KI vor, welche
   bestehenden offenen Punkte erledigt scheinen; angewendet wird nur nach „Ja" der Nutzerin.
5. **Platzierung** im Workflow-Schritt **„Anknüpfen" (prep)**. Der Schnellblick oben bleibt
   die Kurzfassung.

## Datenmodell

Bestehender Register-Eintrag (`normalizeMemoryItem`) wird um drei Felder ergänzt:

| Feld | Bedeutung |
|------|-----------|
| `resolvedAt` | ISO-Zeitstempel, gesetzt beim Abhaken (sonst `""`) |
| `resolvedSessionId` | Sitzung, in der abgehakt wurde (oder `""` bei Abhaken zwischen Sitzungen) |
| `origin` | `"ki"` (aus Strukturierung) oder `"manuell"` (selbst ergänzt) |

`normalizeMemoryItem` muss diese Felder defaultsicher migrieren (Altbestände: `resolvedAt=""`,
`origin="ki"`). Status-Werte bleiben `"offen"` / `"erledigt"`; „erledigt" wird ab jetzt
tatsächlich gesetzt (beim Abhaken: `status="erledigt"`, `resolvedAt=now`).

**Append-only beachten:** Abhaken überschreibt keine Inhalte, es ergänzt nur Resolved-Felder.
Abgehakte Einträge werden nicht gelöscht (bleiben als durchgestrichen/erledigt sichtbar).

## Buch-Ableitung (kein separater Event-Log)

Das Verlaufsbuch wird **deterministisch aus vorhandenen Zeitstempeln abgeleitet**, nicht
zusätzlich gespeichert. Ereignisse:

- **Sitzung** — je archivierter Session ein Eintrag an `session.date` mit Kern/Notiz.
- **Punkt entstanden** — Register-Eintrag an `sourceDate` (bei `origin:"manuell"` als
  „➕ ergänzt", bei `origin:"ki"` im Sitzungseintrag enthalten).
- **Punkt abgehakt** — Register-Eintrag an `resolvedAt` als „✓ abgehakt".

Sortierung: chronologisch nach Datum (Sekundärschlüssel: Sitzung vor Punkt-Ereignissen am
selben Tag). Reine Renderlogik, kein neuer Speicher.

## „Noch offen"-Liste

- Zeigt alle Einträge mit `status==="offen"` über alle Eimer, mit Herkunft
  (`aus Sitzung <Datum>` bzw. `selbst <Datum>`) und „seit"-Datum.
- Abgehakte unten, durchgestrichen, mit `✓ <Datum>`.
- **Hinzufügen**: Eingabezeile + Button → neuer Eintrag in `openQuestions`,
  `origin:"manuell"`, `sourceDate=todayIso()`, `status:"offen"`.
- **Abhaken**: Klick auf Box → `status="erledigt"`, `resolvedAt=now`. (v1: kein Wieder-Öffnen.)

## KI-Vorschlag „scheint erledigt"

- Server-Strukturierung (`praxis_memo_server.py`): JSON-Antwort um Feld
  `"resolved": ["<Originaltext eines offenen Punktes>", …]` erweitern; Prompt erklärt, nur
  bereits offene Punkte zu nennen, die im neuen Diktat erkennbar behandelt wurden.
- Client: nach dem Strukturieren werden `resolved`-Texte gegen die offenen Register-Einträge
  gematcht (case-insensitive, normalisierter Text). Treffer bekommen in „Noch offen" einen
  Hinweis „_Scheint erledigt — stimmt das?_ [Ja, abhaken] [Nein]". Nur „Ja" setzt resolved.
- **Nie automatisch anwenden.** Kein stilles Abhaken.

### Risiko / Mitigation

`qwen2.5:3b` ist klein → Vorschläge sind unzuverlässig. Deshalb: ausschließlich Vorschlag +
Pflicht-Bestätigung, Anzeige des Originaltexts, robustes Fallback wenn `resolved` fehlt/leer
ist (Feature funktioniert ohne KI-Vorschläge weiter; manuelles Abhaken bleibt der Hauptweg).
Abwärtskompatibel: alte Server-Antworten ohne `resolved` führen einfach zu keinen Vorschlägen.

## Bewusst nicht in v1 (YAGNI)

- Kein Bearbeiten/Umformulieren bestehender Punkte (nur Hinzufügen + Abhaken).
- Kein Wieder-Öffnen abgehakter Punkte.
- Keine neuen Register-Kategorien.
- Kein separater persistenter Event-Log (Buch wird abgeleitet).

## Tests (Node, wie `tests/test_*.js`)

1. Abhaken setzt `status="erledigt"` + `resolvedAt`, löscht nichts.
2. Manuelles Hinzufügen erzeugt Eintrag mit `origin:"manuell"`, `status:"offen"`, Datum heute.
3. Buch-Ableitung: Sitzungen + entstandene + abgehakte Punkte korrekt chronologisch sortiert.
4. KI-`resolved`-Matching erzeugt nur Vorschläge (kein Statuswechsel ohne Bestätigung);
   fehlendes/leeres `resolved` → keine Vorschläge, kein Fehler.
5. Migration: Altbestand ohne neue Felder lädt fehlerfrei (`resolvedAt=""`, `origin="ki"`).

## Berührte Stellen (Orientierung, kein Plan)

- `app.js`: `normalizeMemoryItem` (Felder), neue Funktionen für Abhaken/Hinzufügen,
  Buch-Ableitung + Render, „Noch offen"-Render + Eventhandler, KI-Vorschlags-Abgleich nach
  `structureTranscript`, Einhängen im prep-Schritt.
- `index.html`: Container für Buch + „Noch offen" im prep-Panel.
- `styles.css`: Zwei-Spalten-Layout, Checkbox/Datums-Stile, Vorschlags-Hinweis.
- `praxis_memo_server.py`: `resolved`-Feld im Struktur-Prompt/JSON.
