const assert = require("assert");
const { loadApp } = require("./helpers/load-app");

const app = loadApp();
const plain = (value) => JSON.parse(JSON.stringify(value));

const baseBefund = {
  stimmung: {
    normal: false,
    itemIds: ["depressiv"],
    freitext: { stimmung: "tagesabhaengig" }
  }
};

const patient = app.normalizePatient({
  uid: "p-befund",
  id: "P-010",
  currentSessionId: "s-current",
  nextTime: "11:00",
  focus: "Befundbesprechung",
  summary: {
    core: "Fiktiver Sitzungsverlauf",
    agreement: "Befund naechstes Mal erneut pruefen",
    open: "Schlaf weiter beobachten",
    watch: "Stimmung tagesabhaengig"
  },
  prep: {
    anchor: "An Befund anknuepfen",
    opening: "Wie war die Woche?",
    caution: "Fachlich pruefen"
  },
  befund: baseBefund,
  sessions: []
});

assert.deepStrictEqual(plain(patient.befund), baseBefund, "patient befund is preserved");
assert.notStrictEqual(patient.befund, baseBefund, "patient befund is cloned during normalization");

const archived = app.buildSessionFromCurrent(patient);
assert.deepStrictEqual(plain(archived.befund), baseBefund, "current befund is stored on archived session");
assert.notStrictEqual(archived.befund, patient.befund, "archived session keeps an independent befund snapshot");

patient.befund.stimmung.itemIds.push("antrieb_gemindert");
assert.deepStrictEqual(
  plain(archived.befund.stimmung.itemIds),
  ["depressiv"],
  "later edits do not mutate the archived session befund"
);

const latestBefund = {
  orientierung: {
    normal: true,
    itemIds: ["n_orientierung_ok"],
    freitext: {}
  }
};
const carried = app.carriedBefundSelection(patient, { befund: latestBefund });
assert.deepStrictEqual(plain(carried), latestBefund, "new sessions carry forward latest checked session befund first");
assert.notStrictEqual(carried, latestBefund, "carried befund is cloned");

const fallback = app.carriedBefundSelection({ befund: baseBefund }, null);
assert.deepStrictEqual(plain(fallback), baseBefund, "patient-level befund is fallback for old data without session befund");

const normalizedSession = app.normalizeSession({
  id: "s-old",
  date: "2026-05-27",
  time: "09:30",
  befund: baseBefund,
  revisions: [{
    id: "s-revision",
    date: "2026-05-27",
    time: "09:00",
    befund: latestBefund
  }]
});
assert.deepStrictEqual(plain(normalizedSession.befund), baseBefund, "session normalization preserves befund");
assert.deepStrictEqual(plain(normalizedSession.revisions[0].befund), latestBefund, "revision normalization preserves befund");

console.log("test_session_befund OK");
