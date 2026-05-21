# Verlaufsbuch & abhakbare offene Punkte — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein chronologisches, datiertes Verlaufsbuch plus eine „Noch offen"-Liste, in der offene Punkte manuell ergänzt, jederzeit datiert abgehakt und per KI-Vorschlag (mit Pflicht-Bestätigung) als erledigt markiert werden können.

**Architecture:** Reine Frontend-Erweiterung in `app.js`/`index.html`/`styles.css` plus ein zusätzliches JSON-Feld in der Server-Strukturierung. Das Buch wird deterministisch aus vorhandenen Zeitstempeln (Sitzungen + Register-Einträge) abgeleitet, nicht zusätzlich gespeichert. Register-Einträge bekommen `resolvedAt`, `resolvedSessionId`, `origin`. Abhaken ist append-only (überschreibt nichts, löscht nichts).

**Tech Stack:** Vanilla JS (kein Build), Node-`vm`-Tests (wie `tests/test_patient_export.js`), Python-stdlib-Server, Ollama `qwen2.5:3b`.

**Spec:** `docs/superpowers/specs/2026-05-21-verlaufsbuch-design.md`

**Wichtig (Lesson Learned):** Verifikation NIE über die laufende App mit echten `data/`-Beständen, weil `savePatients()` → `queueServerSave()` Testdaten in `data/praxismemo-data.json` schreibt. Logik per Node-`vm`-Test; UI-Smoketest nur auf einer Wegwerf-Instanz mit leerem Datenordner.

---

### Task 1: Geteilter Test-Loader + Datenmodell-Felder

**Files:**
- Create: `tests/helpers/load-app.js`
- Modify: `app.js` (`normalizeMemoryItem`, aktuell Zeile 27–37)
- Test: `tests/test_memory_model.js`

- [ ] **Step 1: Geteilten Loader anlegen** (DRY — kapselt den DOM/Window-Stub, den `test_patient_export.js`/`test_followup_reminder.js` heute inline haben)

Create `tests/helpers/load-app.js`:

```js
const fs = require("fs");
const vm = require("vm");

// Lädt app.js in einen vm-Context; alle Top-Level-Funktionen liegen danach auf dem Rückgabe-Objekt.
function loadApp() {
  class StubElement {
    constructor() {
      this.dataset = {}; this.disabled = false; this.innerHTML = "";
      this.textContent = ""; this.value = "";
      this.classList = { add() {}, remove() {}, toggle() {} };
    }
    addEventListener() {} appendChild(c) { return c; } click() {}
    closest() { return null; } focus() {} querySelector() { return null; }
    querySelectorAll() { return []; } remove() {} setAttribute() {}
  }
  const documentStub = {
    body: new StubElement(), addEventListener() {},
    createElement() { return new StubElement(); },
    querySelector() { return new StubElement(); }, querySelectorAll() { return []; }
  };
  const storage = new Map();
  const context = {
    AbortSignal: { timeout: () => ({}) },
    Blob: class {},
    MediaRecorder: class { static isTypeSupported() { return false; } },
    URL: { createObjectURL: () => "blob:test", revokeObjectURL() {} },
    console, document: documentStub,
    fetch: async () => ({ ok: false, json: async () => ({}) }),
    localStorage: { getItem: (k) => storage.get(k) || null, setItem: (k, v) => storage.set(k, v) },
    navigator: { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [] }) } },
    window: { confirm: () => true, location: { protocol: "file:" }, open: () => null,
              setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
              crypto: { randomUUID: () => "test-uuid-" + Math.random().toString(16).slice(2) } }
  };
  context.window.document = documentStub;
  context.window.localStorage = context.localStorage;
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync("app.js", "utf8"), context, { filename: "app.js" });
  return context;
}

module.exports = { loadApp };
```

- [ ] **Step 2: Failing test für die neuen Felder schreiben**

Create `tests/test_memory_model.js`:

```js
const assert = require("assert");
const { loadApp } = require("./helpers/load-app");
const app = loadApp();

// normalizeMemoryItem migriert Altbestand defaultsicher und kennt die neuen Felder.
const old = app.normalizeMemoryItem({ text: "Schlaf klären", status: "offen" });
assert.strictEqual(old.resolvedAt, "", "resolvedAt default leer");
assert.strictEqual(old.resolvedSessionId, "", "resolvedSessionId default leer");
assert.strictEqual(old.origin, "ki", "origin default ki");

const manual = app.normalizeMemoryItem({ text: "X", origin: "manuell", resolvedAt: "2026-05-21T10:00:00Z", resolvedSessionId: "s-9" });
assert.strictEqual(manual.origin, "manuell");
assert.strictEqual(manual.resolvedAt, "2026-05-21T10:00:00Z");
assert.strictEqual(manual.resolvedSessionId, "s-9");

console.log("RESULT: ALL OK");
```

