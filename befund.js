// befund.js — Psychopathologischer Befund: Katalog + Fließtext-Engine.
// DOM-frei, dual-mode (Browser-Global + Node-require).
//
// WICHTIG (klinisch): Dieser Katalog ist ein fachlicher ENTWURF auf Basis der
// gängigen AMDP-/psychopathologischen Nomenklatur. Er ist von Miriam fachlich zu
// PRÜFEN und freizugeben, bevor das Modul klinisch genutzt wird. Eigene
// Formulierungen (NICHT die geschützten Texte / das PPB3-System von Befundomat).
//
// Modell: jede Sektion hat clusters[] mit items[]. Ein Item mit normal:true ist der
// "unauffällige" Punkt eines Clusters (ankreuzbar). "Normalbefund" hakt die Normal-Items
// an. Cluster-Logik: Abweichung anhaken entfernt das Normal-Item des Clusters; Normal-Item
// anhaken entfernt die Abweichungen des Clusters. Der Fließtext einer Sektion ist
// section.normal (Normalbefund-Satz), solange keine Abweichung/Freitext gewählt ist —
// sonst die Texte der gewählten Abweichungen (+ Freitext). Normal-Items liefern keinen
// eigenen Fließtext (rein visuell).
// Auswahl je Sektion: { normal, itemIds[], freitext?{clusterId:text}, nichtErhebbar? }.

