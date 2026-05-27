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

const byAppointment = [
  { id: "P-010", nextDate: "2026-06-03", nextTime: "11:00" },
  { id: "P-002", nextDate: "2026-06-01", nextTime: "12:00" },
  { id: "P-001", nextDate: "2026-06-01", nextTime: "09:00" },
  { id: "P-099", nextDate: "", nextTime: "" }
];

const appointmentSorted = [...byAppointment].sort(app.sortByDateAndTime);
assert.deepStrictEqual(
  appointmentSorted.map((p) => p.id),
  ["P-001", "P-002", "P-010", "P-099"],
  "aktive Patienten nach naechstem Termin und Uhrzeit sortiert"
);

const groups = [...app.groupPatientsByDate(byAppointment)].map(([date, group]) => [
  date,
  [...group].map((p) => p.id)
]);
assert.deepStrictEqual(
  groups,
  [
    ["2026-06-01", ["P-001", "P-002"]],
    ["2026-06-03", ["P-010"]],
    ["0000", ["P-099"]]
  ],
  "aktive Patienten nach Termintag gruppiert, offene Termine zuletzt"
);

console.log("test_patient_list_sort OK");