- [ ] **Step 3: Test ausführen, Fehlschlag bestätigen**

Run: `node tests/test_memory_model.js`
Expected: FAIL (`resolvedAt` ist `undefined`).

- [ ] **Step 4: `normalizeMemoryItem` erweitern**

In `app.js` die Funktion (Zeile 27–37) ersetzen durch:

```js
function normalizeMemoryItem(raw) {
  return {
    id: raw.id || makeId("mem"),
    text: raw.text || "",
    status: raw.status || "offen",
    origin: raw.origin === "manuell" ? "manuell" : "ki",
    sourceSessionId: raw.sourceSessionId || "",
    sourceDate: raw.sourceDate || "",
    resolvedAt: raw.resolvedAt || "",
    resolvedSessionId: raw.resolvedSessionId || "",
    createdAt: raw.createdAt || new Date().toISOString(),
    lastSeenAt: raw.lastSeenAt || raw.createdAt || new Date().toISOString()
  };
}
```

- [ ] **Step 5: Test ausführen, grün bestätigen**

Run: `node tests/test_memory_model.js`
Expected: `RESULT: ALL OK`

- [ ] **Step 6: Regressionslauf**

Run: `node tests/test_patient_export.js && node tests/test_followup_reminder.js && node --check app.js`
Expected: beide `RESULT: ALL OK`, `app.js` ohne Syntaxfehler.

- [ ] **Step 7: Commit**

```bash
git add app.js tests/helpers/load-app.js tests/test_memory_model.js
git commit -m "feat: Register-Eintrag um resolvedAt/resolvedSessionId/origin erweitern"
```

---

### Task 2: Abhaken (resolveMemoryItem) — append-only

**Files:**
- Modify: `app.js` (neue Funktion nahe `upsertMemoryItem`, aktuell ~Zeile 909–933)
- Test: `tests/test_memory_resolve.js`

- [ ] **Step 1: Failing test**

Create `tests/test_memory_resolve.js`:

```js
const assert = require("assert");
const { loadApp } = require("./helpers/load-app");
const app = loadApp();

const patient = app.normalizePatient({
  id: "P-1",
  memory: { openQuestions: [{ id: "m1", text: "Schlaf klären", status: "offen" }] }
});

// Abhaken: setzt status + resolvedAt, löscht/überschreibt nichts anderes.
const ok = app.resolveMemoryItem(patient, "m1", { sessionId: "s-2" });
assert.strictEqual(ok, true, "Treffer => true");
const item = patient.memory.openQuestions[0];
assert.strictEqual(item.status, "erledigt");
assert.ok(item.resolvedAt, "resolvedAt gesetzt");
assert.strictEqual(item.resolvedSessionId, "s-2");
assert.strictEqual(item.text, "Schlaf klären", "Text unverändert");

// Unbekannte id => false, keine Mutation.
assert.strictEqual(app.resolveMemoryItem(patient, "nope"), false);

console.log("RESULT: ALL OK");
```

- [ ] **Step 2: Test ausführen, Fehlschlag bestätigen**

Run: `node tests/test_memory_resolve.js`
Expected: FAIL (`resolveMemoryItem is not a function`).

- [ ] **Step 3: `resolveMemoryItem` implementieren**

In `app.js` direkt nach `upsertMemoryItem` (nach Zeile 933) einfügen:

```js
const MEMORY_BUCKETS = ["risks", "sensitiveTopics", "protectiveFactors", "openQuestions", "agreements"];

function findMemoryItem(patient, itemId) {
  for (const bucket of MEMORY_BUCKETS) {
    const item = (patient.memory?.[bucket] || []).find((entry) => entry.id === itemId);
    if (item) return item;
  }
  return null;
}

function resolveMemoryItem(patient, itemId, { sessionId = "" } = {}) {
  const item = findMemoryItem(patient, itemId);
  if (!item || item.status === "erledigt") return false;
  // Append-only: nur Resolved-Felder ergänzen, Text/Quelle bleiben unangetastet.
  item.status = "erledigt";
  item.resolvedAt = new Date().toISOString();
  item.resolvedSessionId = sessionId || patient.currentSessionId || "";
  return true;
}
```

- [ ] **Step 4: Test ausführen, grün bestätigen**

Run: `node tests/test_memory_resolve.js`
Expected: `RESULT: ALL OK`

- [ ] **Step 5: Commit**

```bash
git add app.js tests/test_memory_resolve.js
git commit -m "feat: resolveMemoryItem hakt offene Punkte append-only mit Datum ab"
```

---

