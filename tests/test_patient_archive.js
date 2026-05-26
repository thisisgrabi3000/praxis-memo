const assert = require("assert");
const { loadApp } = require("./helpers/load-app");

const app = loadApp();

const { active, archived } = app.partitionPatientsByArchived([
  { id: "P-001", archived: false },
  { id: "P-002", archived: true },
  { id: "P-003" }
]);
assert.deepStrictEqual(active.map((p) => p.id), ["P-001", "P-003"], "non-archived are active");
assert.deepStrictEqual(archived.map((p) => p.id), ["P-002"], "archived partitioned out");

assert.strictEqual(app.normalizePatient({ id: "P-009" }).archived, false, "archived defaults to false");
assert.strictEqual(app.normalizePatient({ id: "P-009", archived: true }).archived, true, "archived preserved");

console.log("test_patient_archive OK");