const BEFUND_CATALOG = [
  {
    id: "bewusstsein", label: "Bewusstsein", group: "kognitiv", icon: "bewusstsein",
    normal: "Bewusstsein klar",
    clusters: [
      { id: "quant", label: "Quantitatives Bewusstsein", items: [
        { id: "n_wach", label: "wach", text: "wach", normal: true },
        { id: "benommen", label: "benommen", text: "Bewusstsein benommen" },
        { id: "somnolent", label: "somnolent", text: "Bewusstsein somnolent" },
        { id: "soporos", label: "soporös", text: "Bewusstsein soporös" }
      ] },
      { id: "qual", label: "Qualitatives Bewusstsein", items: [
        { id: "n_klar", label: "bewusstseinsklar", text: "bewusstseinsklar", normal: true },
        { id: "getruebt", label: "getrübt", text: "Bewusstsein getrübt" },
        { id: "eingeengt", label: "eingeengt", text: "Bewusstsein eingeengt" }
      ] }
    ]
  },
  {
    id: "orientierung", label: "Orientierung", group: "kognitiv", icon: "orientierung",
    normal: "allseits orientiert (zeitlich, örtlich, situativ und zur Person)",
    clusters: [
      { id: "main", label: "Orientierung", items: [
        { id: "n_orientiert", label: "allseits orientiert", text: "allseits orientiert", normal: true },
        { id: "zeitlich", label: "zeitlich unsicher", text: "zeitlich unsicher orientiert" },
        { id: "ortlich", label: "örtlich unsicher", text: "örtlich unsicher orientiert" },
        { id: "situativ", label: "situativ unsicher", text: "situativ unsicher orientiert" },
        { id: "person", label: "zur Person unsicher", text: "zur Person unsicher orientiert" }
      ] }
    ]
  },
  {
    id: "aufmerksamkeit_gedaechtnis", label: "Konzentration & Gedächtnis", group: "kognitiv", icon: "gedaechtnis",
    normal: "Aufmerksamkeit, Konzentration und Gedächtnis ungestört",
    clusters: [
      { id: "main", label: "Konzentration & Gedächtnis", items: [
        { id: "n_kognitiv_ok", label: "ungestört", text: "ungestört", normal: true },
        { id: "konzentration", label: "Konzentration vermindert", text: "Konzentration herabgesetzt" },
        { id: "auffassung", label: "Auffassung erschwert", text: "Auffassung erschwert" },
        { id: "merkfaehigkeit", label: "Merkfähigkeit reduziert", text: "Merkfähigkeit beeinträchtigt" },
        { id: "kurzzeit", label: "Kurzzeitgedächtnis beeinträchtigt", text: "Kurzzeitgedächtnis beeinträchtigt" },
        { id: "mnestisch", label: "mnestische Lücken", text: "umschriebene mnestische Lücken" }
      ] }
    ]
  },
  {
    id: "formales_denken", label: "Formales Denken", group: "kognitiv", icon: "denken",
    normal: "formales Denken geordnet und kohärent",
    clusters: [
      { id: "main", label: "Formales Denken", items: [
        { id: "n_denken_ok", label: "geordnet", text: "geordnet", normal: true },
        { id: "verlangsamt", label: "verlangsamt", text: "Denken verlangsamt" },
        { id: "eingeengt", label: "eingeengt", text: "Denken inhaltlich eingeengt" },
        { id: "umstaendlich", label: "umständlich", text: "Denken umständlich und weitschweifig" },
        { id: "gehemmt", label: "gehemmt", text: "Denken gehemmt" },
        { id: "ideenflucht", label: "ideenflüchtig", text: "ideenflüchtiges Denken" },
        { id: "abreissen", label: "Gedankenabreißen", text: "Gedankenabreißen" }
      ] }
    ]
  },
  {
    id: "psychomotorik", label: "Psychomotorik", group: "kognitiv", icon: "psychomotorik",
    normal: "Psychomotorik unauffällig",
    clusters: [
      { id: "main", label: "Psychomotorik", items: [
        { id: "n_pm_ok", label: "unauffällig", text: "unauffällig", normal: true },
        { id: "unruhig", label: "unruhig/agitiert", text: "psychomotorisch unruhig" },
        { id: "gehemmt_pm", label: "gehemmt/verlangsamt", text: "psychomotorisch gehemmt" },
        { id: "angespannt", label: "angespannt", text: "psychomotorisch angespannt" }
      ] }
    ]
  },
  {
    id: "erscheinung", label: "Erscheinung", group: "erscheinung", icon: "erscheinung",
    normal: "Erscheinung und Körperpflege unauffällig",
    clusters: [
      { id: "main", label: "Erscheinung", items: [
        { id: "n_ersch_ok", label: "gepflegt", text: "gepflegt", normal: true },
        { id: "pflege", label: "Körperpflege vernachlässigt", text: "Körperpflege vernachlässigt" },
        { id: "kleidung", label: "Kleidung auffällig", text: "Kleidung auffällig oder ungepflegt" }
      ] }
    ]
  },
  {
    id: "kommunikation", label: "Kommunikationsverhalten", group: "erscheinung", icon: "kommunikation",
    normal: "Kontakt- und Kommunikationsverhalten zugewandt und offen",
    clusters: [
      { id: "main", label: "Kommunikationsverhalten", items: [
        { id: "n_komm_ok", label: "zugewandt", text: "zugewandt", normal: true },
        { id: "wortkarg", label: "wortkarg", text: "im Kontakt wortkarg" },
        { id: "misstrauisch", label: "misstrauisch-distanziert", text: "im Kontakt misstrauisch-distanziert" },
        { id: "sprachbarriere", label: "Sprachbarriere", text: "Verständigung durch Sprachbarriere erschwert" }
      ] }
    ]
  },
  {
    id: "psychovegetativum", label: "Psychovegetativum", group: "vegetativ", icon: "vegetativ",
    normal: "vegetativ unauffällig, Schlaf und Appetit ungestört",
    clusters: [
      { id: "schlaf", label: "Schlaf", items: [
        { id: "n_schlaf_ok", label: "Schlaf ungestört", text: "Schlaf ungestört", normal: true },
        { id: "einschlaf", label: "Einschlafstörung", text: "Einschlafstörung" },
        { id: "durchschlaf", label: "Durchschlafstörung", text: "Durchschlafstörung" },
        { id: "frueherwachen", label: "Früherwachen", text: "morgendliches Früherwachen" }
      ] },
      { id: "appetenz", label: "Appetenz & Vegetativum", items: [
        { id: "n_appetit_ok", label: "Appetit ungestört", text: "Appetit ungestört", normal: true },
        { id: "appetit_min", label: "Appetit vermindert", text: "Appetit vermindert" },
        { id: "appetit_plus", label: "Appetit gesteigert", text: "Appetit gesteigert" },
        { id: "libido", label: "Libidoverlust", text: "Libidoverlust" }
      ] }
    ]
  },
  {
    id: "affekt", label: "Affekte & Impulse", group: "vegetativ", icon: "affekt",
    normal: "Affekt schwingungsfähig und im Kontakt moduliert",
    clusters: [
      { id: "main", label: "Affekte & Impulse", items: [
        { id: "n_affekt_ok", label: "schwingungsfähig", text: "schwingungsfähig", normal: true },
        { id: "verflacht", label: "affektarm/verflacht", text: "Affekt verflacht" },
        { id: "labil", label: "affektlabil", text: "Affekt labil" },
        { id: "reizbar", label: "reizbar", text: "vermehrt reizbar" },
        { id: "ambivalent", label: "ambivalent", text: "ambivalent" },
        { id: "inkontinent", label: "Affektinkontinenz", text: "Affektinkontinenz" }
      ] }
    ]
  },
  {
    id: "stimmung", label: "Vitalität & Stimmung", group: "vegetativ", icon: "stimmung",
    normal: "Stimmung ausgeglichen, Antrieb unauffällig",
    clusters: [
      { id: "stimmung", label: "Stimmung", items: [
        { id: "n_stimmung_ok", label: "ausgeglichen", text: "ausgeglichen", normal: true },
        { id: "depressiv", label: "niedergeschlagen", text: "Stimmung niedergeschlagen" },
        { id: "gedrueckt", label: "gedrückt", text: "Stimmung gedrückt" },
        { id: "dysphorisch", label: "dysphorisch", text: "Stimmung dysphorisch" },
        { id: "gehoben", label: "gehoben/euphorisch", text: "Stimmung gehoben" }
      ] },
      { id: "antrieb", label: "Antrieb & Vitalität", items: [
        { id: "n_antrieb_ok", label: "Antrieb unauffällig", text: "Antrieb unauffällig", normal: true },
        { id: "antrieb_min", label: "Antrieb reduziert", text: "Antrieb vermindert" },
        { id: "antrieb_plus", label: "Antrieb gesteigert", text: "Antrieb gesteigert" },
        { id: "anhedonie", label: "Freudlosigkeit/Anhedonie", text: "Freud- und Interesselosigkeit" },
        { id: "hoffnungslos", label: "hoffnungslos", text: "Hoffnungslosigkeit" },
        { id: "insuffizienz", label: "Insuffizienzgefühle", text: "Insuffizienzgefühle" }
      ] }
    ]
  },
  {
    id: "wahrnehmung", label: "Wahrnehmung", group: "psychotisch", icon: "wahrnehmung",
    normal: "keine Hinweise auf Wahrnehmungsstörungen",
    clusters: [
      { id: "main", label: "Wahrnehmung", items: [
        { id: "n_wahr_ok", label: "keine Störungen", text: "keine Störungen", normal: true },
        { id: "akustisch", label: "akustische Halluzinationen", text: "akustische Halluzinationen" },
        { id: "optisch", label: "optische Halluzinationen", text: "optische Halluzinationen" },
        { id: "illusionen", label: "Illusionen", text: "illusionäre Verkennungen" },
        { id: "derealisation", label: "Derealisation", text: "Derealisationserleben" },
        { id: "depersonalisation", label: "Depersonalisation", text: "Depersonalisationserleben" }
      ] }
    ]
  },
  {
    id: "inhaltliches_denken", label: "Inhaltliches Denken & Ich-Störungen", group: "psychotisch", icon: "ichstoerung",
    normal: "kein Anhalt für inhaltliche Denkstörungen, Wahn oder Ich-Störungen",
    clusters: [
      { id: "wahn", label: "Wahn", items: [
        { id: "n_wahn_ok", label: "kein Wahn", text: "kein Wahn", normal: true },
        { id: "wahnstimmung", label: "Wahnstimmung", text: "Wahnstimmung" },
        { id: "beziehungswahn", label: "Beziehungswahn", text: "Beziehungserleben mit Wahncharakter" },
        { id: "verfolgungswahn", label: "Verfolgungswahn", text: "Verfolgungserleben mit Wahncharakter" },
        { id: "groessenwahn", label: "Größenideen", text: "Größenideen" }
      ] },
      { id: "ich", label: "Ich-Störungen", items: [
        { id: "n_ich_ok", label: "keine Ich-Störung", text: "keine Ich-Störung", normal: true },
        { id: "gedankeneingebung", label: "Gedankeneingebung", text: "Erleben von Gedankeneingebung" },
        { id: "gedankenentzug", label: "Gedankenentzug", text: "Erleben von Gedankenentzug" },
        { id: "fremdbeeinflussung", label: "Fremdbeeinflussungserleben", text: "Fremdbeeinflussungserleben" }
      ] }
    ]
  },
  {
    id: "abhaengigkeit", label: "Abhängigkeitserzeugendes Verhalten", group: "psychotisch", icon: "abhaengigkeit",
    normal: "kein Hinweis auf abhängigkeitserzeugendes Verhalten",
    clusters: [
      { id: "main", label: "Abhängigkeitserzeugendes Verhalten", items: [
        { id: "n_abh_ok", label: "kein Hinweis", text: "kein Hinweis", normal: true },
        { id: "alkohol", label: "Alkoholkonsum auffällig", text: "auffälliger Alkoholkonsum" },
        { id: "medikamente", label: "Medikamentenmissbrauch", text: "Hinweise auf Medikamentenmissbrauch" },
        { id: "drogen", label: "Drogenkonsum", text: "Hinweise auf Drogenkonsum" },
        { id: "verhalten", label: "nicht-substanzgebunden", text: "Hinweise auf nicht-substanzgebundenes abhängiges Verhalten" }
      ] }
    ]
  },
  {
    id: "aengste", label: "Ängste", group: "psychotisch", icon: "aengste",
    normal: "keine Hinweise auf Ängste oder Phobien",
    clusters: [
      { id: "main", label: "Ängste", items: [
        { id: "n_aengste_ok", label: "keine Ängste", text: "keine Ängste", normal: true },
        { id: "generalisiert", label: "generalisierte Ängstlichkeit", text: "generalisierte Ängstlichkeit" },
        { id: "panik", label: "Panikattacken", text: "Panikattacken" },
        { id: "sozial", label: "soziale Ängste", text: "soziale Ängste" },
        { id: "phobisch", label: "phobische Vermeidung", text: "phobisches Vermeidungsverhalten" }
      ] }
    ]
  },
  {
    id: "zwaenge", label: "Zwänge", group: "psychotisch", icon: "zwaenge",
    normal: "keine Zwangsgedanken oder Zwangshandlungen",
    clusters: [
      { id: "main", label: "Zwänge", items: [
        { id: "n_zwaenge_ok", label: "keine Zwänge", text: "keine Zwänge", normal: true },
        { id: "gedanken", label: "Zwangsgedanken", text: "Zwangsgedanken" },
        { id: "impulse", label: "Zwangsimpulse", text: "Zwangsimpulse" },
        { id: "handlungen", label: "Zwangshandlungen", text: "Zwangshandlungen" }
      ] }
    ]
  },
  {
    id: "selbstwert_einsicht", label: "Selbstwert & Krankheitseinstellung", group: "psychotisch", icon: "selbstwert",
    normal: "Selbstwert stabil, Krankheitseinsicht und Behandlungsmotivation vorhanden",
    clusters: [
      { id: "main", label: "Selbstwert & Krankheitseinstellung", items: [
        { id: "n_selbst_ok", label: "stabil/einsichtig", text: "stabil/einsichtig", normal: true },
        { id: "selbstwert", label: "Selbstwert vermindert", text: "vermindertes Selbstwertgefühl" },
        { id: "schuld", label: "Schuldgefühle", text: "Schuldgefühle" },
        { id: "einsicht", label: "Krankheitseinsicht eingeschränkt", text: "eingeschränkte Krankheitseinsicht" },
        { id: "motivation", label: "Behandlungsmotivation eingeschränkt", text: "eingeschränkte Behandlungsmotivation" }
      ] }
    ]
  },
  {
    id: "eigen_fremdgefaehrdung", label: "Eigen- & Fremdgefährdung", group: "gefahr", icon: "gefahr",
    normal: "keine Hinweise auf akute Suizidalität oder Fremdgefährdung, glaubhafte Absprachefähigkeit",
    clusters: [
      { id: "main", label: "Eigen- & Fremdgefährdung", items: [
        { id: "n_gefahr_ok", label: "keine akute Gefährdung", text: "keine akute Gefährdung", normal: true },
        { id: "passiv", label: "passive Todesgedanken", text: "passive Todesgedanken ohne Plan oder Absicht" },
        { id: "aktiv", label: "aktive Suizidgedanken", text: "aktive Suizidgedanken" },
        { id: "absicht", label: "Suizidabsicht/-plan", text: "konkrete Suizidabsicht oder -pläne" },
        { id: "selbstverletzung", label: "Selbstverletzung", text: "selbstverletzendes Verhalten" },
        { id: "fremd", label: "Fremdgefährdung", text: "Hinweise auf Fremdgefährdung" }
      ] }
    ]
  },
  {
    id: "globalparameter", label: "Globalparameter", group: "kognitiv", icon: "global",
    normal: "im Alltag handlungsfähig, soziale Teilhabe erhalten, kein relevanter Leidensdruck angegeben",
    clusters: [
      { id: "main", label: "Globalparameter", items: [
        { id: "n_global_ok", label: "handlungsfähig", text: "handlungsfähig", normal: true },
        { id: "leidensdruck", label: "deutlicher Leidensdruck", text: "deutlicher subjektiver Leidensdruck" },
        { id: "rueckzug", label: "sozialer Rückzug", text: "sozialer Rückzug" },
        { id: "alltag", label: "Alltagsbewältigung beeinträchtigt", text: "Beeinträchtigung der Alltagsbewältigung" }
      ] }
    ]
  }
];

