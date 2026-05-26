# Stufe 2a: Befund-Engine (Katalog + Fließtext) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die reine Logik des psychopathologischen Befunds bauen — ein AMDP-Katalog (Datenstruktur) und Funktionen, die aus einer Auswahl (Normalbefund + Abweichungen) deterministisch einen Fließtext erzeugen. Keine UI, keine KI, keine Persistenz (kommen in 2b–2d).

**Architecture:** Neue, DOM-freie Datei `befund.js` mit (a) `BEFUND_CATALOG` (Sektionen mit Normalbefund + Abweichungs-Items), (b) reinen Funktionen `befundDefaultSelection`, `befundSectionText`, `befundFliesstext`. Dual-Mode (`module.exports` für Node-Tests, globale Konstanten für den Browser). Tests laufen als Node-Skript über `require("../befund.js")`.

**Tech Stack:** Vanilla JS, Node-Tests (`node tests/<file>.js`, `assert`).

**Roadmap (Folge-Pläne, NICHT Teil von 2a):** 2b Befund-Tab-UI (Normalbefund-/Klick-Bedienung, Render) · 2c Persistenz pro Sitzung + Fortschreibung + Kopieren/Akte · 2d KI-Vorbelegung aus Diktat.

**Klinischer Vorbehalt:** Der Katalog-Inhalt in 2a ist ein **kleiner Starter mit Standard-AMDP-Formulierungen** zum Bauen/Testen. Der vollständige, fachlich geprüfte Textbaustein-Katalog wird von Miriam beigesteuert/freigegeben, bevor das Modul klinisch genutzt wird. `befund.js` trägt dazu einen Kopfkommentar.

---

## File Structure

- `befund.js` (Create, Projektwurzel) — Katalog-Daten + reine Engine-Funktionen. Eine klare Verantwortung: „aus Auswahl wird Befundtext". DOM-frei, dual-mode export.
- `tests/test_befund_engine.js` (Create) — testet die Engine-Funktionen.

Keine bestehende Datei wird in 2a verändert (Einbindung in `index.html`/Tests passiert in 2b).

---

## Datenmodell (Vertrag, in allen Tasks gleich)

```
Sektion:   { id: string, label: string, normal: string, items: Item[] }
Item:      { id: string, label: string, text: string }
Katalog:   Sektion[]
Auswahl:   { [sektionId]: { normal: boolean, itemIds: string[], nichtErhebbar?: boolean } }
```
Regel für eine Sektion: `nichtErhebbar` → fester Satz „… konnte nicht erhoben werden."; sonst `normal === true` (oder keine Items gewählt) → `normal`-Text; sonst die `text`-Bausteine der gewählten Items in Katalogreihenfolge, mit „; " verbunden. Der Gesamt-Fließtext verbindet die Sektionstexte mit Leerzeichen, jeder Satz endet auf „.".

---

## Task 1: Katalog-Datei mit Starter-Sektionen + Default-Auswahl

**Files:**
- Create: `befund.js`
- Test: `tests/test_befund_engine.js`

- [ ] **Step 1: Failing test schreiben.** Create `tests/test_befund_engine.js`:

```javascript
const assert = require("assert");
const B = require("../befund.js");

// Katalog-Form
assert.ok(Array.isArray(B.BEFUND_CATALOG) && B.BEFUND_CATALOG.length >= 3, "Katalog hat >=3 Sektionen");
for (const s of B.BEFUND_CATALOG) {
  assert.ok(s.id && s.label && typeof s.normal === "string", `Sektion ${s.id} vollständig`);
  assert.ok(Array.isArray(s.items), `Sektion ${s.id} hat items[]`);
  for (const it of s.items) assert.ok(it.id && it.label && it.text, `Item ${it.id} vollständig`);
}

// Default-Auswahl = alle Sektionen normal
const def = B.befundDefaultSelection(B.BEFUND_CATALOG);
for (const s of B.BEFUND_CATALOG) {
  assert.strictEqual(def[s.id].normal, true, `${s.id} default normal`);
  assert.deepStrictEqual(def[s.id].itemIds, [], `${s.id} default keine items`);
}

console.log("test_befund_engine TASK1 OK");
```

- [ ] **Step 2: Test fällt fehl.** Run: `node tests/test_befund_engine.js` → FAIL (`Cannot find module '../befund.js'`).

- [ ] **Step 3: `befund.js` mit Katalog + Default anlegen.** Create `befund.js`:

```javascript
// befund.js — Psychopathologischer Befund: Katalog + Fließtext-Engine.
// DOM-frei, dual-mode (Browser-Global + Node-require).
//
// WICHTIG (klinisch): Die folgenden Formulierungen sind ein Standard-AMDP-STARTER
// zum Bauen/Testen. Der vollständige Textbaustein-Katalog ist fachlich von Miriam
// zu prüfen und zu ergänzen, bevor das Modul klinisch genutzt wird. Keine
// medizinischen Inhalte ungeprüft erfinden.

const BEFUND_CATALOG = [
  {
    id: "bewusstsein",
    label: "Bewusstsein",
    normal: "Bewusstsein klar",
    items: [
      { id: "benommen", label: "benommen", text: "Bewusstsein benommen" },
      { id: "somnolent", label: "somnolent", text: "Bewusstsein somnolent" }
    ]
  },
  {
    id: "orientierung",
    label: "Orientierung",
    normal: "allseits orientiert",
    items: [
      { id: "zeitlich", label: "zeitlich unsicher", text: "zeitlich unsicher orientiert" },
      { id: "ortlich", label: "örtlich unsicher", text: "örtlich unsicher orientiert" }
    ]
  },
  {
    id: "stimmung",
    label: "Vitalität & Stimmung",
    normal: "Stimmung ausgeglichen, Antrieb unauffällig",
    items: [
      { id: "depressiv", label: "niedergeschlagen", text: "Stimmung niedergeschlagen" },
      { id: "antrieb_min", label: "Antrieb reduziert", text: "Antrieb vermindert" }
    ]
  },
  {
    id: "suizidalitaet",
    label: "Eigengefährdung / Suizidalität",
    normal: "keine Hinweise auf akute Suizidalität, glaubhafte Absprachefähigkeit",
    items: [
      { id: "passiv", label: "passive Todesgedanken", text: "passive Todesgedanken ohne Plan oder Absicht" }
    ]
  }
];

function befundDefaultSelection(catalog) {
  const sel = {};
  for (const s of catalog) sel[s.id] = { normal: true, itemIds: [] };
  return sel;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { BEFUND_CATALOG, befundDefaultSelection };
}
```

- [ ] **Step 4: Test grün.** Run: `node tests/test_befund_engine.js` → `test_befund_engine TASK1 OK`.

- [ ] **Step 5: Commit.**
```bash
git add befund.js tests/test_befund_engine.js
git commit -m "feat(befund): Katalog-Starter + Default-Auswahl (Engine)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Sektionstext aus Auswahl (`befundSectionText`)

**Files:**
- Modify: `befund.js`
- Test: `tests/test_befund_engine.js`

- [ ] **Step 1: Failing test ergänzen.** Hänge VOR die letzte `console.log`-Zeile in `tests/test_befund_engine.js` an:

```javascript
const sec = B.BEFUND_CATALOG.find((s) => s.id === "stimmung");
// normal
assert.strictEqual(B.befundSectionText(sec, { normal: true, itemIds: [] }),
  "Stimmung ausgeglichen, Antrieb unauffällig", "normal → Normaltext");
// nicht erhebbar
assert.strictEqual(B.befundSectionText(sec, { normal: false, itemIds: [], nichtErhebbar: true }),
  "Vitalität & Stimmung konnte nicht erhoben werden", "nicht erhebbar → fester Satz");
// abweichende items in Katalogreihenfolge, mit '; ' verbunden
assert.strictEqual(
  B.befundSectionText(sec, { normal: false, itemIds: ["antrieb_min", "depressiv"] }),
  "Stimmung niedergeschlagen; Antrieb vermindert",
  "items in Katalogreihenfolge, ';'-verbunden"
);
// leere itemIds trotz normal:false → fällt auf Normaltext zurück
assert.strictEqual(B.befundSectionText(sec, { normal: false, itemIds: [] }),
  "Stimmung ausgeglichen, Antrieb unauffällig", "keine items → Normaltext");

console.log("test_befund_engine TASK2 OK");
```
(Die `TASK1 OK`-Zeile bleibt davor stehen.)

- [ ] **Step 2: Test fällt fehl.** Run: `node tests/test_befund_engine.js` → FAIL (`befundSectionText is not a function`).

- [ ] **Step 3: `befundSectionText` implementieren.** In `befund.js` VOR den `module.exports`-Block einfügen:

```javascript
function befundSectionText(section, sel) {
  if (!sel || sel.nichtErhebbar) {
    return `${section.label} konnte nicht erhoben werden`;
  }
  const ids = Array.isArray(sel.itemIds) ? sel.itemIds : [];
  if (sel.normal || ids.length === 0) {
    return section.normal;
  }
  return section.items
    .filter((it) => ids.includes(it.id))
    .map((it) => it.text)
    .join("; ");
}
```
Und den Export erweitern:
```javascript
  module.exports = { BEFUND_CATALOG, befundDefaultSelection, befundSectionText };
