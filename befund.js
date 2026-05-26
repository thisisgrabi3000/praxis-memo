// befund.js — Psychopathologischer Befund: Katalog + Fließtext-Engine.
// DOM-frei, dual-mode (Browser-Global + Node-require).
//
// WICHTIG (klinisch): Die folgenden Formulierungen sind ein Standard-AMDP-STARTER
// zum Bauen/Testen. Der vollständige Textbaustein-Katalog ist fachlich von Miriam
// zu prüfen und zu ergänzen, bevor das Modul klinisch genutzt wird. Keine
// medizinischen Inhalte ungeprüft erfinden.

const BEFUND_CATALOG = [
  {
    id: "bewusstsein",
    label: "Bewusstsein",
    normal: "Bewusstsein klar",
    items: [
      { id: "benommen", label: "benommen", text: "Bewusstsein benommen" },
      { id: "somnolent", label: "somnolent", text: "Bewusstsein somnolent" }
    ]
  },
  {
    id: "orientierung",
    label: "Orientierung",
    normal: "allseits orientiert",
    items: [
      { id: "zeitlich", label: "zeitlich unsicher", text: "zeitlich unsicher orientiert" },
      { id: "ortlich", label: "örtlich unsicher", text: "örtlich unsicher orientiert" }
    ]
  },
  {
    id: "stimmung",
    label: "Vitalität & Stimmung",
    normal: "Stimmung ausgeglichen, Antrieb unauffällig",
    items: [
      { id: "depressiv", label: "niedergeschlagen", text: "Stimmung niedergeschlagen" },
      { id: "antrieb_min", label: "Antrieb reduziert", text: "Antrieb vermindert" }
    ]
  },
  {
    id: "suizidalitaet",
    label: "Eigengefährdung / Suizidalität",
    normal: "keine Hinweise auf akute Suizidalität, glaubhafte Absprachefähigkeit",
    items: [
      { id: "passiv", label: "passive Todesgedanken", text: "passive Todesgedanken ohne Plan oder Absicht" }
    ]
  }
];

function befundDefaultSelection(catalog) {
  const sel = {};
  for (const s of catalog) sel[s.id] = { normal: true, itemIds: [] };
  return sel;
}

function befundSectionText(section, sel) {
  if (!sel || sel.nichtErhebbar) {
    return `${section.label} konnte nicht erhoben werden`;
  }
  const ids = Array.isArray(sel.itemIds) ? sel.itemIds : [];
  if (sel.normal || ids.length === 0) {
    return section.normal;
  }
  return section.items
    .filter((it) => ids.includes(it.id))
    .map((it) => it.text)
    .join("; ");
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { BEFUND_CATALOG, befundDefaultSelection, befundSectionText };
}
