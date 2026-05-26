const assert = require("assert");
const B = require("../befund.js");

const def = B.befundDefaultSelection(B.BEFUND_CATALOG);

// --- befundToggleItem: toggle ON ---
const afterToggleOn = B.befundToggleItem(def, "stimmung", "depressiv");
assert.deepStrictEqual(
  afterToggleOn.stimmung.itemIds,
  ["depressiv"],
  "toggle on: itemIds sollte ['depressiv'] sein"
);
assert.strictEqual(afterToggleOn.stimmung.normal, false, "toggle on: normal sollte false sein");

// --- befundToggleItem: toggle OFF (Rueck-Toggle) ---
const afterToggleOff = B.befundToggleItem(afterToggleOn, "stimmung", "depressiv");
assert.deepStrictEqual(
  afterToggleOff.stimmung.itemIds,
  [],
  "toggle off: itemIds sollte [] sein"
);
assert.strictEqual(afterToggleOff.stimmung.normal, true, "toggle off: normal wieder true (Normalbefund)");

// --- befundSetNormal nach einem Toggle ---
const sel = B.befundToggleItem(def, "stimmung", "depressiv");
const afterSetNormal = B.befundSetNormal(sel, "stimmung");
assert.strictEqual(afterSetNormal.stimmung.normal, true, "setNormal: normal sollte true sein");
assert.deepStrictEqual(afterSetNormal.stimmung.itemIds, [], "setNormal: itemIds sollte leer sein");

// --- befundSetFreitext: text setzen -> normal false, freitext gespeichert ---
const afterFreitext = B.befundSetFreitext(def, "stimmung", "stimmung", "tagesabhaengig");
assert.strictEqual(afterFreitext.stimmung.normal, false, "setFreitext: normal sollte false sein wenn text vorhanden");
assert.strictEqual(
  afterFreitext.stimmung.freitext.stimmung,
  "tagesabhaengig",
  "setFreitext: Freitext sollte gespeichert sein"
);

// --- befundSetFreitext: text auf leer -> normal true ---
const afterFreitextClear = B.befundSetFreitext(afterFreitext, "stimmung", "stimmung", "");
assert.strictEqual(afterFreitextClear.stimmung.normal, true, "setFreitext leer: normal sollte wieder true sein");

// --- befundSetAllNormal ---
const modSel = B.befundToggleItem(def, "stimmung", "depressiv");
const allNormal = B.befundSetAllNormal(B.BEFUND_CATALOG);
assert.strictEqual(allNormal.stimmung.normal, true, "setAllNormal: stimmung sollte normal sein");
assert.deepStrictEqual(allNormal.stimmung.itemIds, [], "setAllNormal: keine itemIds");

// --- Immutabilitaet: Original unveraendert ---
assert.strictEqual(def.stimmung.normal, true, "Original-Selektion bleibt unveraendert");
assert.deepStrictEqual(def.stimmung.itemIds, [], "Original-Selektion: itemIds unveraendert");

// --- befundSetNormal loescht auch Freitext ---
const withFreitext = B.befundSetFreitext(def, "stimmung", "stimmung", "tagesabhaengig");
const normalizedAgain = B.befundSetNormal(withFreitext, "stimmung");
assert.deepStrictEqual(normalizedAgain.stimmung.freitext, {}, "setNormal: Freitext wird geleert");

// --- toggle letztes Item OFF, aber Freitext noch gesetzt -> normal bleibt false ---
let mix = B.befundSetFreitext(def, "stimmung", "stimmung", "tagesabhaengig");
mix = B.befundToggleItem(mix, "stimmung", "depressiv"); // ON
mix = B.befundToggleItem(mix, "stimmung", "depressiv"); // wieder OFF
assert.strictEqual(mix.stimmung.normal, false, "Freitext haelt normal=false trotz leerer itemIds");

console.log("test_befund_select OK");
