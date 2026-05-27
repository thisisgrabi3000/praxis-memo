const assert = require("assert");
const { loadApp } = require("./helpers/load-app");
const app = loadApp();

const old = app.normalizeMemoryItem({ text: "Schlaf klären", status: "offen" });
assert.strictEqual(old.resolvedAt, "", "resolvedAt default leer");
assert.strictEqual(old.resolvedSessionId, "", "resolvedSessionId default leer");
assert.strictEqual(old.origin, "ki", "origin default ki");
assert.strictEqual(old.relevance, "normal", "relevance default normal");

const manual = app.normalizeMemoryItem({ text: "X", origin: "manuell", resolvedAt: "2026-05-21T10:00:00Z", resolvedSessionId: "s-9" });
assert.strictEqual(manual.origin, "manuell");
assert.strictEqual(manual.resolvedAt, "2026-05-21T10:00:00Z");
assert.strictEqual(manual.resolvedSessionId, "s-9");

assert.strictEqual(app.hasRiskSignal("Patientin verneint Suizidgedanken."), false, "negated suicide mention is not risk");
assert.strictEqual(app.hasReliefSignal("Patientin verneint Suizidgedanken."), true, "negated risk stored as relief signal");
assert.strictEqual(app.hasRiskSignal("Passive Todesgedanken ohne Plan wurden benannt."), true, "passive death thoughts remain risk");
assert.strictEqual(
  app.hasRiskSignal("Patientin verneint Suizidgedanken, berichtet aber akute Krise."),
  true,
  "negated suicide does not hide separate acute crisis"
);

const patient = app.normalizePatient({ id: "P-risk" });
const session = app.createSession({
  id: "s-risk",
  date: "2026-05-27",
  transcript: "Patientin verneint Suizidgedanken. Schwester unterstuetzt.",
  summary: {
    core: "Stabilere Woche.",
    agreement: "",
    open: "",
    watch: "Patientin verneint Suizidgedanken; Schwester als Ressource."
  }
});
app.updatePatientMemoryFromSession(patient, session);
assert.strictEqual(patient.memory.risks.length, 0, "negated risk not stored as active risk");
assert.strictEqual(patient.memory.reliefNotes.length, 1, "negated risk stored as relief note");
assert.strictEqual(patient.memory.protectiveFactors.length, 1, "protective factor still stored");

const recurring = app.normalizePatient({
  id: "P-recurring",
  memory: {
    risks: [{
      id: "r-old",
      text: "Passive Todesgedanken ohne Plan",
      status: "erledigt",
      sourceDate: "2026-05-01",
      resolvedAt: "2026-05-08T10:00:00Z"
    }]
  }
});
app.updatePatientMemoryFromSession(recurring, app.createSession({
  id: "s-recurring",
  date: "2026-05-27",
  summary: { watch: "Passive Todesgedanken ohne Plan" }
}));
assert.strictEqual(recurring.memory.risks.length, 2, "recurring resolved risk becomes a new active item");
assert.strictEqual(recurring.memory.risks[0].status, "offen", "new recurring risk is active");
assert.strictEqual(recurring.memory.risks[1].status, "erledigt", "old resolved risk remains append-only history");

console.log("RESULT: ALL OK");