function befundSectionItems(section) {
  return (section.clusters || []).reduce((acc, c) => acc.concat(c.items || []), []);
}

function befundNormalItemIds(section) {
  return befundSectionItems(section).filter((it) => it.normal).map((it) => it.id);
}

function befundSectionById(catalog, sectionId) {
  return catalog.find((s) => s.id === sectionId) || null;
}

function befundClusterOfItem(section, itemId) {
  return (section.clusters || []).find((c) => (c.items || []).some((it) => it.id === itemId)) || null;
}

function befundHasFreitext(freitext) {
  return Boolean(freitext) && Object.values(freitext).some((t) => (t || "").trim());
}

// Sektion ist "normal", wenn exakt die Normal-Items angehakt sind und kein Freitext steht.
function befundIsSectionNormal(section, itemIds, freitext) {
  const normalIds = befundNormalItemIds(section).slice().sort();
  const cur = (itemIds || []).slice().sort();
  const same = normalIds.length === cur.length && normalIds.every((id, i) => id === cur[i]);
  return same && !befundHasFreitext(freitext);
}

function befundDefaultSelection(catalog) {
  const sel = {};
  for (const s of catalog) sel[s.id] = { normal: true, itemIds: befundNormalItemIds(s), freitext: {} };
  return sel;
}

