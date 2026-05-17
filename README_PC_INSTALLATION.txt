Praxis Memo lokal auf Windows starten
====================================

Was in diesem Ordner liegt
--------------------------

- Start Praxis Memo.bat
  Startet die App per Doppelklick.

- praxis_memo_server.py
  Kleiner lokaler Server. Er laeuft nur auf dem eigenen PC unter 127.0.0.1.

- index.html, styles.css, app.js
  Die eigentliche Browser-App.

- data/
  Hier wird die aktuelle Arbeitsdatei gespeichert:
  praxismemo-data.json

- backups/
  Hier werden automatische und manuelle Sicherungen abgelegt.


Einmalige Vorbereitung
----------------------

1. Python installieren:
   Microsoft Store oeffnen, nach "Python" suchen, Python von "Python Software Foundation" installieren.

2. Diese ZIP-Datei entpacken, zum Beispiel nach:
   C:\PraxisMemo


App starten
-----------

1. Den Ordner C:\PraxisMemo oeffnen.
2. Doppelklick auf:
   Start Praxis Memo.bat
3. Das schwarze Fenster offen lassen.
4. Die App oeffnet sich automatisch im Browser.

Falls der Browser nicht automatisch aufgeht, diese Adresse manuell oeffnen:
http://127.0.0.1:3000/

Wenn Port 3000 belegt ist, waehlt die App automatisch einen anderen lokalen Port.
Die richtige Adresse steht dann im schwarzen Fenster.


Backups
-------

Die App speichert laufend in:
data\praxismemo-data.json

Automatische Backups werden im Ordner backups abgelegt.
Zusaetzlich kann in der App der Button "Backup erstellen" genutzt werden.


Wichtig
-------

Diese Version ist eine lokale Vorschau mit fiktiven Daten.
Fuer echte Patientendaten braucht die Praxisversion zusaetzlich:

- verschluesselte lokale Ablage,
- klares Backup-Konzept,
- Benutzer-/Geraeteschutz,
- fachliche Pruefung aller automatisch erzeugten Inhalte.
