const assert = require("assert");
const { loadApp } = require("./helpers/load-app");

const app = loadApp();

// Re-structure must include manual field additions and must not overwrite them
// when overwrite is declined.
const patient = app.normalizePatient({
  uid: "p-a",
  id: "P-001",
  transcript: "Fiktive Nachnotiz zu ADHS, Organisation und Terminen.",
  summary: {
    core: "",
    agreement: "",
    open: "Manueller Nachtrag: Handywecker als Erinnerungshilfe pruefen.",
    watch: ""
  },
  open: "Manueller Nachtrag: Handywecker als Erinnerungshilfe pruefen."
});

const structureInput = app.buildStructureInput(patient);
assert.ok(
  structureInput.includes("Manueller Nachtrag: Handywecker als Erinnerungshilfe pruefen."),
  "manual field addition is included in structure input"
);

app.applyStructuredResult(patient, {
  core: "KI-Kernpunkte",
  agreement: "KI-Absprachen",
  open: "KI-Offene Punkte",
  watch: "KI-Beobachtung"
}, { forceOverwrite: false });
assert.strictEqual(
  patient.summary.open,
  "Manueller Nachtrag: Handywecker als Erinnerungshilfe pruefen.",
  "manual field addition survives non-forced re-structure"
);

// Pending structure: accept applies, reject keeps existing fields, both clear pending.
const acceptPatient = app.normalizePatient({
  uid: "p-accept",
  id: "P-001",
  summary: { core: "Alt", agreement: "Alt", open: "Alter offener Punkt", watch: "Alt" },
  pendingStructure: {
    overwriteLabels: ["Offene Punkte"],
    result: { core: "Neu", agreement: "Neu", open: "Neuer offener Punkt", watch: "Neu" },
    resolved: []
  }
});
app.window.confirm = () => true;
app.resolvePendingStructure(acceptPatient);
assert.strictEqual(acceptPatient.summary.open, "Neuer offener Punkt", "accept applies pending result");
assert.strictEqual(acceptPatient.pendingStructure, null, "accept clears pending result");

const rejectPatient = app.normalizePatient({
  uid: "p-reject",
  id: "P-001",
  summary: { core: "Alt", agreement: "Alt", open: "Alter offener Punkt", watch: "Alt" },
  pendingStructure: {
    overwriteLabels: ["Offene Punkte"],
    result: { core: "Neu", agreement: "Neu", open: "Neuer offener Punkt", watch: "Neu" },
    resolved: []
  }
});
app.window.confirm = () => false;
app.resolvePendingStructure(rejectPatient);
assert.strictEqual(rejectPatient.summary.open, "Alter offener Punkt", "reject keeps existing result");
assert.strictEqual(rejectPatient.pendingStructure, null, "reject clears pending result");

assert.throws(
  () => app.validateStructuredResult(
    { core: "", agreement: "", open: "", watch: "Symptome in Zusammenarbeit mit einem Facharzt ueberpruefen" },
    "Patient berichtet Rueckzug und wenig Aktivitaet.",
    "P-001"
  ),
  /Versorgungs-\/Therapieempfehlungen/,
  "unsupported care recommendation is blocked"
);
assert.doesNotThrow(
  () => app.validateStructuredResult(
    { core: "", agreement: "", open: "", watch: "Patient berichtet bereits vereinbarten Facharzttermin." },
    "Patient berichtet bereits vereinbarten Facharzttermin.",
    "P-001"
  ),
  "sourced care term is allowed"
);

// Memory classification: sensitive/risk/protective buckets must stay separate.
const memoryPatient = app.normalizePatient({ uid: "p-memory", id: "P-003" });
const session = app.createSession({
  id: "s-memory",
  date: "2026-05-24",
  transcript: "Patientin berichtet Trauma und Gewalt in der Familie. Passive Todesgedanken ohne Plan wurden benannt. Schwester ist erreichbar und unterstuetzt.",
  summary: {
    core: "Patientin berichtet Belastung nach Trauma und Gewalt.",
    agreement: "Krisenkarte weiter mitbringen.",
    open: "Risikoabfrage naechsten Termin fortsetzen.",
    watch: "Trauma/Gewalt sensibel beachten; passive Todesgedanken ohne Plan; Schwester erreichbar als Ressource"
  }
});
app.updatePatientMemoryFromSession(memoryPatient, session);

const texts = (bucket) => memoryPatient.memory[bucket].map((item) => item.text).join(" | ");
assert.match(texts("sensitiveTopics"), /Trauma|Gewalt/i, "trauma/violence stored as sensitive topic");
assert.match(texts("risks"), /Todesgedanken|Risiko/i, "passive death thoughts stored as risk");
assert.match(texts("protectiveFactors"), /Schwester/i, "sister/reachability stored as protective factor");
assert.doesNotMatch(
  texts("protectiveFactors"),
  /Gewalt in der Familie/i,
  "violence in family is not stored as protective factor"
);

console.log("RESULT: ALL OK");
