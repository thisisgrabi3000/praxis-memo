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

const ids = app.matchResolvedSuggestions(patient, ["  schlafprobleme KLÄREN ", "unbekannter punkt"]);
assert.deepStrictEqual([...ids], ["m1"], "nur exakt-normalisierter Treffer, kein Fremdtext");

assert.strictEqual(patient.memory.openQuestions[0].status, "offen", "kein Auto-Abhaken");

assert.deepStrictEqual([...app.matchResolvedSuggestions(patient, undefined)], []);
assert.deepStrictEqual([...app.matchResolvedSuggestions(patient, [])], []);

console.log("RESULT: ALL OK");
