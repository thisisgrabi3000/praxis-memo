const assert = require("assert");
const { loadApp } = require("./helpers/load-app");

const app = loadApp();

const { active, archived } = app.partitionPatientsByArchived([
  app.normalizePatient({ id: "P-001", archived: false }),
  app.normalizePatient({ id: "P-002", archived: true }),
  app.normalizePatient({ id: "P-003" }),
  app.normalizePatient({ id: "P-004", caseStatus: "pausiert" }),
  app.normalizePatient({ id: "P-005", caseStatus: "abgeschlossen" })
]);
assert.deepStrictEqual(active.map((p) => p.id), ["P-001", "P-003"], "non-archived are active");
assert.deepStrictEqual(archived.map((p) => p.id), ["P-002"], "archived partitioned out");

assert.strictEqual(app.normalizePatient({ id: "P-009" }).archived, false, "archived defaults to false");
assert.strictEqual(app.normalizePatient({ id: "P-009", archived: true }).archived, true, "archived preserved");
assert.strictEqual(app.normalizePatient({ id: "P-010", archived: true }).caseStatus, "archiviert", "archived migrates to caseStatus");
assert.strictEqual(app.normalizePatient({ id: "P-011", caseStatus: "pausiert" }).caseStatus, "pausiert", "caseStatus preserved");
assert.strictEqual(app.normalizePatient({ id: "P-012", status: "Geprueft" }).status, "Geprüft", "ASCII checked status normalized");

const revised = app.normalizePatient({
  id: "P-020",
  status: "Geprüft",
  currentSessionId: "s-checked",
  sessions: [{
    id: "s-checked",
    date: "2026-05-20",
    time: "10:00",
    status: "Geprueft",
    focus: "Vorversion",
    summary: { core: "Alter Stand" }
  }],
  summary: { core: "Neuer Stand" }
});
app.archiveCurrentSession(revised);
assert.strictEqual(revised.sessions[0].revisions.length, 1, "ASCII Geprueft status keeps append-only revision");
assert.strictEqual(revised.sessions[0].revisions[0].summary.core, "Alter Stand", "previous checked state preserved");

console.log("test_patient_archive OK");
