const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

// Minimaler DOM/Window-Stub, identisch zur Lade-Mechanik von test_patient_export.js:
// app.js wird im vm-Context ausgeführt, die Top-Level-Funktionen liegen danach auf `context`.
class StubElement {
  constructor() {
    this.dataset = {};
    this.disabled = false;
    this.innerHTML = "";
    this.textContent = "";
    this.value = "";
    this.classList = { add() {}, remove() {}, toggle() {} };
  }
  addEventListener() {}
  appendChild(c) { return c; }
  click() {}
  closest() { return null; }
  focus() {}
  querySelector() { return null; }
  querySelectorAll() { return []; }
  remove() {}
  setAttribute() {}
}

const documentStub = {
  body: new StubElement(),
  addEventListener() {},
  createElement() { return new StubElement(); },
  querySelector() { return new StubElement(); },
  querySelectorAll() { return []; }
};

const context = {
  AbortSignal: { timeout: () => ({}) },
  Blob: class {},
  MediaRecorder: class { static isTypeSupported() { return false; } },
  URL: { createObjectURL: () => "blob:test", revokeObjectURL() {} },
  console,
  document: documentStub,
  fetch: async () => ({ ok: false, json: async () => ({}) }),
  localStorage: { getItem: () => null, setItem() {} },
  navigator: { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [] }) } },
  window: { confirm: () => true, location: { protocol: "file:" }, open: () => null, setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {}, crypto: { randomUUID: () => "test-uuid" } }
};
context.window.document = documentStub;
context.window.localStorage = context.localStorage;
context.globalThis = context;

vm.runInNewContext(fs.readFileSync("app.js", "utf8"), context, { filename: "app.js" });

const { hasFutureFollowUp, todayIso } = context;

// Leeres Datum → kein Folgetermin
assert.strictEqual(hasFutureFollowUp({ nextDate: "" }), false, "leer => false");
assert.strictEqual(hasFutureFollowUp({}), false, "fehlend => false");
assert.strictEqual(hasFutureFollowUp(null), false, "null => false");

// Vergangenheit → kein gültiger Folgetermin
assert.strictEqual(hasFutureFollowUp({ nextDate: "2000-01-01" }), false, "Vergangenheit => false");

// Heute zählt nicht als Zukunft (Termin ist gerade gelaufen)
assert.strictEqual(hasFutureFollowUp({ nextDate: todayIso() }), false, "heute => false");

// Echte Zukunft → gültiger Folgetermin
assert.strictEqual(hasFutureFollowUp({ nextDate: "2999-12-31" }), true, "Zukunft => true");

console.log("RESULT: ALL OK");
