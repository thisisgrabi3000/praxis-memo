# Stufe 1: Farbflächen-System & schlichte Patientenliste — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Patientenliste links auf „nur Kürzel, alphabetisch" vereinfachen und ein seitenweites, dezentes Farbflächen-System (Navyblau-Familie der App) einführen, damit die Seite übersichtlicher wirkt.

**Architecture:** Reine Frontend-Arbeit ohne Logik-/Serveränderung. (1) `renderPatients()` in `app.js` rendert eine flache, alphabetisch sortierte Liste; neue Sortier-Funktion `sortPatientsById` ist als Node-Test abgesichert. (2) Neue `:root`-Flächenvariablen in `styles.css` werden den Hauptbereichen als dezente Hintergründe zugewiesen; visuelle Prüfung im Browser.

**Tech Stack:** Vanilla JS (`app.js`), CSS (`styles.css`), Node-Tests (`node tests/<datei>.js`, kein Framework — `assert` + `tests/helpers/load-app.js`).

**Hinweis / offene Detailentscheidung:** Das vorhandene Suchfeld (`#patientSearch`) bleibt erhalten (nicht-destruktiv); nur die Listeneinträge zeigen ausschließlich das Kürzel. Falls Miriam das Suchfeld ganz weghaben will, ist das eine kleine Folgeänderung — vor Umsetzung kurz bestätigen lassen.

---

## File Structure

- `app.js` — `renderPatients()` (ca. Z. 581–637) umbauen; neue `sortPatientsById()` ergänzen; `sortByDateAndTime`/`groupPatientsByDate` werden in der Liste nicht mehr genutzt (bleiben vorerst stehen, da ggf. anderswo referenziert).
- `tests/test_patient_list_sort.js` — neuer Test für `sortPatientsById`.
- `styles.css` — neue `:root`-Variablen; Hintergründe an `.sidebar`, `.topbar`, `.step-panel`/`.panel`, `.summary-card` (+ 4 Tints), `.quick-prep`, `.book-day`.

---

## Task 1: Patientenliste — alphabetisch, nur Kürzel

**Files:**
- Test: `tests/test_patient_list_sort.js` (Create)
- Modify: `app.js` (neue Funktion + `renderPatients` Z. 581–637)

- [ ] **Step 1: Failing test schreiben**

Create `tests/test_patient_list_sort.js`:

```javascript
const assert = require("assert");
const { loadApp } = require("./helpers/load-app");

const app = loadApp();

const list = [{ id: "P-010" }, { id: "P-002" }, { id: "P-001" }, { id: "B-003" }];
const sorted = [...list].sort(app.sortPatientsById);

assert.deepStrictEqual(
  sorted.map((p) => p.id),
  ["B-003", "P-001", "P-002", "P-010"],
  "Patienten alphabetisch + numerisch nach Kürzel sortiert (P-2 vor P-10)"
);

console.log("test_patient_list_sort OK");
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `node tests/test_patient_list_sort.js`
Expected: FAIL — `TypeError`/„is not a function", weil `sortPatientsById` noch nicht existiert.

- [ ] **Step 3: `sortPatientsById` ergänzen**

In `app.js` direkt vor `function sortByDateAndTime(a, b) {` (Z. 653) einfügen:

```javascript
function sortPatientsById(a, b) {
  return (a.id || "").localeCompare(b.id || "", "de", { numeric: true, sensitivity: "base" });
}
```

- [ ] **Step 4: Test laufen lassen, Erfolg prüfen**

Run: `node tests/test_patient_list_sort.js`
Expected: `test_patient_list_sort OK`

- [ ] **Step 5: `renderPatients()` auf flache, schlichte Liste umbauen**

In `app.js` den Block Z. 581–637 ersetzen durch:

```javascript
function renderPatients() {
  const query = patientSearch.value.trim().toLowerCase();
  const visible = patients.filter((p) => patientMatchesQuery(p, query));
  const sorted = [...visible].sort(sortPatientsById);

  if (!sorted.length) {
    patientList.innerHTML = `
      <div class="empty-patients">
        <strong>${query ? "Keine Treffer" : "Noch keine Patienten"}</strong>
        <span>${query ? "Suche anpassen." : "Oben auf „Patient anlegen“ klicken."}</span>
      </div>`;
    return;
  }

  patientList.innerHTML = sorted
    .map((p) => {
      const active = p.uid === selectedUid ? " active" : "";
      const idMatched = query && p.id.toLowerCase().includes(query);
      const contentHit = !idMatched && query ? findContentMatch(p, query) : null;
      return `
      <button class="patient-button${active}" type="button" data-uid="${escapeHtml(p.uid)}" data-search-hit="${contentHit ? "1" : ""}">
        <strong>${escapeHtml(p.id)}</strong>
      </button>`;
    })
    .join("");

  patientList.querySelectorAll(".patient-button").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedUid = btn.dataset.uid;
      stopDictation(false);
      activeStep = btn.dataset.searchHit === "1" ? "prep" : "record";
      renderAll();
    });
  });
}
```

- [ ] **Step 6: Bestehende JS-Tests laufen lassen (keine Regression)**

Run: `for f in tests/*.js; do node "$f" || echo "FAIL: $f"; done`
Expected: alle laufen ohne `FAIL:`-Zeile durch (insb. `test_frontend_workflow_smoke.js`, `test_patient_list_sort.js`).

- [ ] **Step 7: Visuelle Prüfung im Browser**

Server lokal starten (`~/praxismemo-whisper-venv/bin/python praxis_memo_server.py --port 3000 --no-browser`), `http://127.0.0.1:3000/` öffnen, 2–3 Test-Patienten anlegen. Erwartung: linke Liste zeigt nur Kürzel, alphabetisch sortiert, kein Datum/keine Tagesgruppen; Klick öffnet den Patienten. Server danach stoppen.

- [ ] **Step 8: Commit**

```bash
git add app.js tests/test_patient_list_sort.js
git commit -m "feat: Patientenliste schlicht alphabetisch nach Kürzel, ohne Datum

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Farbflächen-System (CSS, ganze Seite)

CSS lässt sich nicht sinnvoll unit-testen → Verifikation visuell im Browser + Kontrast-Check. Keine Logikänderung.

**Files:**
- Modify: `styles.css` (`:root` Z. 1–30; Selektoren `.sidebar` Z.142, `.topbar`, `.step-panel` Z.827, `.panel` Z.836/958, `.summary-card` Z.1148, `.summary-card.priority` Z.1157, `.quick-prep` Z.754, `.book-day` Z.1464)

- [ ] **Step 1: Flächenvariablen im `:root` ergänzen**

In `styles.css` innerhalb des `:root`-Blocks (nach Z. 20, vor `--radius`) einfügen — dezente, blau-stämmige Tints aus der bestehenden Palette:

```css
  /* Seitenweite Flächen-Töne, abgeleitet aus dem Navyblau (--forest) + gedämpften Akzenten */
  --surface-sidebar: #eef3f7;
  --surface-topbar: #e7eef4;
  --surface-panel: #f6f9fb;
  --surface-prep: #eaf1f6;
  --surface-book: #edf2f6;
  --surface-core: #eef2f6;       /* Kernpunkte – neutral blaugrau */
  --surface-agreement: #e9f2ec;  /* Absprachen – zartgrün */
  --surface-open: #f5f0e4;       /* Offene Punkte – zartamber */
  --surface-watch: #f4ecec;      /* Beobachtungsfokus – warm/rosa */
