const assert = require("assert");
const B = require("../befund.js");

const C = B.BEFUND_CATALOG;
const def = B.befundDefaultSelection(C);

// --- Abweichung anhaken: Cluster-Normal weg, anderer Cluster bleibt ---
const t1 = B.befundToggleItem(def, "stimmung", "depressiv", C);
assert.ok(!t1.stimmung.itemIds.includes("n_stimmung_ok"), "Cluster-Normal (stimmung) entfernt");
assert.ok(t1.stimmung.itemIds.includes("depressiv"), "Abweichung gesetzt");
assert.ok(t1.stimmung.itemIds.includes("n_antrieb_ok"), "anderer Cluster (antrieb) unveraendert");
assert.strictEqual(t1.stimmung.normal, false, "nicht mehr normal");

// --- Abweichung wieder abhaken ---
const t2 = B.befundToggleItem(t1, "stimmung", "depressiv", C);
assert.ok(!t2.stimmung.itemIds.includes("depressiv"), "Abweichung wieder entfernt");

// --- Normal-Item anhaken entfernt Abweichungen des Clusters ---
const t3 = B.befundToggleItem(t1, "stimmung", "n_stimmung_ok", C);
assert.ok(t3.stimmung.itemIds.includes("n_stimmung_ok"), "Normal-Item gesetzt");
assert.ok(!t3.stimmung.itemIds.includes("depressiv"), "Abweichung des Clusters entfernt");

// --- befundSetNormal: zurueck auf Normal ---
const sn = B.befundSetNormal(t1, "stimmung", C);
assert.deepStrictEqual(sn.stimmung.itemIds, ["n_stimmung_ok", "n_antrieb_ok"], "setNormal: Normal-Items");
assert.strictEqual(sn.stimmung.normal, true, "setNormal: normal true");

// --- befundSetFreitext: Text -> normal false, leer -> normal true ---
const f1 = B.befundSetFreitext(def, "stimmung", "stimmung", "tagesabhaengig", C);
assert.strictEqual(f1.stimmung.normal, false, "Freitext -> normal false");
const f2 = B.befundSetFreitext(f1, "stimmung", "stimmung", "", C);
assert.strictEqual(f2.stimmung.normal, true, "Freitext leer -> normal true");

// --- befundSetAllNormal ---
const alln = B.befundSetAllNormal(C);
assert.strictEqual(alln.bewusstsein.normal, true, "setAllNormal normal");
assert.deepStrictEqual(alln.bewusstsein.itemIds, ["n_wach", "n_klar"], "setAllNormal: bewusstsein Normal-Items");

// --- Immutabilitaet ---
assert.deepStrictEqual(def.stimmung.itemIds, ["n_stimmung_ok", "n_antrieb_ok"], "Original unveraendert");

console.log("test_befund_select OK");
