# Design: Feldfarben, Patientenliste & psychopathologischer Befund

Datum: 2026-05-26
Status: Entwurf zur Abnahme

Drei Änderungen nach dem Test mit Miriam, gemeinsam geplant, im Spec getrennt.
Reihenfolge der Umsetzung: erst die zwei kleinen UI-Punkte (1, 2), dann das große
Befund-Modul (3) stufenweise.

---

## 1. Farbflächen-System für die ganze Seite (klein/mittel)

**Ziel:** Nicht nur die vier Prüfen-Felder, sondern **alle inhaltlichen Bereiche der
Seite** sollen sich durch dezente farbige Flächen voneinander abheben, damit die Seite
insgesamt übersichtlicher/strukturierter wirkt. Alles abgestimmt auf das **Blau der App**.

**Farbgrundlage (bestehende Palette, `styles.css` `:root`):** Das App-Blau ist ein tiefes
Petrol-/Navyblau (`--forest #16324a`, `--forest-soft #2d506a`) mit weichen blaugrauen
Flächen (`--sage`, `--box-blue`, `--paper-soft`) und gedämpften Akzenten
(Grün `#2e7d52`, Amber `#8b6a37`/`--amber`, Rot `#9c4f45`/`--red`). Alle neuen
Flächentöne werden **aus dieser Familie abgeleitet** — niedrig gesättigt, ruhig, nichts
Knalliges.

**Umsetzung:** Neue, klar benannte Flächen-Variablen im `:root` (z. B. `--surface-1…n`
als helle Tints des Navyblaus + leichte Akzent-Beimischung), die den Hauptbereichen
zugewiesen werden, damit sie sich optisch trennen:
- Sidebar / Patientenliste
- Patientenkopf (Kürzel/Status-Leiste)
- Workflow-Panels (Einsprechen / Prüfen / Anknüpfen / Befund)
- die vier Prüfen-Felder (`.summary-card`) — je leicht eigener Ton
- Schnellblick / Verlaufsbuch-Blöcke
- Befund-Sektionen (siehe Punkt 3)

**Prinzip:** Gleiche Farbfamilie, unterschiedliche Helligkeit/leichter Farbstich pro
Bereich → ruhige, zusammenhängende Optik statt Buntheit. Kontrast/Lesbarkeit von Text
und Eingabefeldern bleibt überall erhalten (WCAG-tauglich). Reine CSS-/Markup-Klassen-
Arbeit, keine Logikänderung.

---

## 2. Patientenliste links (klein/mittel)

**Ziel:** Eine schlichte, ruhige Liste aller Patienten zum Anklicken.

**Umsetzung:**
- Liste zeigt **nur das Kürzel**, **alphabetisch sortiert**.
- **Kein Datum** und **keine Folgetermin-Sortierung** mehr in der Liste.
- Klick auf einen Eintrag öffnet den Patienten mit allen Infos (Verhalten wie bisher).
- Der nächste Termin bleibt im System (Eingabe + Schnellblick), erscheint nur **nicht**
  mehr in der Liste.
- Aufgeräumtes Listenlayout (klare Einträge, ruhige Trennung).

**Betroffen:** `index.html` (`#patientList` / `.sidebar`), Render-Logik der Liste in
`app.js`, ggf. CSS in `styles.css`.

---

## 3. Psychopathologischer Befund (groß, neues Modul)

**Ziel:** Miriam legt pro Sitzung einen psychopathologischen Befund an —
Bedienung, Aufbau und Optik **wie beim Befundomat**, aber lokal in Praxis Memo,
farblich an Miriams App angepasst, mit KI-Vorbelegung aus dem Diktat.

### 3.1 Fachliche Basis & Rechtliches
- Struktur nach dem **offenen AMDP-Standard** (18 Sektionen).
- Textbausteine und Normalbefund-Texte werden **selbst formuliert** (AMDP-Nomenklatur
  als Allgemeingut). Befundomats konkrete, geschützte Formulierungen werden **nicht**
  übernommen.
- Entwurf der Bausteine durch die Entwicklung, **fachliche Prüfung/Ergänzung durch
  Miriam** (sie ist die Fachperson).

### 3.2 Sektionen (18)
Bewusstsein · Orientierung · Konzentration & Gedächtnis · Formales Denken ·
Psychomotorik · Erscheinung · Kommunikationsverhalten · Psychovegetativum ·
Affekte & Impulse · Vitalität & Stimmung · Wahrnehmung ·
Inhaltliches Denken & Ich-Störungen · Abhängigkeitserzeugendes Verhalten · Ängste ·
Zwänge · Selbstwert & Krankheitseinstellung · Eigen- & Fremdgefährdung (inkl.
Suizidalität) · Globalparameter.

