const assert = require("assert");
const B = require("../befund.js");

// Katalog-Form
assert.ok(Array.isArray(B.BEFUND_CATALOG) && B.BEFUND_CATALOG.length >= 3, "Katalog hat >=3 Sektionen");
for (const s of B.BEFUND_CATALOG) {
  assert.ok(s.id && s.label && typeof s.normal === "string", `Sektion ${s.id} vollständig`);
  assert.ok(Array.isArray(s.items), `Sektion ${s.id} hat items[]`);
  for (const it of s.items) assert.ok(it.id && it.label && it.text, `Item ${it.id} vollständig`);
}

// Default-Auswahl = alle Sektionen normal
const def = B.befundDefaultSelection(B.BEFUND_CATALOG);
for (const s of B.BEFUND_CATALOG) {
  assert.strictEqual(def[s.id].normal, true, `${s.id} default normal`);
  assert.deepStrictEqual(def[s.id].itemIds, [], `${s.id} default keine items`);
}

console.log("test_befund_engine TASK1 OK");

const sec = B.BEFUND_CATALOG.find((s) => s.id === "stimmung");
// normal
assert.strictEqual(B.befundSectionText(sec, { normal: true, itemIds: [] }),
  "Stimmung ausgeglichen, Antrieb unauffällig", "normal → Normaltext");
// nicht erhebbar
assert.strictEqual(B.befundSectionText(sec, { normal: false, itemIds: [], nichtErhebbar: true }),
  "Vitalität & Stimmung konnte nicht erhoben werden", "nicht erhebbar → fester Satz");
// abweichende items in Katalogreihenfolge, mit '; ' verbunden
assert.strictEqual(
  B.befundSectionText(sec, { normal: false, itemIds: ["antrieb_min", "depressiv"] }),
  "Stimmung niedergeschlagen; Antrieb vermindert",
  "items in Katalogreihenfolge, ';'-verbunden"
);
// leere itemIds trotz normal:false → fällt auf Normaltext zurück
assert.strictEqual(B.befundSectionText(sec, { normal: false, itemIds: [] }),
  "Stimmung ausgeglichen, Antrieb unauffällig", "keine items → Normaltext");

console.log("test_befund_engine TASK2 OK");

// Default (alles normal) → alle Normaltexte, je mit '. ' getrennt, Punkt am Ende
const full = B.befundFliesstext(B.BEFUND_CATALOG, B.befundDefaultSelection(B.BEFUND_CATALOG));
assert.strictEqual(
  full,
  "Bewusstsein klar. allseits orientiert. Stimmung ausgeglichen, Antrieb unauffällig. " +
  "keine Hinweise auf akute Suizidalität, glaubhafte Absprachefähigkeit.",
  "Default-Fließtext = alle Normalbefunde, punktgetrennt"
);
// Eine Abweichung mischt sich ein
const sel = B.befundDefaultSelection(B.BEFUND_CATALOG);
sel.stimmung = { normal: false, itemIds: ["depressiv"] };
const mixed = B.befundFliesstext(B.BEFUND_CATALOG, sel);
assert.ok(mixed.includes("Stimmung niedergeschlagen."), "Abweichung im Fließtext enthalten");
assert.ok(mixed.includes("Bewusstsein klar."), "übrige Sektionen bleiben Normalbefund");

console.log("test_befund_engine TASK3 OK");
