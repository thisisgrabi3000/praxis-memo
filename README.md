# PraxisMemo Vorschau

Browser-Demo mit fiktiven, praxisnahen Patientenkürzeln. Die Vorschau ist nur zur Erklärung des Workflows gedacht und darf nicht mit echten Patientendaten genutzt werden.

## Lokal starten

```bash
python3 -m http.server 3000
```

Dann im Browser öffnen:

```text
http://localhost:3000/
```

## Als WhatsApp-Link teilen

Die Demo ist eine statische Seite. Für Strato müssen diese Dateien in einen Webordner hochgeladen werden:

- `index.html`
- `styles.css`
- `app.js`

Danach kann der HTTPS-Link per WhatsApp geteilt werden.

Wichtig: In diese Online-Demo gehören ausschließlich fiktive Daten. Keine echten Patientendaten, keine echten Audioaufnahmen, keine Cloud-KI.

## Diktierfunktion

Die Demo nutzt die Browser-Schnittstelle `SpeechRecognition`, wenn sie verfügbar ist. Das funktioniert typischerweise in Chrome oder Edge und benötigt HTTPS sowie eine Mikrofonfreigabe.

Es gibt zwei Diktierwege:

- globales Diktat im Schritt „Einsprechen“ für das Transkript
- kleine Mikrofonbuttons direkt an jedem editierbaren Feld, um fehlende Inhalte gezielt nachzudiktieren

Für echte Patientendaten ist diese Browser-Diktierfunktion nicht geeignet, weil Browser-Anbieter die Erkennung je nach Umsetzung nicht garantiert lokal verarbeiten. Die spätere Praxisversion sollte lokale Transkription auf dem Praxis-PC verwenden.

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
