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