### Task 3: Manuelles Hinzufügen offener Punkte

**Files:**
- Modify: `app.js` (neue Funktion nach `resolveMemoryItem`)
- Test: `tests/test_memory_add.js`

- [ ] **Step 1: Failing test**

Create `tests/test_memory_add.js`:

```js
const assert = require("assert");
const { loadApp } = require("./helpers/load-app");
const app = loadApp();

const patient = app.normalizePatient({ id: "P-1" });

const item = app.addOpenPoint(patient, "  Medikamente mit Hausarzt klären  ");
assert.ok(item, "Eintrag zurückgegeben");
assert.strictEqual(item.origin, "manuell");
assert.strictEqual(item.status, "offen");
assert.strictEqual(item.text, "Medikamente mit Hausarzt klären", "getrimmt");
assert.ok(item.sourceDate, "Datum gesetzt");
assert.strictEqual(patient.memory.openQuestions[0].id, item.id, "in openQuestions abgelegt");

// Leerer Text => kein Eintrag.
assert.strictEqual(app.addOpenPoint(patient, "   "), null);
assert.strictEqual(patient.memory.openQuestions.length, 1);

console.log("RESULT: ALL OK");
```

- [ ] **Step 2: Test ausführen, Fehlschlag bestätigen**

Run: `node tests/test_memory_add.js`
Expected: FAIL (`addOpenPoint is not a function`).

- [ ] **Step 3: `addOpenPoint` implementieren**

In `app.js` nach `resolveMemoryItem` einfügen:

```js
function addOpenPoint(patient, rawText) {
  const text = normalizeMemoryText(rawText);
  if (!text) return null;
  patient.memory = createMemoryState(patient.memory || {});
  const now = new Date().toISOString();
  const item = {
    id: makeId("mem"),
    text,
    status: "offen",
    origin: "manuell",
    sourceSessionId: "",
    sourceDate: todayIso(),
    resolvedAt: "",
    resolvedSessionId: "",
    createdAt: now,
    lastSeenAt: now
  };
  patient.memory.openQuestions.unshift(item);
  patient.memory.openQuestions = patient.memory.openQuestions.slice(0, 30);
  return item;
}
```

- [ ] **Step 4: Test ausführen, grün bestätigen**

Run: `node tests/test_memory_add.js`
Expected: `RESULT: ALL OK`

- [ ] **Step 5: Commit**

```bash
git add app.js tests/test_memory_add.js
git commit -m "feat: addOpenPoint legt manuelle offene Punkte mit Datum an"
```

---

### Task 4: Buch-Ableitung (buildHistoryBook)

**Files:**
- Modify: `app.js` (neue Funktion nahe `renderMemoryBlock`, ~Zeile 980)
- Test: `tests/test_history_book.js`

- [ ] **Step 1: Failing test**

Create `tests/test_history_book.js`:

```js
const assert = require("assert");
const { loadApp } = require("./helpers/load-app");
const app = loadApp();

const patient = app.normalizePatient({
  id: "P-1",
  sessions: [
    { id: "s1", date: "2026-05-14", status: "Geprüft", summary: { core: "Erste Sitzung" } },
    { id: "s2", date: "2026-05-21", status: "Geprüft", summary: { core: "Folgesitzung" } }
  ],
  memory: {
    openQuestions: [
      { id: "m1", text: "Schlaf klären", status: "erledigt", origin: "ki", sourceDate: "2026-05-14", resolvedAt: "2026-05-21T09:00:00Z" },
      { id: "m2", text: "Medikamente", status: "offen", origin: "manuell", sourceDate: "2026-05-18" }
    ]
  }
});

const book = app.buildHistoryBook(patient);
// Erwartete chronologische Reihenfolge der Ereignis-Daten:
const dates = book.map((e) => e.date);
assert.deepStrictEqual(dates, ["2026-05-14", "2026-05-18", "2026-05-21", "2026-05-21"],
  "chronologisch sortiert");

// Ereignistypen vorhanden
const types = book.map((e) => e.type);
assert.ok(types.includes("session"), "session-Ereignisse");
assert.ok(types.includes("added"), "manuell-ergänzt-Ereignis (m2 am 18.05.)");
assert.ok(types.includes("resolved"), "abgehakt-Ereignis (m1 am 21.05.)");

console.log("RESULT: ALL OK");
```

- [ ] **Step 2: Test ausführen, Fehlschlag bestätigen**

Run: `node tests/test_history_book.js`
Expected: FAIL (`buildHistoryBook is not a function`).

- [ ] **Step 3: `buildHistoryBook` implementieren**

In `app.js` vor `renderMemoryBlock` (vor Zeile 980) einfügen:

```js
// Leitet das Verlaufsbuch deterministisch aus Sitzungen + Register-Zeitstempeln ab.
// Gibt nach Datum aufsteigend sortierte Ereignisse zurück (kein eigener Speicher).
function buildHistoryBook(patient) {
  const events = [];
  for (const s of patient.sessions || []) {
    events.push({ type: "session", date: s.date || "", session: s, sortKey: 0 });
  }
  for (const bucket of MEMORY_BUCKETS) {
    for (const item of patient.memory?.[bucket] || []) {
      if (item.origin === "manuell" && item.sourceDate) {
        events.push({ type: "added", date: item.sourceDate, bucket, item, sortKey: 1 });
      }
      if (item.status === "erledigt" && item.resolvedAt) {
        events.push({ type: "resolved", date: item.resolvedAt.slice(0, 10), bucket, item, sortKey: 2 });
      }
    }
  }
  // Datum aufsteigend; am selben Tag: Sitzung (0) vor Ergänzung (1) vor Abhaken (2).
  return events.sort((a, b) =>
    (a.date || "").localeCompare(b.date || "") || a.sortKey - b.sortKey);
}
```

- [ ] **Step 4: Test ausführen, grün bestätigen**

Run: `node tests/test_history_book.js`
Expected: `RESULT: ALL OK`

- [ ] **Step 5: Commit**

```bash
git add app.js tests/test_history_book.js
git commit -m "feat: buildHistoryBook leitet datiertes Verlaufsbuch aus Sitzungen+Register ab"
```

---

### Task 5: KI-Vorschlag-Abgleich (matchResolvedSuggestions)

**Files:**
- Modify: `app.js` (neue Funktion nach `addOpenPoint`)
- Test: `tests/test_resolve_suggestions.js`

- [ ] **Step 1: Failing test**

Create `tests/test_resolve_suggestions.js`:

```js
const assert = require("assert");
const { loadApp } = require("./helpers/load-app");
const app = loadApp();

const patient = app.normalizePatient({
  id: "P-1",
  memory: { openQuestions: [
    { id: "m1", text: "Schlafprobleme klären", status: "offen" },
    { id: "m2", text: "Rückkehr Arbeitsplatz", status: "offen" }
  ] }
});

// KI nennt einen offenen Punkt als erledigt-scheinend (case/whitespace-tolerant).
const ids = app.matchResolvedSuggestions(patient, ["  schlafprobleme KLÄREN ", "unbekannter punkt"]);
assert.deepStrictEqual(ids, ["m1"], "nur exakt-normalisierter Treffer, kein Fremdtext");

// Niemals Statuswechsel allein durch Vorschlag.
assert.strictEqual(patient.memory.openQuestions[0].status, "offen", "kein Auto-Abhaken");

// Robust bei fehlendem/leerem Eingang.
assert.deepStrictEqual(app.matchResolvedSuggestions(patient, undefined), []);
assert.deepStrictEqual(app.matchResolvedSuggestions(patient, []), []);

console.log("RESULT: ALL OK");
```

- [ ] **Step 2: Test ausführen, Fehlschlag bestätigen**

Run: `node tests/test_resolve_suggestions.js`
Expected: FAIL (`matchResolvedSuggestions is not a function`).

- [ ] **Step 3: `matchResolvedSuggestions` implementieren**

In `app.js` nach `addOpenPoint` einfügen:

```js
// Gleicht die KI-Vorschläge (resolved-Texte) gegen offene Register-Einträge ab.
// Reiner Abgleich: gibt nur Treffer-IDs zurück, ändert NICHTS (Bestätigung erfolgt separat).
function matchResolvedSuggestions(patient, resolvedTexts) {
  if (!Array.isArray(resolvedTexts) || !resolvedTexts.length) return [];
  const wanted = new Set(resolvedTexts.map((t) => normalizeMemoryText(t).toLowerCase()).filter(Boolean));
  const ids = [];
  for (const bucket of MEMORY_BUCKETS) {
    for (const item of patient.memory?.[bucket] || []) {
      if (item.status !== "erledigt" && wanted.has(normalizeMemoryText(item.text).toLowerCase())) {
        ids.push(item.id);
      }
    }
  }
  return ids;
}
```

- [ ] **Step 4: Test ausführen, grün bestätigen**

Run: `node tests/test_resolve_suggestions.js`
Expected: `RESULT: ALL OK`

- [ ] **Step 5: Vorschläge nach dem Strukturieren erfassen (kein Auto-Apply)**

In `app.js`, in `structureTranscript`, direkt nach `applyStructuredResult(target, parsed, …)` (aktuell ~Zeile 69 innerhalb der Funktion) ergänzen:

