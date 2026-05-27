const assert = require("assert");
const B = require("../befund.js");

const C = B.BEFUND_CATALOG;
const def = B.befundDefaultSelection(C);

// --- Katalog: 18 Sektionen, je Cluster >=1 Normal-Item, eindeutige ids ---
assert.strictEqual(C.length, 18, "18 Sektionen");
const secIds = new Set();
for (const s of C) {
  assert.ok(s.id && s.label && s.group && s.icon && typeof s.normal === "string", `Sektion ${s.id} vollstaendig`);
  assert.ok(!secIds.has(s.id), `Sektion-id ${s.id} eindeutig`);
  secIds.add(s.id);
  assert.ok(Array.isArray(s.clusters) && s.clusters.length >= 1, `${s.id} hat clusters`);
  const itemIds = new Set();
  for (const c of s.clusters) {
    assert.ok(c.id && c.label && Array.isArray(c.items), `Cluster ${s.id}/${c.id} vollstaendig`);
    assert.ok(c.items.some((it) => it.normal), `Cluster ${s.id}/${c.id} hat Normal-Item`);
    for (const it of c.items) {
      assert.ok(it.id && it.label && it.text, `Item ${it.id} vollstaendig`);
      assert.ok(!itemIds.has(it.id), `Item-id ${it.id} eindeutig in ${s.id}`);
      itemIds.add(it.id);
    }
  }
}

// --- Default = Normal-Items angehakt ---
assert.deepStrictEqual(def.stimmung.itemIds, ["n_stimmung_ok", "n_antrieb_ok"], "Default: Normal-Items von stimmung");
assert.strictEqual(def.stimmung.normal, true, "Default normal true");

console.log("test_befund_engine KATALOG OK");

// --- befundSectionText ---
const stim = B.befundSectionById(C, "stimmung");
assert.strictEqual(B.befundSectionText(stim, def.stimmung),
  "Stimmung ausgeglichen, Antrieb unauffällig", "normal -> Normalbefund-Text");
assert.strictEqual(B.befundSectionText(stim, { nichtErhebbar: true }),
  "Vitalität & Stimmung konnte nicht erhoben werden", "nicht erhebbar");
assert.strictEqual(B.befundSectionText(stim, { normal: false, itemIds: ["depressiv"] }),
  "Stimmung niedergeschlagen", "Abweichung -> Abweichungstext");
assert.strictEqual(
  B.befundSectionText(stim, { normal: false, itemIds: ["depressiv"], freitext: { stimmung: "tagesabhaengig" } }),
  "Stimmung niedergeschlagen; tagesabhaengig", "Abweichung + Freitext");

console.log("test_befund_engine SEKTIONSTEXT OK");

// --- befundFliesstext ---
const full = B.befundFliesstext(C, def);
assert.ok(full.startsWith("Bewusstsein klar."), "Fliesstext beginnt mit Bewusstsein-Normalbefund");
assert.ok(full.endsWith("."), "endet mit Punkt");
assert.ok(full.includes("keine Hinweise auf akute Suizidalität"), "Gefaehrdungs-Normalbefund enthalten");

console.log("test_befund_engine FLIESSTEXT OK");