function befundSetAllNormal(catalog) {
  return befundDefaultSelection(catalog);
}

function befundSetNormal(selection, sectionId, catalog) {
  const section = befundSectionById(catalog, sectionId);
  const itemIds = section ? befundNormalItemIds(section) : [];
  return { ...selection, [sectionId]: { normal: true, itemIds, freitext: {} } };
}

function befundToggleItem(selection, sectionId, itemId, catalog) {
  const section = befundSectionById(catalog, sectionId);
  if (!section) return selection;
  const cur = selection[sectionId] || { normal: true, itemIds: befundNormalItemIds(section), freitext: {} };
  const cluster = befundClusterOfItem(section, itemId);
  const clusterIds = cluster ? cluster.items.map((it) => it.id) : [];
  const clusterNormalIds = cluster ? cluster.items.filter((it) => it.normal).map((it) => it.id) : [];
  const isNormalItem = clusterNormalIds.includes(itemId);
  let itemIds = (cur.itemIds || []).slice();

  if (itemIds.includes(itemId)) {
    itemIds = itemIds.filter((x) => x !== itemId);
  } else if (isNormalItem) {
    // Normal-Item an -> alle anderen Items des Clusters weg
    itemIds = itemIds.filter((x) => !clusterIds.includes(x));
    itemIds.push(itemId);
  } else {
    // Abweichung an -> Normal-Item(s) des Clusters weg
    itemIds = itemIds.filter((x) => !clusterNormalIds.includes(x));
    itemIds.push(itemId);
  }
  const freitext = cur.freitext || {};
  return { ...selection, [sectionId]: { normal: befundIsSectionNormal(section, itemIds, freitext), itemIds, freitext } };
}