### 3.3 Bedienung (wie Befundomat)
- Pro Sektion ein **„Normalbefund"-Klick** → setzt die Sektion auf unauffälligen
  Standardtext.
- **Globaler „Alles unauffällig"-Button** → setzt mit einem Klick alle 18 Sektionen auf
  Normalbefund; danach werden nur Abweichungen angeklickt.
- Pro Sektion anklickbare **Abweichungs-Bausteine** (Mehrfachauswahl), plus
  „nicht erhebbar"-Optionen.
- Angeklickte Bausteine setzen sich automatisch zu einem **sauberen Fließtext** zusammen
  (Verknüpfungs-/Grammatiklogik).
- **Farbflächen je Sektion** zur Unterscheidung — abgestimmt auf Miriams App-Farben.
- **Kopieren-Button** (Zwischenablage) und Übernahme in die **Akte/Druckansicht**.

### 3.4 KI-Anbindung (Ansatz A: KI schlägt nur Items vor)
- Default-Zustand: alle Sektionen = Normalbefund.
- Die **lokale KI** liest das Sitzungs-Diktat und markiert, welche Sektionen vom
  Normalbefund **abweichen** und welcher Baustein passt — sie „kippt" nur diese Sektionen.
- Den **Fließtext bauen ausschließlich unsere eigenen Bausteine** (kein frei
  generierter Befundtext → keine Halluzination, konsistent, prüfbar).
- Miriam **bestätigt/ändert per Klick** (Prinzip „KI schlägt vor, Mensch prüft").
- Neuer/erweiterter Server-Endpoint (z. B. `/api/befund-suggest`) auf Basis des
  bestehenden lokalen Ollama-Aufrufs; gibt Sektion→Baustein-Vorschläge (IDs) zurück,
  keinen Freitext.

### 3.5 Bezug & Fortschreibung
- **Pro Sitzung** ein Befund, **mitarchiviert** (wie die Nachnotiz) und im Verlaufsbuch
  sichtbar.
- Eine **neue Sitzung übernimmt den letzten Befund** als Ausgangspunkt; Miriam passt nur
  Änderungen an. Frühere Stände bleiben als Revision erhalten (vorhandenes Modell).

### 3.6 Datenmodell (Skizze)
- Befund-Zustand pro Sitzung = Auswahl je Sektion: `{ sektionId: { normal: bool,
  items: [bausteinId...], nichtErhebbar?: grund } }`.
- Statischer Baustein-Katalog (JSON): 18 Sektionen, je Normalbefund-Text + Items mit
  `id`, `label`, `textbaustein`.
- Fließtext wird aus Auswahl + Katalog deterministisch gerendert.

### 3.7 Verortung in der UI
- Eigener Bereich/Tab **„Befund"** beim Patienten (neben Einsprechen / Prüfen / Anknüpfen).

---

## Scope & Stufen
- **Stufe 1 (schnell):** Farbflächen-System (1) + Patientenliste (2). Reine CSS/Markup-Arbeit, können zuerst live gehen.
- **Stufe 2:** Befund-Gerüst — Datenmodell, UI, Normalbefund (pro Sektion + global),
  Klick-Abweichungen, Fließtext, Kopieren/Akte, Speichern/Fortschreibung.
- **Stufe 3:** KI-Vorbelegung aus dem Diktat (Ansatz A).
- **Laufend:** Textbausteine je Sektion ausbauen/verfeinern (Miriam fachlich).

## Bewusst nicht enthalten (YAGNI, ggf. später)
- Lexikon-Definitionen je Item, PPB3-ID-Export, wissenschaftliche Exportformate.
- Automatische Risikobewertung — bleibt menschliche Entscheidung (Suizidalität immer prüfen).

## Risiken / Hinweise
- **Inhaltsarbeit** (eigene Textbausteine für 18 Sektionen) ist der größte Aufwand →
  stufenweise, fachlich von Miriam abgenommen.
- **KI-Zuverlässigkeit:** kleine lokale Modelle können Sektionen falsch zuordnen →
  Default Normalbefund + Pflicht-Prüfung durch Miriam mindern das Risiko; profitiert vom
  geplanten stärkeren lokalen Modell (large-v3 + 14–32B).
- **Datenschutz:** läuft vollständig lokal/offline, kein Cloud-Dienst.
