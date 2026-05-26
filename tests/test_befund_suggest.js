// tests/test_befund_suggest.js — TDD for befundApplySuggestions
// Run: node tests/test_befund_suggest.js
// Expected final output: "test_befund_suggest OK"

const assert = require("assert");
const B = require("../befund.js");

const { BEFUND_CATALOG, befundDefaultSelection, befundApplySuggestions } = B;

// Precondition: function is exported
assert.strictEqual(typeof befundApplySuggestions, "function", "befundApplySuggestions ist exportiert");

const def = befundDefaultSelection(BEFUND_CATALOG);

// 1. valid suggestion applied
const result1 = befundApplySuggestions(def, { stimmung: ["depressiv"] }, BEFUND_CATALOG);
assert.deepStrictEqual(
  result1.stimmung,
  { normal: false, itemIds: ["depressiv"], freitext: {} },
  "gueltige Suggestion wird angewendet"
);

// 2. invalid item id filtered out; valid one retained
const result2 = befundApplySuggestions(def, { stimmung: ["depressiv", "nonexistent"] }, BEFUND_CATALOG);
assert.deepStrictEqual(
  result2.stimmung.itemIds,
  ["depressiv"],
  "ungueltiges item wird herausgefiltert, gueltiges bleibt"
);
assert.strictEqual(result2.stimmung.normal, false, "normal=false wenn valide items vorhanden");

// 3. unknown section ignored — result deepEquals def for all keys
const result3 = befundApplySuggestions(def, { nosuchsection: ["x"] }, BEFUND_CATALOG);
for (const s of BEFUND_CATALOG) {
  assert.deepStrictEqual(
    result3[s.id],
    def[s.id],
    `unbekannte Sektion aendert ${s.id} nicht`
  );
}

// 4. section with empty suggested list stays normal/unchanged
const result4 = befundApplySuggestions(def, { stimmung: [] }, BEFUND_CATALOG);
assert.deepStrictEqual(
  result4.stimmung,
  def.stimmung,
  "leere Suggestion laesst Sektion unveraendert"
);

// 5. original def not mutated
const defCopy = JSON.parse(JSON.stringify(def));
befundApplySuggestions(def, { stimmung: ["depressiv"] }, BEFUND_CATALOG);
assert.deepStrictEqual(def, defCopy, "Original-Selektion wird nicht veraendert (immutabel)");

// 6. existing freitext is preserved when suggestion is applied
const withFreitext = {
  ...def,
  stimmung: { normal: true, itemIds: [], freitext: { stimmung: "tagesabhaengig" } }
};
const result6 = befundApplySuggestions(withFreitext, { stimmung: ["depressiv"] }, BEFUND_CATALOG);
assert.deepStrictEqual(
  result6.stimmung.freitext,
  { stimmung: "tagesabhaengig" },
  "vorhandener Freitext bleibt erhalten"
);

// 7. all-invalid suggestion for a section leaves it unchanged
const result7 = befundApplySuggestions(def, { stimmung: ["foo", "bar"] }, BEFUND_CATALOG);
assert.deepStrictEqual(
  result7.stimmung,
  def.stimmung,
  "nur unbekannte IDs: Sektion bleibt unveraendert"
);

// 8. multiple valid sections applied simultaneously
const result8 = befundApplySuggestions(def, {
  stimmung: ["depressiv"],
  aengste: ["panik"]
}, BEFUND_CATALOG);
assert.deepStrictEqual(result8.stimmung.itemIds, ["depressiv"], "stimmung korrekt");
assert.deepStrictEqual(result8.aengste.itemIds, ["panik"], "aengste korrekt");
// untouched section stays as default
assert.deepStrictEqual(result8.bewusstsein, def.bewusstsein, "beruehrte Sektion unveraendert");

console.log("test_befund_suggest OK");
