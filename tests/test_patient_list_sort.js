const assert = require("assert");
const { loadApp } = require("./helpers/load-app");

const app = loadApp();

const list = [{ id: "P-010" }, { id: "P-002" }, { id: "P-001" }, { id: "B-003" }];
const sorted = [...list].sort(app.sortPatientsById);

assert.deepStrictEqual(
  sorted.map((p) => p.id),
  ["B-003", "P-001", "P-002", "P-010"],
  "Patienten alphabetisch + numerisch nach Kürzel sortiert (P-2 vor P-10)"
);

console.log("test_patient_list_sort OK");
