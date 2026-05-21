# Design: Folgetermin-Erinnerung beim Freigeben

Stand: 2026-05-21

## Problem

Beim Diktieren und Freigeben einer (Folge-)Sitzung wird leicht vergessen, den nächsten
Termin einzutragen. Die App soll daran erinnern — ohne zu blockieren und ohne zu
erfundenen Terminen zu zwingen.

## Entscheidungen

- **Strenge**: übergehbare Erinnerung, kein Hard-Block. (Strukturieren bleibt eine reine
  Inhaltsverarbeitung; ein harter Block würde bei noch offener Terminvergabe zu Fake-Eingaben zwingen.)
- **Zeitpunkt**: beim **Freigeben/Abschluss** (`approveCurrent()`, Schritt „Prüfen"), nicht
  beim Strukturieren. Das ist der Moment „Sitzung fertig — wann sehe ich den Patienten wieder?".
- **Bedingung**: erinnern, wenn **kein zukünftiger** Folgetermin existiert:
  - `nextDate` leer → erinnern
  - `nextDate` heute oder in der Vergangenheit → erinnern
  - `nextDate` echt in der Zukunft → still durchlassen

  (Begründung: beim Archivieren wird `nextDate`/`nextTime` nicht geleert — in einer
  Folgesitzung steht also meist noch der alte Termin drin. „Nur wenn leer" würde das
  eigentliche Problem verfehlen.)

## Verhalten

In `approveCurrent()` vor dem Archivieren:

1. `hasFutureFollowUp(patient)` prüfen. True → unverändert weiter wie bisher.
2. False → `window.confirm` (konsistent mit dem bestehenden Restore-Dialog):
   > „Kein Folgetermin in der Zukunft eingetragen. Trotzdem freigeben und archivieren?
   > OK = trotzdem fortfahren · Abbrechen = Termin eintragen"
   - **OK** → normales Archivieren läuft weiter (bestehender Code unverändert).
   - **Abbrechen** → kein Archivieren; `setActiveStep("record")` und Cursor ins
     Datumsfeld (`[data-field="nextDate"]` in `recordPanel`).

## Umfang

- Neue Helper-Funktion `hasFutureFollowUp(patient)`: Vergleich `nextDate` gegen `todayIso()`.
  Leeres/ungültiges Datum → `false`. Datum `> heute` → `true`.
- Eine Guard-Abfrage am Anfang von `approveCurrent()`. Sonst keine Änderung an der Funktion.
- Kein neues UI-Element, kein neues Feld, keine Server-/Datenmodell-Änderung.

## Bewusst nicht dabei (YAGNI)

- Keine Erzwingung/Block beim Strukturieren.
- Kein Hard-Block beim Freigeben.
- Kein Auto-Ausfüllen von Terminen, kein Leeren von `nextDate` beim Archivieren.

## Test

Node-Test analog zu `tests/test_patient_export.js`: `hasFutureFollowUp` für die drei Fälle
(leer / Vergangenheit / Zukunft). String-Vergleich `YYYY-MM-DD` reicht (lexikografisch =
chronologisch), oder Vergleich gegen `todayIso()`.