```js
    // KI-Vorschlag „scheint erledigt": nur als Vorschlag merken, niemals automatisch anwenden.
    target.resolvedSuggestions = matchResolvedSuggestions(target, parsed.resolved);
```

Und in `app.js` in `createEmptyPatient` (Objekt ab Zeile 41) sowie `normalizePatient` (Objekt ab Zeile 86) das Feld defaultsicher ergänzen — in beiden Objekt-Literalen die Zeile hinzufügen:

```js
    resolvedSuggestions: Array.isArray(raw?.resolvedSuggestions) ? raw.resolvedSuggestions : [],
```

(Hinweis: In `createEmptyPatient` ohne `raw` schlicht `resolvedSuggestions: [],` setzen.)

- [ ] **Step 6: Regressionslauf**

Run: `node --check app.js && node tests/test_resolve_suggestions.js && node tests/test_patient_export.js`
Expected: kein Syntaxfehler, beide `RESULT: ALL OK`.

- [ ] **Step 7: Commit**

```bash
git add app.js tests/test_resolve_suggestions.js
git commit -m "feat: KI-Vorschlaege fuer erledigte Punkte abgleichen (nur Vorschlag, kein Auto-Apply)"
```

---

### Task 6: Server — `resolved`-Feld in der Strukturierung

**Files:**
- Modify: `praxis_memo_server.py` (Prompt-JSON, ~Zeile 202–208)
- Test: manuell (Modellabhängig; kein Unit-Test)

- [ ] **Step 1: Prompt um `resolved` erweitern**

In `praxis_memo_server.py` das JSON-Schema im `user_prompt` (die vier Zeilen `"core"…"watch"`) so ändern, dass nach `watch` ergänzt wird (Komma hinter der `watch`-Zeile nicht vergessen):

```python
        '  "watch": "Beobachtungsfokus für den nächsten Termin — mögliche Warnsignale, Ressourcen, offene Klärungen",\n'
        '  "resolved": ["Wörtlicher Text bereits offener Punkte aus dem mitgelieferten Kontext, die in dieser Nachnotiz erkennbar erledigt/behandelt wurden — leere Liste, wenn keiner"]\n'
```

Und einen Satz in den `WICHTIG`-Block (vor dem JSON) einfügen:

```python
        "WICHTIG: In 'resolved' NUR Punkte aufnehmen, die wörtlich aus den bereits offenen "
        "Punkten im Kontext stammen und in dieser Nachnotiz klar behandelt wurden. Im Zweifel "
        "leer lassen — niemals neue Punkte erfinden.\n"
```

- [ ] **Step 2: Durchlässigkeit prüfen**

`_extract_json` strippt CJK nur auf String-Werten — Arrays passieren unverändert; `_validate_patient_ids` betrachtet nur `core/agreement/open/watch`. `resolved` wird also unverändert in `data.result` durchgereicht. Keine weitere Server-Änderung nötig.

- [ ] **Step 3: Syntax + Smoke**

Run: `python3 -m py_compile praxis_memo_server.py`
Expected: kein Fehler.

Optionaler Modell-Smoke (nur wenn Ollama läuft, gegen Wegwerf-Instanz/leere Daten): einmal strukturieren und prüfen, dass die Antwort ein `resolved`-Array enthält (darf leer sein).

- [ ] **Step 4: Commit**

```bash
git add praxis_memo_server.py
git commit -m "feat: Strukturierung liefert resolved-Vorschlaege fuer erledigte offene Punkte"
```

---

### Task 7: UI — Verlaufsbuch + „Noch offen"-Liste im prep-Schritt

**Files:**
- Modify: `index.html` (prep-Panel, ~Zeile 273–301)
- Modify: `app.js` (Render-Funktionen + Eventhandler; Einhängen in `renderAll`)
- Modify: `styles.css` (Zwei-Spalten-Layout, Checkbox/Datum, Vorschlags-Hinweis)
- Test: UI-Smoketest auf Wegwerf-Instanz (siehe Task 8)

- [ ] **Step 1: HTML-Container ergänzen**

In `index.html` im `#prepPanel` die bestehende `history-panel`-`article` ERSETZEN durch zwei Bereiche (Buch + Noch offen). Innerhalb von `<div class="prep-grid">` nach der `prep-focus`-`article`:

```html
            <article class="panel history-panel">
              <div class="panel-head">
                <div>
                  <p class="eyebrow">Archiv</p>
                  <h3>Verlaufsbuch</h3>
                </div>
                <span class="status-badge" id="sessionCountBadge">0 Einträge</span>
              </div>
              <div class="history-book" id="historyBook" aria-label="Chronologisches Verlaufsbuch"></div>
            </article>

            <article class="panel open-points-panel">
              <div class="panel-head">
                <div>
                  <p class="eyebrow">Aktuell</p>
                  <h3>Noch offen</h3>
                </div>
                <span class="status-badge" id="openCountBadge">0 offen</span>
              </div>
              <div class="open-points" id="openPoints" aria-label="Offene Punkte"></div>
              <form class="open-add" id="openAddForm">
                <input type="text" id="openAddInput" placeholder="Neuen offenen Punkt eintragen …" aria-label="Neuen offenen Punkt eintragen" />
                <button type="submit" class="soft-action">+ Hinzufügen</button>
              </form>
            </article>
```

Die alte `session-timeline`/`#sessionHistory` bleibt vorerst durch `#historyBook` ersetzt — `renderSessionHistory` wird in Step 4 durch `renderHistoryBook` abgelöst.

- [ ] **Step 2: DOM-Refs ergänzen**

In `app.js` bei den DOM-Refs (nahe `const sessionHistory = …`, ~Zeile 358) ergänzen:

```js
const historyBook = document.querySelector("#historyBook");
const openPoints = document.querySelector("#openPoints");
const openCountBadge = document.querySelector("#openCountBadge");
const openAddForm = document.querySelector("#openAddForm");
const openAddInput = document.querySelector("#openAddInput");
```

- [ ] **Step 3: Render-Funktionen schreiben**

In `app.js` nahe `renderSessionHistory` einfügen:

```js
function renderHistoryBook(patient) {
  if (!historyBook) return;
  const events = buildHistoryBook(patient);
  if (sessionCountBadge) {
    const sessions = (patient.sessions || []).length;
    sessionCountBadge.textContent = `${sessions} ${sessions === 1 ? "Eintrag" : "Einträge"}`;
  }
  if (!events.length) {
    historyBook.innerHTML = `<p class="empty-history"><strong>Noch kein Verlauf</strong><span>Nach der ersten geprüften Sitzung entsteht hier das Buch.</span></p>`;
    return;
  }
  historyBook.innerHTML = events.map((e) => {
    const date = `<span class="book-date">${escapeHtml(formatDateShort(e.date))}</span>`;
    if (e.type === "session") {
      const s = e.session;
      return `<div class="book-entry book-session">${date}
        <strong>${escapeHtml(s.status === "Geprüft" ? "Sitzung" : (s.status || "Sitzung"))}${s.focus ? ` · ${escapeHtml(clip(s.focus, 60))}` : ""}</strong>
        <p>${escapeHtml(clip(s.summary?.core || s.summary?.agreement || "", 160))}</p></div>`;
    }
    if (e.type === "added") {
      return `<div class="book-entry book-added">${date}<p>➕ Offener Punkt ergänzt: „${escapeHtml(e.item.text)}"</p></div>`;
    }
    return `<div class="book-entry book-resolved">${date}<p>✓ Abgehakt: <span class="done-txt">${escapeHtml(e.item.text)}</span></p></div>`;
  }).join("");
}

function renderOpenPoints(patient) {
  if (!openPoints) return;
  const suggestions = new Set(Array.isArray(patient.resolvedSuggestions) ? patient.resolvedSuggestions : []);
  const open = [];
  const done = [];
  for (const bucket of MEMORY_BUCKETS) {
    for (const item of patient.memory?.[bucket] || []) {
      if (!item.text) continue;
      (item.status === "erledigt" ? done : open).push({ item, bucket });
    }
  }
  if (openCountBadge) openCountBadge.textContent = `${open.length} offen`;
  const originLabel = (item) => item.origin === "manuell"
    ? `<span class="src self">selbst ${escapeHtml(formatDateShort(item.sourceDate))}</span>`
    : `<span class="src">aus Sitzung ${escapeHtml(formatDateShort(item.sourceDate))}</span>`;
  const openHtml = open.map(({ item }) => {
    const suggest = suggestions.has(item.id)
      ? `<div class="resolve-suggest" data-suggest="${item.id}">Scheint erledigt — stimmt das?
           <button type="button" class="mini-yes" data-resolve="${item.id}">Ja, abhaken</button>
           <button type="button" class="mini-no" data-dismiss="${item.id}">Nein</button></div>`
      : "";
    return `<div class="open-item${suggestions.has(item.id) ? " has-suggest" : ""}">
        <button type="button" class="check-box" data-resolve="${item.id}" aria-label="Abhaken"></button>
        <span class="open-text">${escapeHtml(item.text)} ${originLabel(item)}</span>
      </div>${suggest}`;
  }).join("");
  const doneHtml = done.length
    ? `<details class="done-fold"><summary>${done.length} erledigt</summary>${done.map(({ item }) =>
        `<div class="open-item done"><span class="check-box done"></span>
         <span class="open-text done-txt">${escapeHtml(item.text)}</span>
         <span class="meta">✓ ${escapeHtml(formatDateShort((item.resolvedAt || "").slice(0, 10)))}</span></div>`).join("")}</details>`
    : "";
  openPoints.innerHTML = (openHtml || `<p class="empty-history"><span>Keine offenen Punkte.</span></p>`) + doneHtml;
}
```

- [ ] **Step 4: In `renderAll` einhängen + alten Aufruf ersetzen**

In `app.js` in `renderAll` die Zeile `renderSessionHistory(patient);` ersetzen durch:

```js
  renderHistoryBook(patient);
  renderOpenPoints(patient);
