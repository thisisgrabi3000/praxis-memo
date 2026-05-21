# Walkthrough-Checkliste — Demo mit Miriam

Ziel: Workflow durchspielen, Reaktionen sammeln, Änderungswünsche für die Praxis-Version festhalten.

Nicht Ziel: Code-Diskussion oder Architektur-Themen.

---

## Vor dem Treffen

- [ ] Demo lokal starten (`python3 -m http.server 3000` oder `Start Praxis Memo.bat`)
- [ ] 2-3 Demo-Patienten anlegen, einer davon mit Verlauf (mehrere archivierte Sitzungen)
- [ ] Backup gemacht (`Backup erstellen`-Button), damit nichts kaputtgeht
- [ ] Notizblock + Stift für Miriams Anmerkungen
- [ ] Mikrofon-Berechtigung im Browser einmal erteilt

---

## 1. Erster Eindruck (ohne Erklärung beobachten)

Miriam die App **ohne Anleitung** öffnen lassen. Notieren was sie zuerst anschaut, worüber sie stolpert.

- [ ] Versteht sie die drei Workflow-Schritte (Einsprechen / Prüfen / Anknüpfen) ohne Erklärung?
- [ ] Findet sie selbst raus, wie sie einen Patienten auswählt?
- [ ] Sind die Begriffe vertraut oder fremd? (Kernpunkte, Absprachen, Beobachtungsfokus)

**Frage hinterher:** *"Was war auf den ersten Blick unklar?"*

---

## 2. Patient anlegen & auswählen

- [ ] „Patient anlegen" → Kürzel eingeben (z.B. `P-014`)
- [ ] Folgetermin: Datum + Uhrzeit eintragen
- [ ] Patient in der Seitenleiste wiederfinden
- [ ] Zwischen mehreren Patienten wechseln (sie selbst klicken lassen)
- [ ] Sortierung in der Seitenleiste: nach Termin gruppiert — verständlich für sie?

**Fragen:**
- *"Wie willst du Patienten eigentlich kürzeln? Initialen, Nummer, beides?"*
- *"Brauchst du eine Übersicht aller Patienten ohne Termin?"*
- *"Möchtest du andere Sortierungen? (Alphabetisch, zuletzt bearbeitet, …)"*

---

## 3. Diktat-Workflow

Zwei Wege zum Diktieren — sie soll beide ausprobieren:

### Globales Diktat (großer roter Knopf im Schritt „Einsprechen")
- [ ] Auf den Mikro-Button klicken, ~1 Minute frei sprechen
- [ ] Stoppen → Transkription abwarten
- [ ] Ergebnis im Nachnotiz-Feld prüfen

**Frage:** *"Wie genau ist die Transkription? Was musst du nachbessern?"*