function befundSetFreitext(selection, sectionId, clusterId, text, catalog) {
  const section = catalog ? befundSectionById(catalog, sectionId) : null;
  const cur = selection[sectionId] || { normal: true, itemIds: [], freitext: {} };
  const freitext = { ...(cur.freitext || {}), [clusterId]: text };
  const itemIds = cur.itemIds || [];
  const normal = section ? befundIsSectionNormal(section, itemIds, freitext) : false;
  return { ...selection, [sectionId]: { normal, itemIds, freitext } };
}

function befundApplySuggestions(selection, suggestions, catalog) {
  const result = { ...selection };
  for (const section of catalog) {
    const suggested = (suggestions || {})[section.id];
    if (!Array.isArray(suggested) || suggested.length === 0) continue;
    const validDeviationIds = befundSectionItems(section)
      .filter((it) => !it.normal && suggested.includes(it.id))
      .map((it) => it.id);
    if (validDeviationIds.length === 0) continue;
    const cur = result[section.id] || { normal: true, itemIds: befundNormalItemIds(section), freitext: {} };
    let itemIds = (cur.itemIds || []).slice();
    for (const devId of validDeviationIds) {
      const cluster = befundClusterOfItem(section, devId);
      const clusterNormalIds = cluster ? cluster.items.filter((it) => it.normal).map((it) => it.id) : [];
      itemIds = itemIds.filter((x) => !clusterNormalIds.includes(x));
      if (!itemIds.includes(devId)) itemIds.push(devId);
    }
    result[section.id] = { normal: false, itemIds, freitext: cur.freitext || {} };
  }
  return result;
}