```

In `renderEmptyState` nach `if (sessionHistory) sessionHistory.innerHTML = "";` ergänzen:

```js
  if (historyBook) historyBook.innerHTML = "";
  if (openPoints) openPoints.innerHTML = "";
  if (openCountBadge) openCountBadge.textContent = "0 offen";
```

- [ ] **Step 5: Eventhandler (Abhaken / Hinzufügen / Vorschlag bestätigen)**

In `app.js` im Event-Wiring-Block (nahe den anderen `addEventListener`, ~Zeile 2010) ergänzen:

```js
openPoints?.addEventListener("click", (event) => {
  const patient = getPatient();
  if (!patient) return;
  const resolveId = event.target.closest("[data-resolve]")?.dataset.resolve;
  if (resolveId) {
    if (resolveMemoryItem(patient, resolveId)) {
      patient.resolvedSuggestions = (patient.resolvedSuggestions || []).filter((id) => id !== resolveId);
      savePatients();
      renderAll();
      showToast("Punkt abgehakt.");
    }
    return;
  }
  const dismissId = event.target.closest("[data-dismiss]")?.dataset.dismiss;
  if (dismissId) {
    patient.resolvedSuggestions = (patient.resolvedSuggestions || []).filter((id) => id !== dismissId);
    savePatients();
    renderAll();
  }
});

openAddForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const patient = getPatient();
  if (!patient) return;
  if (addOpenPoint(patient, openAddInput.value)) {
    openAddInput.value = "";
    savePatients();
    renderAll();
    showToast("Offener Punkt ergänzt.");
  }
});
```

- [ ] **Step 6: CSS ergänzen**

In `styles.css` am Ende ergänzen:

```css
.history-book { display: grid; gap: 8px; }
.book-entry { display: grid; gap: 2px; padding: 8px 10px; border: 1px solid var(--line); border-radius: var(--radius); background: rgba(246, 249, 251, 0.72); }
.book-entry p { margin: 0; color: var(--stone); font-size: var(--text-body); line-height: 1.4; }
.book-date { font-weight: 740; color: var(--moss); font-size: var(--text-label); }
.book-session { border-left: 3px solid var(--forest); }
.book-resolved { border-left: 3px solid #2e7d52; }
.book-added { border-left: 3px solid var(--moss); }
.done-txt { color: var(--stone); text-decoration: line-through; }

.open-points { display: grid; gap: 6px; }
.open-item { display: flex; align-items: baseline; gap: 8px; padding: 6px 8px; border-radius: var(--radius); }
.open-item.has-suggest { background: rgba(255, 249, 235, 0.7); }
.check-box { width: 16px; height: 16px; flex: 0 0 auto; border: 1.5px solid var(--moss); border-radius: 4px; background: #fff; cursor: pointer; padding: 0; }
.check-box.done { background: #2e7d52; border-color: #2e7d52; }
.open-text { font-size: var(--text-body); color: var(--forest); overflow-wrap: anywhere; }
.src { font-size: var(--text-small); color: #8a6a37; background: rgba(255, 243, 218, 0.9); border-radius: 99px; padding: 1px 7px; margin-left: 4px; }
.src.self { color: #2f5d8a; background: rgba(228, 238, 248, 0.9); }
.resolve-suggest { margin: 2px 0 8px 24px; font-size: var(--text-small); color: #7a5a12; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.resolve-suggest .mini-yes, .resolve-suggest .mini-no { border: 1px solid var(--line-strong); border-radius: 6px; padding: 2px 8px; cursor: pointer; background: #fff; font-size: var(--text-small); }
.resolve-suggest .mini-yes { background: #2e7d52; color: #fff; border-color: #2e7d52; }
.open-add { display: flex; gap: 6px; margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--line); }
.open-add input { flex: 1; }
.done-fold { margin-top: 10px; }
.done-fold summary { cursor: pointer; color: var(--moss); font-size: var(--text-label); font-weight: 700; }
.done-fold .meta { color: var(--stone); font-size: var(--text-small); margin-left: auto; }
```

- [ ] **Step 7: Syntax-Check**

Run: `node --check app.js`
Expected: kein Fehler.

- [ ] **Step 8: Commit**

```bash
git add app.js index.html styles.css
git commit -m "feat: Verlaufsbuch + Noch-offen-Liste mit Abhaken/Hinzufuegen im Anknuepfen-Schritt"
```

---

### Task 8: Integrationsverifikation + Doku

**Files:**
- Verify: alle Tests + UI-Smoketest
- Modify: `docs/HANDOVER.md`, neue `docs/release-notes-v1.0.8.md` (analog v1.0.7)

- [ ] **Step 1: Komplette Testsuite (Logik)**

Run:
```bash
node --check app.js && \
for t in tests/test_memory_model.js tests/test_memory_resolve.js tests/test_memory_add.js tests/test_history_book.js tests/test_resolve_suggestions.js tests/test_followup_reminder.js tests/test_patient_export.js; do echo "## $t"; node "$t"; done && \
python3 -m py_compile praxis_memo_server.py
```
Expected: jede `.js` meldet `RESULT: ALL OK`, kein Python-Fehler.

- [ ] **Step 2: UI-Smoketest auf WEGWERF-Instanz (nicht gegen echte Daten!)**

```bash
TMPD=$(mktemp -d) && cp index.html styles.css app.js praxis_memo_server.py "$TMPD/" && cd "$TMPD" && python3 praxis_memo_server.py --port 0 --no-browser
```
Im Browser die ausgegebene Adresse öffnen, einen Patienten anlegen, eine Sitzung diktieren/strukturieren/freigeben, im Schritt **Anknüpfen** prüfen: Buch zeigt datierten Eintrag; „Noch offen" listet Punkte; manuelles Hinzufügen + Abhaken funktionieren und erscheinen datiert im Buch. Danach `Strg+C`, `rm -rf "$TMPD"`.

- [ ] **Step 3: Release-Notes + HANDOVER**

`docs/release-notes-v1.0.8.md` analog zu `docs/release-notes-v1.0.7.md` anlegen (Feature: Verlaufsbuch + abhakbare/ergänzbare offene Punkte + KI-Vorschlag mit Bestätigung). In `docs/HANDOVER.md` einen v1.0.8-Abschnitt mit der Deploy-Dateiliste ergänzen (mind. `app.js`, `index.html`, `styles.css`, `praxis_memo_server.py` + die neuen Tests/Docs).

- [ ] **Step 4: Commit**

```bash
git add docs/HANDOVER.md docs/release-notes-v1.0.8.md
git commit -m "docs: v1.0.8 Verlaufsbuch in HANDOVER und Release-Notes"
```

- [ ] **Step 5: Deploy (NUR auf ausdrückliches Wort der Nutzerin)**

Deploy folgt der bestehenden Mechanik (Branch→ff main→push→`gh release create v1.0.8 praxis-memo-app.zip --latest`, `VERSION`-File lokal auf `1.0.8` setzen und ins ZIP). Erst ausführen, wenn die Nutzerin es freigibt (live auf dem Praxis-PC).

---

## Self-Review

**Spec-Abdeckung:**
- Datenmodell `resolvedAt`/`resolvedSessionId`/`origin` → Task 1 ✓
- Abhaken mit Datum, append-only → Task 2 ✓
- Manuelles Hinzufügen → Task 3 ✓
- Buch-Ableitung (kein Event-Log) → Task 4 ✓
- KI-Vorschlag nur mit Bestätigung → Task 5 (Match) + Task 6 (Server-Feld) + Task 7 Step 5 (Bestätigungs-Handler) ✓
- Layout B im prep-Schritt → Task 7 ✓
- „Noch offen" über alle Eimer → `renderOpenPoints` iteriert `MEMORY_BUCKETS` ✓
- Migration Altbestand → Task 1 Test (Step 2) ✓
- Tests (5 Punkte der Spec) → Tasks 1–5 + Task 8 ✓

**Platzhalter-Scan:** keine TODO/TBD; jeder Code-Schritt enthält vollständigen Code.

**Typ-/Namens-Konsistenz:** `MEMORY_BUCKETS` in Task 2 definiert und in Tasks 4/5/7 genutzt; `resolveMemoryItem`, `addOpenPoint`, `buildHistoryBook`, `matchResolvedSuggestions`, `resolvedSuggestions`, `renderHistoryBook`, `renderOpenPoints` durchgängig gleich benannt. `normalizeMemoryText`/`createMemoryState`/`makeId`/`todayIso`/`clip`/`formatDateShort`/`escapeHtml` sind bestehende Helfer in `app.js`.
