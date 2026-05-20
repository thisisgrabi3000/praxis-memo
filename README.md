# PraxisMemo Vorschau

Browser-Demo mit fiktiven, praxisnahen Patientenkürzeln. Die Vorschau ist nur zur Erklärung des Workflows gedacht und darf nicht mit echten Patientendaten genutzt werden.

## Lokal starten

Die App benötigt ihren lokalen Server (für Diktat und KI-Strukturierung):

```bash
python3 praxis_memo_server.py
```

Der Server bindet `127.0.0.1:3000` und öffnet den Browser automatisch. `python3 -m http.server` liefert nur die statische Oberfläche **ohne** Diktat/KI und ist nicht ausreichend.

## Als WhatsApp-Link teilen

Die Demo ist eine statische Seite. Für Strato müssen diese Dateien in einen Webordner hochgeladen werden:

- `index.html`
- `styles.css`
- `app.js`

Danach kann der HTTPS-Link per WhatsApp geteilt werden.

Wichtig: In diese Online-Demo gehören ausschließlich fiktive Daten. Keine echten Patientendaten, keine echten Audioaufnahmen, keine Cloud-KI.

## Diktierfunktion

Die Diktierfunktion läuft vollständig lokal: Der Browser nimmt das Audio per `MediaRecorder` auf und schickt es an den lokalen Server (`/api/transcribe`), der es mit [faster-whisper](https://github.com/SYSTRAN/faster-whisper) auf dem Gerät transkribiert. Es wird **keine** Browser-`SpeechRecognition`/Web-Speech-API und **kein** Cloud-Dienst verwendet — kein Audio verlässt den PC.

Es gibt zwei Diktierwege:

- globales Diktat im Schritt „Einsprechen“ für das Transkript
- kleine Mikrofonbuttons direkt an jedem editierbaren Feld, um fehlende Inhalte gezielt nachzudiktieren

Voraussetzung ist, dass `faster-whisper` installiert ist (über `KI einrichten.bat`). Ohne Installation zeigt die App eine klare Meldung, ein Cloud-Fallback existiert bewusst nicht.

## Speicherung in der Demo

Alle Änderungen werden nur im jeweiligen Browser per `localStorage` gespeichert. Andere Besucher sehen ihre eigene lokale Demo-Version. Über „Demo zurücksetzen“ werden die lokalen Demodaten wiederhergestellt.

## Sitzungsarchiv

Der Ablauf ist jetzt pro Patient als Verlauf gedacht:

1. Nach der Sitzung Nachnotiz diktieren oder eintippen.
2. Automatisch strukturieren lassen.
3. Inhalte fachlich prüfen und mit „Geprüft speichern“ archivieren.
4. Vor dem nächsten Termin zeigt „Anknüpfen“ die letzte Vereinbarung, offene Punkte und den Verlauf.
5. Mit „Neue Sitzung“ beginnt ein neuer Entwurf, ohne alte Einträge zu überschreiben.

Archivierte Sitzungen bleiben pro Patient als Timeline erhalten und können in der Vorbereitungsansicht aufgeklappt und editiert werden.

## Kalender aktualisieren

Die Demo zeigt den geplanten lokalen Abgleich mit einem führenden Kalender/Praxissystem:

- Button „Kalender aktualisieren“ übernimmt Terminänderungen in die Tagesliste.
- Der Zeitpunkt der letzten manuellen Aktualisierung bleibt sichtbar.
- Terminstatus und Notizstatus sind getrennt: `Abgesagt` oder `Verschoben` verändert nicht den Patientenverlauf.
- In der Demo werden fiktive Kalenderänderungen simuliert. In der Praxisversion müsste hier lokal eine Kalenderdatei, ein lokaler Kalender oder das Praxissystem angebunden werden.

## Spätere Praxisversion

Empfohlene Zielarchitektur:

```text
Browser-Oberfläche
  -> lokaler Dienst auf dem Windows-PC
  -> lokale Transkription
  -> lokale Zusammenfassung
  -> verschlüsselte lokale Datenbank
```

Die Psychologin braucht dann voraussichtlich:

- Windows-11-PC, idealerweise Windows 11 Pro
- installierte lokale App
- Edge oder Chrome
- BitLocker oder vergleichbare Geräteverschlüsselung
- verschlüsseltes Backup

Geplante Abos:

- kein KI-Abo
- kein Cloud-Hosting für Patientendaten
- Microsoft 365 nur optional, falls die Praxis es ohnehin nutzt
- Wartung und Datenschutzprüfung separat einplanen
