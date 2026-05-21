# Praxis Memo

Lokale Browser-App als Gedächtnis- und Vorbereitungsassistent für psychotherapeutische Sitzungsnotizen. Zielkontext ist eine psychologische Psychotherapeutin mit Verhaltenstherapie für Erwachsene, Einzel- und Gruppenpsychotherapie. Typische Schwerpunkte sind ADHS, Angststörungen, soziale Angst, Depression sowie arbeitsplatzbezogene psychische Störungen wie Mobbing oder Burnout. Der Fokus liegt auf Verlauf, offenen Fragen, Vereinbarungen, Risiken, Schutzfaktoren und sensiblen Themen pro Patient. Die App diagnostiziert nicht und ersetzt keine fachliche Prüfung.

## Lokal starten

Die App benötigt ihren lokalen Server (für Diktat und KI-Strukturierung):

```bash
python3 praxis_memo_server.py
```

Der Server bindet `127.0.0.1:3000` und öffnet den Browser automatisch. `python3 -m http.server` liefert nur die statische Oberfläche **ohne** Diktat/KI und ist nicht ausreichend.

Auf dem Praxis-PC kann `PC KI Leistung pruefen.bat` per Doppelklick ausgeführt werden. Das Skript prüft RAM, CPU und vorhandene Ollama-Modelle und schreibt einen Bericht nach `data/pc-ki-check.txt`; es lädt nichts herunter.

## Diktierfunktion

Die Diktierfunktion läuft vollständig lokal: Der Browser nimmt das Audio per `MediaRecorder` auf und schickt es an den lokalen Server (`/api/transcribe`), der es mit [faster-whisper](https://github.com/SYSTRAN/faster-whisper) auf dem Gerät transkribiert. Es wird **keine** Browser-`SpeechRecognition`/Web-Speech-API und **kein** Cloud-Dienst verwendet — kein Audio verlässt den PC.

Es gibt zwei Diktierwege:

- globales Diktat im Schritt „Einsprechen“ für das Transkript
- kleine Mikrofonbuttons direkt an jedem editierbaren Feld, um fehlende Inhalte gezielt nachzudiktieren

Voraussetzung ist, dass `faster-whisper` installiert ist (über `KI einrichten.bat`). Ohne Installation zeigt die App eine klare Meldung, ein Cloud-Fallback existiert bewusst nicht.

## Speicherung

Die App speichert im Browser als schnellen Cache und über den lokalen Python-Server in `data/praxismemo-data.json`. Automatische und manuelle Backups liegen unter `backups/`. Tests sollten weiterhin mit fiktiven oder anonymisierten Daten erfolgen, bis Verschlüsselung, Backup-Konzept und Datenschutzprüfung abgeschlossen sind.

## Sitzungsarchiv

Der Ablauf ist jetzt pro Patient als Verlauf gedacht:

1. Nach der Sitzung Nachnotiz diktieren oder eintippen.
2. Automatisch strukturieren lassen.
3. Inhalte fachlich prüfen und mit „Geprüft speichern“ archivieren.
4. Vor dem nächsten Termin zeigt „Anknüpfen“ die letzte Vereinbarung, offene Punkte und den Verlauf.
5. Mit „Neue Sitzung“ beginnt ein neuer Entwurf, ohne alte Einträge zu überschreiben.

Archivierte Sitzungen bleiben pro Patient als Timeline erhalten und können in der Vorbereitungsansicht aufgeklappt und editiert werden.
Zusätzlich pflegt die App beim Prüfen ein Längsschnittregister für Risiken/Warnhinweise, Schutzfaktoren, offene Fragen, Vereinbarungen und sensible Themen. Diese Registereinträge werden vor Folgeterminen prominent angezeigt und der KI bei späteren Strukturierungen als Kontext mitgegeben.

## Offene Punkte vor Produktivbetrieb

- verschlüsselte lokale Ablage zusätzlich zu BitLocker/FileVault
- belastbares externes Backup-Konzept
- fachliche und datenschutzrechtliche Prüfung
- reale Tests auf dem Praxis-PC mit installiertem Ollama und Whisper
