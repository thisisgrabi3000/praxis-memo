Praxis Memo - DEMO-Version
==========================

Diese Version dient nur zum Anschauen und Testen.
KEINE echten Patientendaten eingeben!

Was funktioniert in der Demo
----------------------------
- Patient anlegen, Felder ausfuellen
- Termine eintragen, Auto-Sortierung nach Datum
- Backup erstellen / wiederherstellen
- Patientenakte ueber "Akte drucken" als Druckansicht oeffnen
- Strukturierung von Notizen mit KI (lokal ueber Ollama, falls eingerichtet)

Was NICHT funktioniert in der Demo
----------------------------------
- Diktat (Mikrofon-Knopf): braucht die lokale Spracherkennung,
  die nur in der Vollversion installiert wird.
- Zum Testen einfach Text in das Notizfeld eintippen oder einfuegen.


Einrichtung (einmalig)
======================

1. Python aus dem Microsoft Store installieren:
   - Microsoft Store oeffnen
   - Nach "Python 3.12" suchen
   - Installieren (vom "Python Software Foundation")

2. Die Datei "Start Praxis Memo (Demo).bat" doppelklicken.
   Beim ersten Start eventuell Windows-Sicherheitswarnung
   bestaetigen ("Trotzdem ausfuehren").

Das schwarze Fenster weist auf den DEMO-Modus hin. Die Browser-App selbst
ist dieselbe lokale App wie in der Vollversion; nur die eingegebenen Daten
sollten fuer diese Vorschau erfunden oder anonymisiert sein.


Beenden
=======
Das schwarze Konsolenfenster schliessen.


Wichtig
=======
Diese Demo sendet keine Notizen an OpenAI oder andere Cloud-Dienste.
Strukturierung und Diktat funktionieren nur, wenn Ollama und Whisper
lokal eingerichtet wurden.

Trotzdem ausschliesslich erfundene oder anonymisierte Daten verwenden,
bis Datenschutz, Verschluesselung und Backup-Konzept fachlich geprueft sind.

Fuer den echten Praxisbetrieb gibt es eine Vollversion, die alles
lokal auf dem PC verarbeitet (kein Internet, keine Cloud).
