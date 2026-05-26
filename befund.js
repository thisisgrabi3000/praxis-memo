// befund.js — Psychopathologischer Befund: Katalog + Fließtext-Engine.
// DOM-frei, dual-mode (Browser-Global + Node-require).
//
// WICHTIG (klinisch): Dieser Katalog ist ein fachlicher ENTWURF auf Basis der
// gängigen AMDP-/psychopathologischen Nomenklatur. Er ist von Miriam fachlich zu
// PRÜFEN und freizugeben, bevor das Modul klinisch genutzt wird. Eigene
// Formulierungen (NICHT die geschützten Texte / das PPB3-System von Befundomat).
//
// Struktur: Sektion → group (Farbgruppe) + icon + normal + clusters[] → items[].
// Auswahl je Sektion: { normal, itemIds[], freitext?{clusterId:text}, nichtErhebbar? }.

const BEFUND_CATALOG = [
  {
    id: "bewusstsein", label: "Bewusstsein", group: "kognitiv", icon: "bewusstsein",
    normal: "Bewusstsein klar",
    clusters: [
      { id: "quant", label: "Quantitatives Bewusstsein", items: [
        { id: "benommen", label: "benommen", text: "Bewusstsein benommen" },
        { id: "somnolent", label: "somnolent", text: "Bewusstsein somnolent" },
        { id: "soporos", label: "soporös", text: "Bewusstsein soporös" }
      ] },
      { id: "qual", label: "Qualitatives Bewusstsein", items: [
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
        { id: "einschlaf", label: "Einschlafstörung", text: "Einschlafstörung" },
        { id: "durchschlaf", label: "Durchschlafstörung", text: "Durchschlafstörung" },
        { id: "frueherwachen", label: "Früherwachen", text: "morgendliches Früherwachen" }
      ] },
      { id: "appetenz", label: "Appetenz & Vegetativum", items: [
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
        { id: "depressiv", label: "niedergeschlagen", text: "Stimmung niedergeschlagen" },
        { id: "gedrueckt", label: "gedrückt", text: "Stimmung gedrückt" },
        { id: "dysphorisch", label: "dysphorisch", text: "Stimmung dysphorisch" },
        { id: "gehoben", label: "gehoben/euphorisch", text: "Stimmung gehoben" }
      ] },
      { id: "antrieb", label: "Antrieb & Vitalität", items: [
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
        { id: "wahnstimmung", label: "Wahnstimmung", text: "Wahnstimmung" },
        { id: "beziehungswahn", label: "Beziehungswahn", text: "Beziehungserleben mit Wahncharakter" },
        { id: "verfolgungswahn", label: "Verfolgungswahn", text: "Verfolgungserleben mit Wahncharakter" },
        { id: "groessenwahn", label: "Größenideen", text: "Größenideen" }
      ] },
      { id: "ich", label: "Ich-Störungen", items: [
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
  const itemTexts = befundSectionItems(section)
    .filter((it) => ids.includes(it.id))
    .map((it) => it.text);
  const freitexte = sel.freitext
    ? Object.values(sel.freitext).map((t) => (t || "").trim()).filter(Boolean)
    : [];
  const parts = itemTexts.concat(freitexte);
  if (sel.normal || parts.length === 0) {
    return section.normal;
  }
  return parts.join("; ");
}

function befundFliesstext(catalog, selection) {
  return catalog
    .map((section) => {
      const raw = befundSectionText(section, (selection || {})[section.id] || { normal: true, itemIds: [] });
      const trimmed = raw.trim();
      return trimmed.endsWith(".") ? trimmed : `${trimmed}.`;
    })
    .join(" ");
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { BEFUND_CATALOG, befundSectionItems, befundDefaultSelection, befundSectionText, befundFliesstext };
}
