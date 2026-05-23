const assert = require("assert");
const { loadApp } = require("./helpers/load-app");
const app = loadApp();

const patient = app.normalizePatient({
  id: "P-1",
  sessions: [
    { id: "s1", date: "2026-05-14", status: "Geprüft", summary: { core: "Erste" } },
    { id: "s2", date: "2026-05-21", status: "Geprüft", summary: { core: "Zweite" } }
  ],
  memory: {
    openQuestions: [
      { id: "m1", text: "Schlaf", status: "erledigt", origin: "ki", sourceDate: "2026-05-14", resolvedAt: "2026-05-21T09:00:00Z" },
      { id: "m2", text: "Medikamente", status: "offen", origin: "manuell", sourceDate: "2026-05-18" }
    ]
  }
});

const days = app.buildHistoryDays(patient);

// Ein Block pro Tag, neueste zuerst.
assert.deepStrictEqual([...days.map((d) => d.date)], ["2026-05-21", "2026-05-18", "2026-05-14"], "ein Block je Tag, neueste oben");

const d21 = days[0];
assert.strictEqual(d21.sessions.length, 1, "21.05 hat Sitzung");
assert.strictEqual(d21.resolved.length, 1, "21.05 hat 1 abgehakt");
assert.strictEqual(d21.resolved[0].id, "m1");
assert.strictEqual(d21.added.length, 0);

const d18 = days[1];
assert.strictEqual(d18.sessions.length, 0, "18.05 keine Sitzung (Notiz-Tag)");
assert.strictEqual(d18.added.length, 1, "18.05 hat 1 ergänzt");
assert.strictEqual(d18.added[0].id, "m2");

const d14 = days[2];
assert.strictEqual(d14.sessions.length, 1, "14.05 Sitzung");
assert.strictEqual(d14.resolved.length, 0, "14.05 nichts abgehakt");

console.log("RESULT: ALL OK");
