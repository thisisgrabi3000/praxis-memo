const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

class StubElement {
  constructor(selector = "") {
    this.selector = selector;
    this.children = [];
    this.dataset = {};
    this.disabled = false;
    this.innerHTML = "";
    this.textContent = "";
    this.value = "";
    this.classList = {
      add() {},
      remove() {},
      toggle() {}
    };
  }

  addEventListener() {}
  appendChild(child) { this.children.push(child); return child; }
  click() {}
  closest() { return null; }
  focus() {}
  insertBefore(child) { this.children.push(child); return child; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  remove() {}
  select() {}
  setAttribute() {}
}

const elements = new Map();
const getElement = (selector) => {
  if (!elements.has(selector)) elements.set(selector, new StubElement(selector));
  return elements.get(selector);
};

const documentStub = {
  activeElement: null,
  body: new StubElement("body"),
  addEventListener() {},
  createElement(tag) { return new StubElement(tag); },
  querySelector(selector) { return getElement(selector); },
  querySelectorAll() { return []; }
};
documentStub.body.contains = () => true;

const storage = new Map();
const windowStub = {
  clearInterval() {},
  clearTimeout() {},
  confirm: () => true,
  crypto: { randomUUID: () => "test-uuid" },
  location: { protocol: "file:" },
  open: () => null,
  setInterval: () => 1,
  setTimeout: () => 1
};

const context = {
  AbortSignal: { timeout: () => ({}) },
  Blob: class Blob {
    constructor(parts, options) {
      this.parts = parts;
      this.options = options;
    }
  },
  Event: class Event {
    constructor(type, options) {
      this.type = type;
      this.options = options;
    }
  },
  MediaRecorder: class MediaRecorder {
    static isTypeSupported() { return false; }
  },
  URL: {
    createObjectURL: () => "blob:test",
    revokeObjectURL() {}
  },
  console,
  document: documentStub,
  fetch: async () => ({ ok: false, json: async () => ({}) }),
  localStorage: {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value)
  },
  navigator: { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [] }) } },
  window: windowStub
};
windowStub.document = documentStub;
windowStub.localStorage = context.localStorage;
context.globalThis = context;

const source = fs.readFileSync("app.js", "utf8");
vm.runInNewContext(source, context, { filename: "app.js" });

const legacyExample = {
  uid: "test",
  id: "P-001",
  transcript: "Panikattacke hatte, im Supermarkt an der Kasse"
};
assert.strictEqual(context.isLegacyExamplePatient(legacyExample), true);
assert.deepStrictEqual(context.removeLegacyExamplePatients([legacyExample]), []);
assert.strictEqual(
  context.isLegacyExamplePatient({ uid: "test", id: "P-001", transcript: "Echter eigener Eintrag" }),
  false
);

const patient = {
  id: "P-042",
  status: "Geprueft",
  currentSessionId: "s-1",
  nextDate: "2026-05-30",
  nextTime: "09:15",
  focus: "Exposition vorbereitet",
  agreement: "Uebungstagebuch weiterfuehren",
  open: "Schlafprotokoll auswerten",
  transcript: "Patient berichtet ueber die Expositionsuebung.",
  summary: {
    core: "Aktueller Entwurf <script>nicht offiziell</script>",
    agreement: "Zwei kurze Uebungen",
    open: "Belastung am Arbeitsplatz klaeren",
    watch: "Keine akute Krise berichtet"
  },
  prep: {
    anchor: "An Uebungstagebuch anknuepfen",
    opening: "Wie lief die Woche?",
    caution: "Fachlich pruefen"
  },
  closure: {
    summary: "Behandlung mit Exposition und Aktivitaetsaufbau.",
    outcome: "Symptomatik stabilisiert.",
    recommendation: "Wiedervorstellung bei erneuter Verschlechterung."
  },
  memory: {
    risks: [{ text: "Passive Todesgedanken in frueherer Episode", status: "offen", sourceDate: "2026-05-01" }],
    protectiveFactors: [{ text: "Schwester als Ressource", status: "offen", sourceDate: "2026-05-08" }],
    openQuestions: [],
    agreements: [],
    sensitiveTopics: [{ text: "Mobbing am Arbeitsplatz", status: "offen", sourceDate: "2026-05-12" }]
  },
  sessions: [{
    id: "s-1",
    date: "2026-05-20",
    time: "10:00",
    status: "Geprueft",
    focus: "Soziale Angst",
    transcript: "Archiviertes Transkript",
    summary: {
      core: "Angstkurve <script>besprochen</script>",
      agreement: "Hausaufgabe",
      open: "Offene Frage",
      watch: "Beobachtung"
    },
    prep: {
      anchor: "Anknuepfen",
      opening: "Startfrage",
      caution: "Hinweis"
    },
    revisions: [{
      id: "s-1-old",
      date: "2026-05-20",
      time: "10:00",
      status: "Geprueft",
      focus: "Vorversion",
      transcript: "Altes Transkript",
      summary: {
        core: "Alter Kern",
        agreement: "Alte Hausaufgabe",
        open: "Alte Frage",
        watch: "Alte Beobachtung"
      },
      prep: {}
    }]
  }]
};

const html = context.buildPatientExportHtml(patient);
const workHtml = context.buildPatientExportHtml(patient, { mode: "arbeitsnotiz" });

assert(html.includes("Patientenakte P-042"));
assert(html.includes("Aktuelle Übersicht"));
assert(html.includes("Patientenregister"));
assert(html.includes("Archivierte Sitzungen"));
assert(html.includes("Abschlussnotiz"));
assert(html.includes("Behandlung mit Exposition"));
assert(html.includes("Passive Todesgedanken"));
assert(!html.includes("Archiviertes Transkript"), "official patient record omits raw session transcript");
assert(!html.includes("Patient berichtet ueber die Expositionsuebung."), "official patient record omits current draft transcript");
assert(!html.includes("Aktueller Entwurf"), "official patient record omits unchecked current fields");
assert(workHtml.includes("Arbeitsnotiz P-042"));
assert(workHtml.includes("Archiviertes Transkript"), "work note includes raw session transcript");
assert(workHtml.includes("Patient berichtet ueber die Expositionsuebung."), "work note includes current draft transcript");
assert(workHtml.includes("Aktueller Entwurf"), "work note includes current draft fields");
assert(html.includes("Vorversion"));
assert(html.includes("&lt;script&gt;besprochen&lt;/script&gt;"));
assert(!html.includes("<script"));
assert(workHtml.includes("&lt;script&gt;besprochen&lt;/script&gt;"));
assert(!workHtml.includes("<script"));

const dropdownOnly = context.buildPatientExportHtml({
  id: "P-099",
  status: "Geprüft",
  summary: { core: "Nur per Dropdown markiert" },
  memory: {},
  sessions: []
});
assert(!dropdownOnly.includes("Nur per Dropdown markiert"), "official patient record requires archived checked session");
assert(dropdownOnly.includes("Geprüft speichern"), "official patient record explains why current fields are omitted");

console.log("RESULT: ALL OK");
