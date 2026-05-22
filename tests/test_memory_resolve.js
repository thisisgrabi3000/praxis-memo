const assert = require("assert");
const { loadApp } = require("./helpers/load-app");
const app = loadApp();

const patient = app.normalizePatient({
  id: "P-1",
  memory: { openQuestions: [{ id: "m1", text: "Schlaf klären", status: "offen" }] }
});

const ok = app.resolveMemoryItem(patient, "m1", { sessionId: "s-2" });
assert.strictEqual(ok, true, "Treffer => true");
const item = patient.memory.openQuestions[0];
assert.strictEqual(item.status, "erledigt");
assert.ok(item.resolvedAt, "resolvedAt gesetzt");
assert.strictEqual(item.resolvedSessionId, "s-2");
assert.strictEqual(item.text, "Schlaf klären", "Text unverändert");

assert.strictEqual(app.resolveMemoryItem(patient, "nope"), false);

// Idempotenz: bereits erledigte Punkte nicht erneut abhaken/überschreiben.
const reResolve = app.resolveMemoryItem(patient, "m1", { sessionId: "s-3" });
assert.strictEqual(reResolve, false, "Bereits erledigt => false (idempotent)");
assert.strictEqual(item.resolvedSessionId, "s-2", "resolvedSessionId nicht überschrieben");

console.log("RESULT: ALL OK");
