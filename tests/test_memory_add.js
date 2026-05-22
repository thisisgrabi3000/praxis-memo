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

assert.strictEqual(app.addOpenPoint(patient, "   "), null);
assert.strictEqual(patient.memory.openQuestions.length, 1);

console.log("RESULT: ALL OK");