function befundSectionText(section, sel) {
  if (!sel || sel.nichtErhebbar) {
    return `${section.label} konnte nicht erhoben werden`;
  }
  const ids = Array.isArray(sel.itemIds) ? sel.itemIds : [];
  const deviationTexts = befundSectionItems(section)
    .filter((it) => !it.normal && ids.includes(it.id))
    .map((it) => it.text);
  const freitexte = sel.freitext
    ? Object.values(sel.freitext).map((t) => (t || "").trim()).filter(Boolean)
    : [];
  const parts = deviationTexts.concat(freitexte);
  if (parts.length === 0) {
    return section.normal;
  }
  return parts.join("; ");
}

function befundFliesstext(catalog, selection) {
  const joined = catalog
    .map((section) => {
      const raw = befundSectionText(section, (selection || {})[section.id] || { normal: true, itemIds: [] });
      const trimmed = raw.trim();
      return trimmed.endsWith(".") ? trimmed : `${trimmed}.`;
    })
    .join(" ");
  return capitalizeSentences(joined);
}

function capitalizeSentences(text) {
  if (!text) return text;
  return text
    .replace(/^\s*(\p{Ll})/u, (_, c) => c.toUpperCase())
    .replace(/([.!?]\s+)(\p{Ll})/gu, (_, sep, c) => sep + c.toUpperCase());
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    BEFUND_CATALOG, befundSectionItems, befundNormalItemIds, befundSectionById,
    befundClusterOfItem, befundIsSectionNormal, befundDefaultSelection, befundSetAllNormal,
    befundSetNormal, befundToggleItem, befundSetFreitext, befundApplySuggestions,
    befundSectionText, befundFliesstext
  };
}
