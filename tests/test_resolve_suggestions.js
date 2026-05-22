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

// Abgleich über alle Eimer, nicht nur openQuestions; erledigte werden nicht vorgeschlagen.
const multi = app.normalizePatient({
  id: "P-2",
  memory: {
    agreements: [{ id: "a1", text: "Tagebuch führen", status: "offen" }],
    openQuestions: [{ id: "o1", text: "Schon erledigt", status: "erledigt" }]
  }
});
const multiIds = app.matchResolvedSuggestions(multi, ["tagebuch führen", "schon erledigt"]);
assert.deepStrictEqual([...multiIds], ["a1"], "Treffer im agreements-Eimer, erledigter ausgeschlossen");

// Pending-Strukturierung (Hintergrund-Abschluss) bewahrt das resolved-Array über normalize.
const pending = app.normalizePendingStructure({
  result: { core: "c", agreement: "a", open: "o", watch: "w" },
  resolved: ["Schlafprobleme klären"]
});
assert.deepStrictEqual([...pending.resolved], ["Schlafprobleme klären"], "resolved bleibt erhalten");
const pendingNoResolved = app.normalizePendingStructure({ result: { core: "c" } });
assert.deepStrictEqual([...pendingNoResolved.resolved], [], "fehlendes resolved => leeres Array");

console.log("RESULT: ALL OK");
