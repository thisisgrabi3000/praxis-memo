const assert = require("assert");
const B = require("../befund.js");

// --- Katalog-Form (Cluster-Modell, 18 Sektionen) ---
assert.strictEqual(B.BEFUND_CATALOG.length, 18, "Katalog hat 18 Sektionen");
const ids = new Set();
for (const s of B.BEFUND_CATALOG) {
  assert.ok(s.id && s.label && s.group && s.icon && typeof s.normal === "string", `Sektion ${s.id} vollständig`);
  assert.ok(!ids.has(s.id), `Sektion-id ${s.id} eindeutig`);
  ids.add(s.id);
  assert.ok(Array.isArray(s.clusters) && s.clusters.length >= 1, `Sektion ${s.id} hat clusters[]`);
  for (const c of s.clusters) {
    assert.ok(c.id && c.label && Array.isArray(c.items), `Cluster ${s.id}/${c.id} vollständig`);
    for (const it of c.items) assert.ok(it.id && it.label && it.text, `Item ${it.id} vollständig`);
  }
}

// --- befundSectionItems flacht Cluster ab ---
const bw = B.BEFUND_CATALOG.find((s) => s.id === "bewusstsein");
assert.deepStrictEqual(
  B.befundSectionItems(bw).map((it) => it.id),
  ["benommen", "somnolent", "soporos", "getruebt", "eingeengt"],
  "Items über Cluster in Reihenfolge"
);

// --- Default-Auswahl = alle Sektionen normal ---
const def = B.befundDefaultSelection(B.BEFUND_CATALOG);
for (const s of B.BEFUND_CATALOG) {
  assert.strictEqual(def[s.id].normal, true, `${s.id} default normal`);
  assert.deepStrictEqual(def[s.id].itemIds, [], `${s.id} default keine items`);
}

console.log("test_befund_engine KATALOG OK");

// --- befundSectionText ---
const sec = B.BEFUND_CATALOG.find((s) => s.id === "stimmung");
assert.strictEqual(B.befundSectionText(sec, { normal: true, itemIds: [] }),
  "Stimmung ausgeglichen, Antrieb unauffällig", "normal → Normaltext");
assert.strictEqual(B.befundSectionText(sec, { normal: false, itemIds: [], nichtErhebbar: true }),
  "Vitalität & Stimmung konnte nicht erhoben werden", "nicht erhebbar → fester Satz");
assert.strictEqual(
  B.befundSectionText(sec, { normal: false, itemIds: ["antrieb_min", "depressiv"] }),
  "Stimmung niedergeschlagen; Antrieb vermindert",
  "items über Cluster in Katalogreihenfolge, ';'-verbunden"
);
assert.strictEqual(
  B.befundSectionText(sec, { normal: false, itemIds: ["depressiv"], freitext: { stimmung: "tagesabhängig schwankend" } }),
  "Stimmung niedergeschlagen; tagesabhängig schwankend",
  "Freitext wird angehängt"
);
assert.strictEqual(B.befundSectionText(sec, { normal: false, itemIds: [] }),
  "Stimmung ausgeglichen, Antrieb unauffällig", "keine items/Freitext → Normaltext");

console.log("test_befund_engine SEKTIONSTEXT OK");

// --- befundFliesstext ---
const full = B.befundFliesstext(B.BEFUND_CATALOG, B.befundDefaultSelection(B.BEFUND_CATALOG));
assert.ok(full.startsWith("Bewusstsein klar."), "Default-Fließtext beginnt mit Bewusstsein-Normalbefund");
assert.ok(full.endsWith("."), "Fließtext endet mit Punkt");
assert.ok(full.includes("keine Hinweise auf akute Suizidalität"), "Gefährdungs-Normalbefund enthalten");

const sel = B.befundDefaultSelection(B.BEFUND_CATALOG);
sel.stimmung = { normal: false, itemIds: ["depressiv"] };
const mixed = B.befundFliesstext(B.BEFUND_CATALOG, sel);
assert.ok(mixed.includes("Stimmung niedergeschlagen."), "Abweichung im Fließtext enthalten");
assert.ok(mixed.includes("Bewusstsein klar."), "übrige Sektionen bleiben Normalbefund");

console.log("test_befund_engine FLIESSTEXT OK");