```

- [ ] **Step 4: Test grün.** Run: `node tests/test_befund_engine.js` → endet mit `test_befund_engine TASK2 OK`.

- [ ] **Step 5: Commit.**
```bash
git add befund.js tests/test_befund_engine.js
git commit -m "feat(befund): Sektionstext aus Auswahl (normal/abweichend/nicht erhebbar)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Gesamt-Fließtext (`befundFliesstext`)

**Files:**
- Modify: `befund.js`
- Test: `tests/test_befund_engine.js`

- [ ] **Step 1: Failing test ergänzen.** Hänge VOR die letzte `console.log`-Zeile an:

```javascript
// Default (alles normal) → alle Normaltexte, je mit '. ' getrennt, Punkt am Ende
const full = B.befundFliesstext(B.BEFUND_CATALOG, B.befundDefaultSelection(B.BEFUND_CATALOG));
assert.strictEqual(
  full,
  "Bewusstsein klar. allseits orientiert. Stimmung ausgeglichen, Antrieb unauffällig. " +
  "keine Hinweise auf akute Suizidalität, glaubhafte Absprachefähigkeit.",
  "Default-Fließtext = alle Normalbefunde, punktgetrennt"
);
// Eine Abweichung mischt sich ein
const sel = B.befundDefaultSelection(B.BEFUND_CATALOG);
sel.stimmung = { normal: false, itemIds: ["depressiv"] };
const mixed = B.befundFliesstext(B.BEFUND_CATALOG, sel);
assert.ok(mixed.includes("Stimmung niedergeschlagen."), "Abweichung im Fließtext enthalten");
assert.ok(mixed.includes("Bewusstsein klar."), "übrige Sektionen bleiben Normalbefund");

console.log("test_befund_engine TASK3 OK");
```

- [ ] **Step 2: Test fällt fehl.** Run: `node tests/test_befund_engine.js` → FAIL (`befundFliesstext is not a function`).

- [ ] **Step 3: `befundFliesstext` implementieren.** In `befund.js` VOR den `module.exports`-Block einfügen:

```javascript
function befundFliesstext(catalog, selection) {
  return catalog
    .map((section) => {
      const raw = befundSectionText(section, (selection || {})[section.id] || { normal: true, itemIds: [] });
      const trimmed = raw.trim();
      return trimmed.endsWith(".") ? trimmed : `${trimmed}.`;
    })
    .join(" ");
}
```
Export erweitern:
```javascript
  module.exports = { BEFUND_CATALOG, befundDefaultSelection, befundSectionText, befundFliesstext };
```

- [ ] **Step 4: Test grün.** Run: `node tests/test_befund_engine.js` → endet mit `test_befund_engine TASK3 OK`.

- [ ] **Step 5: Gesamte JS-Test-Suite (keine Regression).** Run: `for f in tests/*.js; do node "$f" || echo "FAIL: $f"; done` → keine `FAIL:`-Zeile.

- [ ] **Step 6: Commit.**
```bash
git add befund.js tests/test_befund_engine.js
git commit -m "feat(befund): Gesamt-Fließtext aus Sektionsauswahl

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

- **Spec-Abdeckung (Spec-Punkt 3 Teil-Engine):** AMDP-Sektionen + Normalbefund je Sektion → `BEFUND_CATALOG` (Task 1). Auswahl→Text inkl. „nicht erhebbar" und Abweichungen → `befundSectionText` (Task 2). Zusammensetzung zu Fließtext → `befundFliesstext` (Task 3). Normalbefund-pro-Sektion + globaler „Alles unauffällig" = `befundDefaultSelection` (Task 1, von der UI in 2b genutzt). KI-Vorbelegung, Tab-UI, Klickbedienung, Persistenz, Kopieren/Akte: bewusst NICHT in 2a (Folge-Pläne).
- **Platzhalter:** keine TODO/TBD; alle Code-/Testblöcke vollständig; Katalog-Starterinhalt real (Standard-AMDP), Vollkatalog-Abhängigkeit explizit dokumentiert.
- **Typ-/Namenskonsistenz:** `befundDefaultSelection`, `befundSectionText`, `befundFliesstext`, `BEFUND_CATALOG` in Tests und Implementierung identisch; Auswahl-Form `{normal, itemIds, nichtErhebbar?}` in allen Tasks gleich; Item-Form `{id,label,text}` durchgehend.
