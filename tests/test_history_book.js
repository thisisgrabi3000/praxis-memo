const assert = require("assert");
const { loadApp } = require("./helpers/load-app");
const app = loadApp();

const patient = app.normalizePatient({
  id: "P-1",
  sessions: [
    { id: "s1", date: "2026-05-14", status: "Geprüft", summary: { core: "Erste Sitzung" } },
    { id: "s2", date: "2026-05-21", status: "Geprüft", summary: { core: "Folgesitzung" } }
  ],
  memory: {
    openQuestions: [
      { id: "m1", text: "Schlaf klären", status: "erledigt", origin: "ki", sourceDate: "2026-05-14", resolvedAt: "2026-05-21T09:00:00Z" },
      { id: "m2", text: "Medikamente", status: "offen", origin: "manuell", sourceDate: "2026-05-18" }
    ]
  }
});

const book = app.buildHistoryBook(patient);
// vm-Kontext liefert einen anderen Array-Prototyp; in natives Array konvertieren für deepStrictEqual.
const dates = [...book].map((e) => e.date);
assert.deepStrictEqual(dates, ["2026-05-14", "2026-05-18", "2026-05-21", "2026-05-21"],
  "chronologisch sortiert");

const types = [...book].map((e) => e.type);
assert.ok(types.includes("session"), "session-Ereignisse");
assert.ok(types.includes("added"), "manuell-ergänzt-Ereignis (m2 am 18.05.)");
assert.ok(types.includes("resolved"), "abgehakt-Ereignis (m1 am 21.05.)");

console.log("RESULT: ALL OK");