### Feld-Diktat (kleine Mic-Symbole an einzelnen Feldern)
- [ ] In ein einzelnes Feld (z.B. „Letzter Fokus") gezielt nachdiktieren
- [ ] Klappt das Anfügen oder soll es überschreiben?

**Fragen:**
- *"Welcher Weg fühlt sich für dich natürlicher an?"*
- *"Soll Diktat in ein Feld den alten Text ergänzen oder ersetzen?"*

---

## 4. KI-Strukturierung (optional in Prod)

- [ ] Längere Nachnotiz diktieren (3-5 Minuten Inhalt)
- [ ] „Strukturieren" klicken → 30-90 Sekunden warten
- [ ] Ergebnis in den vier Feldern (Kernpunkte / Absprachen / Offen / Beobachtungsfokus) prüfen

**Wichtige Fragen:**
- *"Sind die vier Felder die richtigen? Fehlt eins? Ist eines überflüssig?"*
  - Vorschläge zum Drüber-Nachdenken: Risikoeinschätzung, Diagnostik-Eindrücke, Stimmungsverlauf, ABS-Plan?
- *"Wie viel Wartezeit ist okay zwischen Sitzungen?"*
- *"Soll die KI nur strukturieren oder auch zusammenfassen/kürzen?"*
- *"Was passiert, wenn du keine KI hast — fühlt sich die manuelle Eingabe genauso gut an?"*

---

## 5. Status-Workflow (Offen → Entwurf → Geprüft)

- [ ] Statuswechsel beobachten beim Diktieren (Offen → Entwurf automatisch)
- [ ] „Geprüft speichern"-Button im Prüfen-Schritt → archiviert die Sitzung

**Fragen:**
- *"Brauchst du genau diese drei Status oder reichen zwei (Entwurf / Geprüft)?"*
- *"Soll 'Geprüft' irgendwas blockieren (Edit-Lock)? Oder weiter editierbar?"*
- *"Was ist mit Status wie 'Abgesagt' / 'Verschoben'?"*

---

## 6. Anknüpfen / Vorbereitung (Schritt 03)

- [ ] Bei einem Patient mit Verlauf in den Schritt „Anknüpfen" wechseln
- [ ] Letzte Vereinbarung, offene Punkte, Beobachtungsfokus prüfen
- [ ] Archiv aufklappen → ältere Sitzungen lesen

**Fragen:**
- *"Was brauchst du wirklich VOR der nächsten Sitzung, im 1-Minuten-Blick?"*
- *"Lieber Stichworte, ganze Sätze oder die ganze alte Nachnotiz?"*
- *"Brauchst du Suche im Verlauf? (z.B. 'wann haben wir das letzte Mal über X gesprochen')"*

---

## 7. Archiv / Verlauf

- [ ] Verlauf bei einem Patient durchscrollen
- [ ] Eine alte archivierte Sitzung editieren (klappbar)
- [ ] Im Suchfeld nach einem Stichwort suchen, das im Verlauf vorkommt

**Fragen:**
- *"Wie weit zurück willst du Sitzungen sehen können?"*
- *"Sollen Sitzungen löschbar sein? Oder nur archivierbar/ausblendbar?"*
- *"Brauchst du Export als PDF / Word für Akten?"*

---

## 8. Backup & Restore

- [ ] „Backup erstellen" klicken → Datei landet im Download-Ordner
- [ ] Mental-Modell: was bedeutet das für sie? Versteht sie es?
- [ ] Restore-Test mit der eben erstellten Backup-Datei

**Fragen:**
- *"Wo sollen Backups landen? Externes Laufwerk? USB-Stick?"*
- *"Wie oft willst du selbst aktiv ein Backup machen?"*
- *"Was passiert bei PC-Crash — wie soll Wiederherstellung aussehen?"*

---

## 9. Workflow zwischen zwei Sitzungen

Den realistischen Ablauf simulieren:

- [ ] Sitzung mit Patient A „abschließen" → Nachnotiz diktieren → strukturieren → prüfen → archivieren
- [ ] **Manuell** zu Patient B wechseln (Seitenleiste) → Anknüpfen-Schritt anschauen
- [ ] „Neue Sitzung" bei Patient B beginnen

**Fragen:**
- *"Wie viel Zeit hast du realistisch zwischen zwei Patienten?"*
- *"Was soll dich daran erinnern, die Nachnotiz NICHT zu vergessen?"*
- *"Passiert es, dass du erst Stunden später dazu kommst — wie sieht der Workflow dann aus?"*

---

## 10. Datenschutz / Vertrauen

- [ ] „Demo-Modus"-Banner oben zeigen und erklären (lokal, keine Cloud)
- [ ] Datenschutz-Box in der rechten Seitenleiste lesen
- [ ] Erklären: Praxisversion läuft OHNE Cloud (lokal-only)

**Fragen:**
- *"Was musst du gegenüber deinen Patienten verantworten können?"*
- *"Reicht dir 'läuft auf meinem PC' oder brauchst du ein Zertifikat / Gutachten?"*
- *"Hast du jemanden, der das technisch prüft (Praxis-IT, Datenschutzbeauftragte)?"*

---

## 11. Rechtliche Pflichten (§630f BGB / MDR)

Das sind Themen die du als Behandlerin betreffen, nicht nur als Software-Nutzerin. Idealerweise vor dem Prod-Bau geklärt.

- [ ] Erklären: **§630f BGB Änderungsdokumentation** — bei jeder Korrektur muss der ursprüngliche Inhalt erkennbar bleiben. Demo überschreibt aktuell still.
- [ ] Erklären: **§630f Abs. 3 BGB** — Akten 10 Jahre nach Behandlungsende aufbewahren.
- [ ] Erklären: **§630g BGB Auskunftsrecht** — Patient kann jederzeit Kopie der ganzen Akte verlangen.

**Fragen:**
- *"Wie viele Korrekturen passieren bei dir realistisch nach 'Geprüft'? Tippfehler? Nachträge?"*
- *"Wie willst du mit Patienten-Auskunftsersuchen umgehen — als PDF? Ausdruck? Komplettes Sitzungs-Archiv?"*
- *"Hast du eine Datenschutzbeauftragte oder berätst du dich mit deiner KV (Kassenärztliche Vereinigung) zu der App?"*
- *"Ist dir die Diskussion um Medizinprodukt-Status (MDR) bekannt? Auch wenn du als Einzeltherapeutin baust/nutzt, sollte das geklärt sein (MDR Art. 5(5) Eigenherstellung)."*
- *"Wie lange willst du selbst alte Sitzungen aktiv sehen? (5 Jahre? Komplett ausgrauen ab dann?)"*

---

## 12. Was fehlt? (Offene Runde)

Letzter Teil — offene Fragen, freier Raum für Wünsche.

- *"Was würdest du jetzt gerne machen können, was hier nicht geht?"*
- *"Welcher Schritt fühlt sich am umständlichsten an?"*
- *"Wenn du nur EINE Verbesserung haben könntest — welche?"*
- *"Wer außer dir würde diese App benutzen? (Vertretung, Praxismitarbeiterin)"*
- *"Was machst du bisher stattdessen? (Papier, Word, Praxissoftware) — was war daran gut/schlecht?"*

---

## Nach dem Treffen

- [ ] Alle Notizen in `docs/walkthrough-notes.md` schreiben (rohe Form, ungefiltert)
- [ ] Backup der Demo-Daten archivieren falls echte Beispiele drinstecken (dann löschen)
- [ ] Aus den Notizen die **Prod-Spec** ableiten — was kommt rein, was bleibt draußen, was wird geändert
- [ ] Prod-Setup separat anfangen, nicht den Demo-Code weiterbauen (frische Codebase)
