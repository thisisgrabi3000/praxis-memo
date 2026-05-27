const assert = require("assert");
const B = require("../befund.js");

const C = B.BEFUND_CATALOG;
const def = B.befundDefaultSelection(C);

// --- gueltige Abweichung: Cluster-Normal weg, anderer Cluster bleibt normal ---
const a1 = B.befundApplySuggestions(def, { stimmung: ["depressiv"] }, C);
assert.ok(a1.stimmung.itemIds.includes("depressiv"), "Vorschlag uebernommen");
assert.ok(!a1.stimmung.itemIds.includes("n_stimmung_ok"), "Cluster-Normal entfernt");
assert.ok(a1.stimmung.itemIds.includes("n_antrieb_ok"), "anderer Cluster bleibt normal");
assert.strictEqual(a1.stimmung.normal, false, "normal false");

// --- ungueltige item-id wird gefiltert ---
const a2 = B.befundApplySuggestions(def, { stimmung: ["depressiv", "gibtsnicht"] }, C);
assert.ok(a2.stimmung.itemIds.includes("depressiv") && !a2.stimmung.itemIds.includes("gibtsnicht"), "ungueltige id gefiltert");

// --- Vorschlag nur auf Normal-Item aendert nichts (nur Abweichungen zaehlen) ---
const a3 = B.befundApplySuggestions(def, { stimmung: ["n_stimmung_ok"] }, C);
assert.deepStrictEqual(a3.stimmung.itemIds, def.stimmung.itemIds, "nur-Normal-Vorschlag aendert nichts");

// --- unbekannte Sektion ignoriert ---
const a4 = B.befundApplySuggestions(def, { gibtsnicht: ["x"] }, C);
assert.strictEqual(a4.gibtsnicht, undefined, "unbekannte Sektion ignoriert");

// --- leere Liste -> unveraendert ---
const a5 = B.befundApplySuggestions(def, { stimmung: [] }, C);
assert.deepStrictEqual(a5.stimmung.itemIds, def.stimmung.itemIds, "leere Liste unveraendert");

// --- Immutabilitaet ---
assert.deepStrictEqual(def.stimmung.itemIds, ["n_stimmung_ok", "n_antrieb_ok"], "Original unveraendert");

console.log("test_befund_suggest OK");