```

- [ ] **Step 2: Hauptbereiche einfärben**

Jeweils im bestehenden Regel-Body die `background`-Eigenschaft setzen/ergänzen (vorhandene `background`-Zeile ersetzen, sonst neu hinzufügen):

- `.sidebar` (Z.142): `background: var(--surface-sidebar);`
- `.topbar` : `background: var(--surface-topbar);`
- `.step-panel` (Z.827) **oder** `.panel` (Z.836): `background: var(--surface-panel);`
- `.quick-prep` (Z.754): `background: var(--surface-prep);`
- `.book-day` (Z.1464): `background: var(--surface-book);`

- [ ] **Step 3: Die vier Prüfen-Felder je eigener Ton**

`.summary-card` (Z.1148) generischen Hintergrund auf `--surface-core` setzen, dann pro Feld über das `data-summary`-Attribut differenzieren. Direkt nach der `.summary-card`-Regel einfügen:

```css
.summary-card { background: var(--surface-core); }
.summary-card:has(textarea[data-summary="agreement"]) { background: var(--surface-agreement); }
.summary-card:has(textarea[data-summary="open"]) { background: var(--surface-open); }
.summary-card:has(textarea[data-summary="watch"]) { background: var(--surface-watch); }
```

(`:has()` wird von Chrome/Chromium — dem Zielbrowser laut Test-Ablauf — unterstützt.)

- [ ] **Step 4: Visuelle Prüfung im Browser**

Server starten, `http://127.0.0.1:3000/` in Chrome öffnen. Erwartung: Sidebar, Patientenkopf, Workflow-Panels, Schnellblick, Verlaufsbuch und die vier Prüfen-Felder heben sich durch dezente, blau-stämmige Flächen voneinander ab; Text/Eingaben bleiben gut lesbar (Kontrast). Optik wirkt ruhig, nicht bunt. Server stoppen.

- [ ] **Step 5: Commit**

```bash
git add styles.css
git commit -m "feat: seitenweites Farbflächen-System in der App-Blau-Familie

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

- **Spec-Abdeckung:** Spec-Punkt 1 (Farbflächen-System, ganze Seite, App-Blau) → Task 2. Spec-Punkt 2 (Patientenliste nur Kürzel, alphabetisch, ohne Datum) → Task 1. Punkt 3 (Befund) ist bewusst nicht Teil von Stufe 1 (eigener Plan).
- **Platzhalter:** keine TODO/TBD; alle Code- und CSS-Blöcke vollständig.
- **Typ-/Namenskonsistenz:** `sortPatientsById` in Test (Task 1 Step 1) und Definition (Step 3) identisch; CSS-Variablennamen in Step 1 und Steps 2–3 identisch (`--surface-*`).
