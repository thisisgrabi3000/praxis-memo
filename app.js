// ============================================================
// CONSTANTS
// ============================================================
const STORAGE_KEY = "praxismemo-v8";
const SERVER_SAVE_DELAY = 650;
const CASE_STATUS_VALUES = ["aktiv", "pausiert", "abgeschlossen", "archiviert"];
const CASE_STATUS_LABELS = {
  aktiv: "Aktiv",
  pausiert: "Pausiert",
  abgeschlossen: "Abgeschlossen",
  archiviert: "Archiviert"
};
const MEMORY_RELEVANCE_VALUES = ["wichtig", "normal", "beobachten", "historisch"];
const MEMORY_RELEVANCE_LABELS = {
  wichtig: "wichtig",
  normal: "normal",
  beobachten: "beobachten",
  historisch: "historisch"
};
const MEMORY_HISTORY_DAYS = 90;

function normalizeEditStatus(value, fallback = "Offen") {
  const normalized = String(value || fallback).toLowerCase().replace("ü", "ue");
  if (normalized === "geprueft") return "Geprüft";
  if (normalized === "entwurf") return "Entwurf";
  return "Offen";
}

// ============================================================
// DATA FACTORIES
// ============================================================

function makeId(prefix) {
  const uuid = window.crypto?.randomUUID?.();
  const suffix = uuid || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${suffix}`;
}

function createMemoryState(raw = {}) {
  return {
    risks: Array.isArray(raw.risks) ? raw.risks.map(normalizeMemoryItem) : [],
    protectiveFactors: Array.isArray(raw.protectiveFactors) ? raw.protectiveFactors.map(normalizeMemoryItem) : [],
    openQuestions: Array.isArray(raw.openQuestions) ? raw.openQuestions.map(normalizeMemoryItem) : [],
    agreements: Array.isArray(raw.agreements) ? raw.agreements.map(normalizeMemoryItem) : [],
    sensitiveTopics: Array.isArray(raw.sensitiveTopics) ? raw.sensitiveTopics.map(normalizeMemoryItem) : [],
    reliefNotes: Array.isArray(raw.reliefNotes) ? raw.reliefNotes.map(normalizeMemoryItem) : []
  };
}

function normalizeMemoryItem(raw = {}) {
  raw = raw || {};
  const relevance = MEMORY_RELEVANCE_VALUES.includes(raw.relevance) ? raw.relevance : "normal";
  return {
    id: raw.id || makeId("mem"),
    text: raw.text || "",
    status: raw.status || "offen",
    relevance,
    origin: raw.origin === "manuell" ? "manuell" : "ki",
    sourceSessionId: raw.sourceSessionId || "",
    sourceDate: raw.sourceDate || "",
    resolvedAt: raw.resolvedAt || "",
    resolvedSessionId: raw.resolvedSessionId || "",
    createdAt: raw.createdAt || new Date().toISOString(),
    lastSeenAt: raw.lastSeenAt || raw.createdAt || new Date().toISOString()
  };
}

function createEmptyPatient(uid, id) {
  const safeUid = uid || makeId("p");
  return {
    uid: safeUid,
    id,
    status: "Offen",
    caseStatus: "aktiv",
    nextDate: "",
    nextTime: "",
    focus: "",
    agreement: "",
    open: "",
    transcript: "",
    summary: { core: "", agreement: "", open: "", watch: "" },
    prep: { anchor: "", opening: "", caution: "" },
    closure: { summary: "", outcome: "", recommendation: "" },
    memory: createMemoryState(),
    currentSessionId: makeId("session"),
    pendingStructure: null,
    resolvedSuggestions: [],
    befund: null,
    sessions: [],
    archived: false
  };
}

function createSession({ id, date, time, status = "Geprüft", focus, agreement, open, watch, transcript, summary, prep, befund }) {
  // Keine klinischen Inhalte fabrizieren: leere Felder bleiben leer. Platzhalter
  // oder erfundene Transkripte wären medizinisch/rechtlich nicht vertretbar.
  const session = {
    id,
    date,
    time: time || "08:00",
    status,
    focus: focus || "",
    transcript: transcript || "",
    summary: {
      core: summary?.core || "",
      agreement: summary?.agreement || agreement || "",
      open: summary?.open || open || "",
      watch: summary?.watch || watch || ""
    },
    prep: {
      anchor: prep?.anchor || "",
      opening: prep?.opening || "",
      caution: prep?.caution || ""
    }
  };
  const befundSnapshot = cloneBefundSelection(befund);
  if (befundSnapshot) session.befund = befundSnapshot;
  return session;
}

function normalizePatient(raw = {}) {
  raw = raw || {};
  const uid = raw.uid || makeId("p");
  const caseStatus = normalizeCaseStatus(raw);
  return {
    uid,
    id: raw.id || "P-?",
    status: normalizeEditStatus(raw.status),
    caseStatus,
    // Migrate from old followUpDate/followUpTime fields
    nextDate: raw.nextDate || raw.followUpDate || "",
    nextTime: raw.nextTime || raw.followUpTime || "",
    focus: raw.focus || "",
    agreement: raw.agreement || "",
    open: raw.open || "",
    transcript: raw.transcript || "",
    summary: {
      core: raw.summary?.core || "",
      agreement: raw.summary?.agreement || raw.agreement || "",
      open: raw.summary?.open || raw.open || "",
      watch: raw.summary?.watch || ""
    },
    prep: {
      anchor: raw.prep?.anchor || raw.agreement || "",
      opening: raw.prep?.opening || "",
      caution: raw.prep?.caution || "Fachlich prüfen, bevor Inhalte übernommen werden."
    },
    closure: normalizeClosure(raw.closure || {}),
    memory: createMemoryState(raw.memory || {}),
    currentSessionId: raw.currentSessionId || makeId("session"),
    pendingStructure: normalizePendingStructure(raw.pendingStructure),
    resolvedSuggestions: Array.isArray(raw?.resolvedSuggestions) ? raw.resolvedSuggestions : [],
    befund: cloneBefundSelection(raw.befund),
    sessions: Array.isArray(raw.sessions) ? raw.sessions.map(normalizeSession) : [],
    archived: caseStatus === "archiviert"
  };
}

function normalizeCaseStatus(raw = {}) {
  const value = String(raw.caseStatus || raw.lifecycleStatus || "").toLowerCase();
  if (CASE_STATUS_VALUES.includes(value)) return value;
  return raw.archived ? "archiviert" : "aktiv";
}

function normalizeClosure(raw = {}) {
  return {
    summary: String(raw.summary || ""),
    outcome: String(raw.outcome || ""),
    recommendation: String(raw.recommendation || "")
  };
}

function normalizePendingStructure(raw) {
  if (!raw || typeof raw !== "object" || !raw.result) return null;
  return {
    id: raw.id || makeId("pending"),
    createdAt: raw.createdAt || new Date().toISOString(),
    overwriteLabels: Array.isArray(raw.overwriteLabels) ? raw.overwriteLabels : [],
    resolved: Array.isArray(raw.resolved) ? raw.resolved : [],
    result: {
      core: String(raw.result.core || ""),
      agreement: String(raw.result.agreement || ""),
      open: String(raw.result.open || ""),
      watch: String(raw.result.watch || "")
    }
  };
}

function normalizeSession(s = {}) {
  s = s || {};
  const session = createSession({
    id: s.id || makeId("session"),
    date: s.date || todayIso(),
    time: s.time || "08:00",
    status: normalizeEditStatus(s.status, "Geprüft"),
    focus: s.focus,
    transcript: s.transcript,
    summary: s.summary,
    prep: s.prep,
    befund: s.befund
  });
  // Append-only Revisionshistorie erhalten (createSession kennt diese Felder nicht).
  if (Array.isArray(s.revisions) && s.revisions.length) session.revisions = s.revisions.map(normalizeSession);
  if (s.revisedAt) session.revisedAt = s.revisedAt;
  return session;
}

// ============================================================
// STATE
// ============================================================
let patients = loadPatients();
let selectedUid = patients[0]?.uid || null;
let activeStep = "record";
let viewSessionId = null;
let isRecording = false;
let timer = null;
let seconds = 0;
let activeDictationTarget = null;
let activeFieldButton = null;
let serverStorageAvailable = false;
let serverSaveTimer = null;
let kiAvailable = null; // null=unchecked, true, false
let whisperAvailable = null; // null=unchecked, true, false
let mediaRecorder = null;
let audioChunks = [];

// ============================================================
// STORAGE
// ============================================================

function loadPatients() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    const rawPatients = Array.isArray(parsed) ? parsed : [];
    if (!rawPatients.length) return [];
    const cleaned = removeLegacyExamplePatients(rawPatients);
    const normalized = cleaned.map(normalizePatient);
    if (cleaned.length !== rawPatients.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    }
    return normalized;
  } catch {
    return [];
  }
}

function isLegacyExamplePatient(raw) {
  const transcript = String(raw?.transcript || "");
  return raw?.uid === "test"
    && raw?.id === "P-001"
    && transcript.includes("Panikattacke hatte")
    && transcript.includes("Supermarkt an der Kasse");
}

function removeLegacyExamplePatients(list) {
  if (!Array.isArray(list)) return [];
  const cleaned = list.filter((patient) => !isLegacyExamplePatient(patient));
  if (cleaned.length !== list.length) {
    console.warn(`[praxis-memo] Demo-Beispielpatient (uid=test, P-001) entfernt; ${list.length - cleaned.length} Datensatz/Datensätze überschrieben.`);
  }
  return cleaned;
}

function savePatients() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(patients));
  } catch {
    showToast("Speicher voll. Bitte über 'Backup erstellen' sichern.");
  }
  queueServerSave();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function cloneBefundSelection(selection) {
  if (!selection || typeof selection !== "object" || Array.isArray(selection)) return null;
  return clone(selection);
}

function carriedBefundSelection(patient, latestSession) {
  return cloneBefundSelection(latestSession?.befund) || cloneBefundSelection(patient?.befund);
}

function getStoragePayload() {
  return { schema: "praxismemo-backup", version: 2, savedAt: new Date().toISOString(), patients };
}

function queueServerSave() {
  if (!serverStorageAvailable) return;
  window.clearTimeout(serverSaveTimer);
  serverSaveTimer = window.setTimeout(saveToServer, SERVER_SAVE_DELAY);
}

async function saveToServer() {
  if (!serverStorageAvailable) return;
  try {
    const r = await fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(getStoragePayload())
    });
    if (!r.ok) throw new Error();
    renderStorageStatus();
  } catch {
    serverStorageAvailable = false;
    renderStorageStatus();
  }
}

async function hydrateFromServer() {
  if (window.location.protocol === "file:") {
    renderStorageStatus();
    return;
  }
  try {
    const r = await fetch("/api/load", { cache: "no-store" });
    if (!r.ok) throw new Error();
    const payload = await r.json();
    serverStorageAvailable = true;
    const serverPatientsRaw = Array.isArray(payload.patients) ? payload.patients : [];
    const serverPatients = removeLegacyExamplePatients(serverPatientsRaw);
    if (serverPatientsRaw.length) {
      patients = serverPatients.map(normalizePatient);
      if (!patients.some((p) => p.uid === selectedUid)) {
        selectedUid = patients[0]?.uid || null;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(patients));
      if (serverPatients.length !== serverPatientsRaw.length) queueServerSave();
      renderAll();
    } else if (patients.length) {
      // Server leer, lokal aber Daten → einmalig hochschieben.
      // Bei beidseits leerem Stand keinen leeren Save triggern (würde leeres Backup erzeugen).
      queueServerSave();
    }
  } catch {
    serverStorageAvailable = false;
  }
  renderStorageStatus();
}

function renderStorageStatus() {
  if (!storageStatus) return;
  storageStatus.textContent = serverStorageAvailable
    ? "Lokale Ablage aktiv — Daten werden im App-Ordner gespeichert."
    : "Browser-Speicherung aktiv. App über 'Start Praxis Memo.bat' öffnen für automatische Backups.";
}

// ============================================================
// BACKUP & RESTORE
// ============================================================

async function createManualBackup() {
  if (serverStorageAvailable) {
    try {
      const r = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(getStoragePayload())
      });
      const result = await r.json();
      if (r.ok && result.ok) {
        showToast(`Backup gespeichert: ${result.fileName}`);
        downloadBackupFile();
        return;
      }
    } catch {}
  }
  downloadBackupFile();
  showToast("Backup als Datei heruntergeladen.");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke verzögert: ein sofortiges Revoke kann den Download-Fetch abbrechen.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function downloadBackupFile() {
  const payload = getStoragePayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  downloadBlob(blob, `praxismemo-backup-${stamp}.json`);
}

async function restoreFromFile(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (data.schema !== "praxismemo-backup" || !Array.isArray(data.patients)) {
      throw new Error("Kein gültiges Praxis-Memo-Backup");
    }
    const dateStr = data.savedAt ? formatDateShort(data.savedAt.slice(0, 10)) : "unbekannt";
    if (!window.confirm(`Backup vom ${dateStr} wiederherstellen?\nAktuelle Daten werden überschrieben.`)) return;
    patients = data.patients.map(normalizePatient);
    selectedUid = patients[0]?.uid || null;
    savePatients();
    renderAll();
    showToast("Backup wiederhergestellt.");
  } catch {
    showToast("Datei nicht lesbar oder kein gültiges Praxis-Memo-Backup.");
  }
}

// ============================================================
// DOM REFS
// ============================================================
const patientList = document.querySelector("#patientList");
const patientSearch = document.querySelector("#patientSearch");
const patientIdInput = document.querySelector("#patientIdInput");
const patientMeta = document.querySelector("#patientMeta");
const statusSelect = document.querySelector("#statusSelect");
const caseStatusSelect = document.querySelector("#caseStatusSelect");
const recordButton = document.querySelector("#recordButton");
const recordStatus = document.querySelector("#recordStatus");
const recordTimer = document.querySelector("#recordTimer");
const waveform = document.querySelector("#waveform");
const transcriptInput = document.querySelector("#transcriptInput");
const processingStatus = document.querySelector("#processingStatus");
const structureButton = document.querySelector("#structureButton");
const approveButton = document.querySelector("#approveButton");
const newSessionButton = document.querySelector("#newSessionButton");
const exportPatientButton = document.querySelector("#exportPatientButton");
const workExportPatientButton = document.querySelector("#workExportPatientButton");
const storageStatus = document.querySelector("#storageStatus");
const backupButton = document.querySelector("#backupButton");
const restoreButton = document.querySelector("#restoreButton");
const restoreInput = document.querySelector("#restoreInput");
const addPatientButton = document.querySelector("#addPatientButton");
const deletePatientButton = document.querySelector("#deletePatientButton");
const archivePatientButton = document.querySelector("#archivePatientButton");
const quickPrep = document.querySelector("#quickPrep");
const riskAlerts = document.querySelector("#riskAlerts");
const sessionCountBadge = document.querySelector("#sessionCountBadge");
const historyBook = document.querySelector("#historyBook");
const sessionViewPanel = document.querySelector("#sessionViewPanel");
const openPoints = document.querySelector("#openPoints");
const openCountBadge = document.querySelector("#openCountBadge");
const openAddForm = document.querySelector("#openAddForm");
const openAddInput = document.querySelector("#openAddInput");
const befundPanel = document.querySelector("#befundPanel");
const kiStatus = document.querySelector("#kiStatus");
const lengthWarning = document.querySelector("#lengthWarning");
const toast = document.querySelector("#toast");
let kiMode = "local"; // immer lokal (Ollama, on-device)
let kiModel = "";
const fieldDictationTargets = document.querySelectorAll("[data-field], [data-summary], [data-prep], [data-closure]");

// ============================================================
// DATE HELPERS
// ============================================================

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function tomorrowIso() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateShort(value) {
  if (!value) return "Datum offen";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

function formatDateLong(value) {
  if (!value) return "Datum offen";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  const weekdays = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  return `${weekdays[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

function formatDateGroup(dateStr) {
  if (!dateStr) return "Termin offen";
  const today = todayIso();
  if (dateStr === today) return "Heute";
  if (dateStr === tomorrowIso()) return "Morgen";
  return formatDateLong(dateStr);
}

function formatNextAppointment(patient) {
  if (!patient.nextDate && !patient.nextTime) return "Kein Folgetermin eingetragen";
  if (!patient.nextDate) return `Nächster Termin: ${patient.nextTime || "Uhrzeit offen"}`;
  const time = patient.nextTime || "Uhrzeit offen";
  return `Nächster Termin: ${formatDateLong(patient.nextDate)}, ${time}`;
}

function formatSyncTime(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "gerade";
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return sameDay ? `heute, ${time}` : `${formatDateShort(d.toISOString().slice(0, 10))}, ${time}`;
}

// ============================================================
// RENDER
// ============================================================

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clip(value, length = 84) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

function setValue(element, value) {
  if (document.activeElement === element) return;
  element.value = value;
}

function getPatient() {
  return patients.find((p) => p.uid === selectedUid) || patients[0] || null;
}

function renderAll() {
  const patient = getPatient();

  if (!patient) {
    renderEmptyState();
    renderPatients();
    setActiveStep(activeStep);
    return;
  }

  document.body.classList.remove("no-patient");
  resolvePendingStructure(patient);

  deletePatientButton.disabled = false;
  if (exportPatientButton) exportPatientButton.disabled = false;
  if (workExportPatientButton) workExportPatientButton.disabled = false;
  if (caseStatusSelect) caseStatusSelect.value = patient.caseStatus || "aktiv";
  if (archivePatientButton) {
    archivePatientButton.disabled = false;
    const label = patient.caseStatus === "archiviert" ? "Reaktivieren" : "Archivieren";
    archivePatientButton.title = label;
    const archiveLabelEl = archivePatientButton.querySelector("[data-label]");
    if (archiveLabelEl) archiveLabelEl.textContent = label;
  }
  setValue(patientIdInput, patient.id);
  statusSelect.value = patient.status;
  patientMeta.textContent = formatNextAppointment(patient);

  document.querySelectorAll("[data-field]").forEach((field) => {
    setValue(field, patient[field.dataset.field] ?? "");
  });
  document.querySelectorAll("[data-summary]").forEach((field) => {
    setValue(field, patient.summary[field.dataset.summary] ?? "");
  });
  document.querySelectorAll("[data-prep]").forEach((field) => {
    setValue(field, patient.prep[field.dataset.prep] ?? "");
  });
  document.querySelectorAll("[data-closure]").forEach((field) => {
    setValue(field, patient.closure?.[field.dataset.closure] ?? "");
  });

  processingStatus.textContent = patient.status === "Geprüft" ? "Fachlich geprüft" : "Editierbarer Entwurf";
  updateTranscriptLengthWarning(patient.transcript);
  renderStorageStatus();
  renderQuickPrep(patient);
  renderRiskAlerts(patient);
  renderHistoryBook(patient);
  renderOpenPoints(patient);
  renderBefund(patient);
  renderPatients();
  setActiveStep(activeStep);

  if (viewSessionId && (patient.sessions || []).some((s) => s.id === viewSessionId)) {
    document.body.classList.add("session-viewing");
    renderSessionViewPanel(patient);
  } else {
    viewSessionId = null;
    document.body.classList.remove("session-viewing");
    if (sessionViewPanel) sessionViewPanel.innerHTML = "";
  }
}

// ============================================================
// BEFUND
// ============================================================

function renderBefund(patient) {
  if (!befundPanel) return;
  if (!patient) { befundPanel.innerHTML = ""; return; }

  // Lazy-Initialisierung der Auswahl
  if (!patient.befund) {
    patient.befund = befundDefaultSelection(BEFUND_CATALOG);
  }
  const sel = patient.befund;
  const fliesstext = befundFliesstext(BEFUND_CATALOG, sel);

  // Welche <details> sind gerade offen? Merken, damit sie nach Re-Render offen bleiben.
  const openIds = new Set();
  befundPanel.querySelectorAll("details.befund-section[data-sid][open]").forEach((d) => {
    openIds.add(d.dataset.sid);
  });

  const sectionsHtml = BEFUND_CATALOG.map((section) => {
    const secSel = sel[section.id] || { normal: true, itemIds: [] };
    const isNormal = secSel.normal && !(secSel.nichtErhebbar);
    const marker = secSel.nichtErhebbar
      ? ' <span class="befund-marker nichterhebbar" aria-label="nicht erhebbar">&#x2013;</span>'
      : isNormal
        ? ' <span class="befund-marker normal" aria-label="unauffällig / abgehakt">&#x2713;</span>'
        : ' <span class="befund-marker abweichend" aria-label="abweichend">&#x25CF;</span>';
    const wasOpen = openIds.has(section.id) ? " open" : "";

    const clustersHtml = section.clusters.map((cluster) => {
      const freitextVal = (secSel.freitext || {})[cluster.id] || "";
      const itemsHtml = cluster.items.map((item) => {
        const checked = (secSel.itemIds || []).includes(item.id) ? " checked" : "";
        const sid = escapeHtml(section.id);
        const iid = escapeHtml(item.id);
        return `<label class="befund-item"><input type="checkbox" class="befund-cb" data-sid="${sid}" data-iid="${iid}"${checked}> ${escapeHtml(item.label)}</label>`;
      }).join("");
      const cid = escapeHtml(cluster.id);
      const sid = escapeHtml(section.id);
      return `<div class="befund-cluster">
        <span class="befund-cluster-label">${escapeHtml(cluster.label)}</span>
        <div class="befund-items">${itemsHtml}</div>
        <label class="befund-freitext-label">
          <span class="befund-freitext-hint">Eigener Text</span>
          <input type="text" class="befund-freitext" data-sid="${sid}" data-cid="${cid}" value="${escapeHtml(freitextVal)}" placeholder="Freitext …">
        </label>
      </div>`;
    }).join("");

    const sid = escapeHtml(section.id);
    const groupAttr = escapeHtml(section.group);
    return `<details class="befund-section" data-group="${groupAttr}" data-sid="${sid}"${wasOpen}>
      <summary class="befund-summary">
        <span class="befund-section-label">${escapeHtml(section.label)}${marker}</span>
      </summary>
      <div class="befund-section-body">
        <button type="button" class="befund-normal-btn${isNormal ? " is-active" : ""}" data-sid="${sid}">Normalbefund</button>
        ${clustersHtml}
      </div>
    </details>`;
  }).join("");

  befundPanel.innerHTML = `
    <div class="befund-topbar">
      <button type="button" class="soft-action befund-all-normal-btn">Normalbefund</button>
      <button type="button" class="quiet-action befund-ai-btn" id="befundAiBtn"${kiAvailable === false ? ' disabled title="KI nicht aktiv"' : ""}>KI-Vorschlag aus Notiz</button>
      <span class="befund-topbar-spacer"></span>
      <button type="button" class="quiet-action befund-preview-toggle" id="befundPreviewToggle" aria-expanded="false" aria-controls="befundPreviewWrap">Vorschau</button>
      <button type="button" class="quiet-action befund-copy-btn" id="befundCopyBtn">Kopieren</button>
    </div>
    <div class="befund-preview-wrap" id="befundPreviewWrap" hidden>
      <p class="befund-preview" id="befundPreview">${escapeHtml(fliesstext)}</p>
    </div>
    <div class="befund-sections">${sectionsHtml}</div>`;

  // Events via Delegation auf befundPanel
  befundPanel.addEventListener("click", handleBefundClick, { once: true });
  befundPanel.addEventListener("change", handleBefundChange, { once: true });
  befundPanel.addEventListener("input", handleBefundInput, { once: true });
  befundPanel.addEventListener("keydown", handleBefundKeydown, { once: true });
}

function handleBefundKeydown(event) {
  if (!befundPanel) return;
  befundPanel.addEventListener("keydown", handleBefundKeydown, { once: true });

  const summary = event.target.closest(".befund-summary");
  if (!summary) return;
  const key = event.key;
  if (key !== "ArrowDown" && key !== "ArrowUp" && key !== "Home" && key !== "End") return;

  const summaries = Array.from(befundPanel.querySelectorAll(".befund-summary"));
  if (summaries.length === 0) return;
  const idx = summaries.indexOf(summary);
  let nextIdx = idx;
  if (key === "ArrowDown") nextIdx = Math.min(idx + 1, summaries.length - 1);
  else if (key === "ArrowUp") nextIdx = Math.max(idx - 1, 0);
  else if (key === "Home") nextIdx = 0;
  else if (key === "End") nextIdx = summaries.length - 1;
  event.preventDefault();
  if (nextIdx === idx) return;

  const currentDetails = summary.closest("details.befund-section");
  const nextDetails = summaries[nextIdx].closest("details.befund-section");
  if (currentDetails) currentDetails.open = false;
  if (nextDetails) nextDetails.open = true;
  summaries[nextIdx].focus();
  summaries[nextIdx].scrollIntoView({ block: "nearest" });
}

function updateBefundPreview(patient) {
  const preview = befundPanel && befundPanel.querySelector("#befundPreview");
  if (preview) preview.textContent = befundFliesstext(BEFUND_CATALOG, patient.befund);
}

function handleBefundClick(event) {
  if (!befundPanel) return;
  // Re-attach listener for future clicks
  befundPanel.addEventListener("click", handleBefundClick, { once: true });

  const patient = getPatient();
  if (!patient) return;

  // Alles unauffaellig
  if (event.target.closest(".befund-all-normal-btn")) {
    patient.befund = befundSetAllNormal(BEFUND_CATALOG);
    savePatients();
    renderBefund(patient);
    return;
  }

  // KI-Vorschlag aus Notiz
  if (event.target.closest(".befund-ai-btn")) {
    requestBefundSuggest(patient);
    return;
  }

  // Normalbefund fuer eine Sektion
  const normalBtn = event.target.closest(".befund-normal-btn");
  if (normalBtn) {
    const sid = normalBtn.dataset.sid;
    patient.befund = befundSetNormal(patient.befund, sid, BEFUND_CATALOG);
    savePatients();
    renderBefund(patient);
    return;
  }

  // Vorschau ein-/ausblenden
  const previewToggle = event.target.closest(".befund-preview-toggle");
  if (previewToggle) {
    setBefundPreviewOpen(!isBefundPreviewOpen());
    return;
  }

  // Kopieren — kopiert und blendet die Vorschau zur Bestätigung ein
  if (event.target.closest(".befund-copy-btn")) {
    const text = befundFliesstext(BEFUND_CATALOG, patient.befund);
    setBefundPreviewOpen(true);
    if (!navigator.clipboard) {
      showToast("Kopieren in diesem Browser nicht verfügbar.");
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      showToast("Befund-Fliesstext kopiert.");
    }).catch(() => {
      showToast("Kopieren fehlgeschlagen.");
    });
    return;
  }
}

function isBefundPreviewOpen() {
  const wrap = befundPanel && befundPanel.querySelector("#befundPreviewWrap");
  return !!(wrap && !wrap.hasAttribute("hidden"));
}

function setBefundPreviewOpen(open) {
  if (!befundPanel) return;
  const wrap = befundPanel.querySelector("#befundPreviewWrap");
  const toggle = befundPanel.querySelector("#befundPreviewToggle");
  if (!wrap || !toggle) return;
  if (open) {
    wrap.removeAttribute("hidden");
    toggle.setAttribute("aria-expanded", "true");
    toggle.textContent = "Vorschau ausblenden";
  } else {
    wrap.setAttribute("hidden", "");
    toggle.setAttribute("aria-expanded", "false");
    toggle.textContent = "Vorschau";
  }
}

function handleBefundChange(event) {
  if (!befundPanel) return;
  befundPanel.addEventListener("change", handleBefundChange, { once: true });

  const patient = getPatient();
  if (!patient) return;

  const cb = event.target.closest(".befund-cb");
  if (cb) {
    const sid = cb.dataset.sid;
    const iid = cb.dataset.iid;
    // Cluster-Mutual-Exclusivity kann andere Checkboxen + den Normalbefund-Button aendern
    // -> volles Re-Render (renderBefund merkt offene Details und laesst sie offen).
    patient.befund = befundToggleItem(patient.befund, sid, iid, BEFUND_CATALOG);
    savePatients();
    renderBefund(patient);
  }
}

function handleBefundInput(event) {
  if (!befundPanel) return;
  befundPanel.addEventListener("input", handleBefundInput, { once: true });

  const patient = getPatient();
  if (!patient) return;

  const ft = event.target.closest(".befund-freitext");
  if (ft) {
    const sid = ft.dataset.sid;
    const cid = ft.dataset.cid;
    patient.befund = befundSetFreitext(patient.befund, sid, cid, ft.value, BEFUND_CATALOG);
    savePatients();
    const detail = befundPanel.querySelector(`details.befund-section[data-sid="${CSS.escape(sid)}"]`);
    const secSel = patient.befund[sid];
    const isNormal = secSel.normal && !secSel.nichtErhebbar;
    const markerEl = detail && detail.querySelector(".befund-marker");
    const labelEl = detail && detail.querySelector(".befund-section-label");
    if (labelEl) {
      if (!isNormal && !markerEl) {
        labelEl.insertAdjacentHTML("beforeend", ' <span class="befund-marker" aria-label="abweichend">&#x25CF;</span>');
      } else if (isNormal && markerEl) {
        markerEl.remove();
      }
    }
    updateBefundPreview(patient);
  }
}

function renderEmptyState() {
  document.body.classList.add("no-patient");
  deletePatientButton.disabled = true;
  if (exportPatientButton) exportPatientButton.disabled = true;
  if (workExportPatientButton) workExportPatientButton.disabled = true;
  if (archivePatientButton) archivePatientButton.disabled = true;
  if (caseStatusSelect) caseStatusSelect.value = "aktiv";
  patientIdInput.value = "";
  statusSelect.value = "Offen";
  patientMeta.textContent = "Noch keine Patienten angelegt";
  document.querySelectorAll("[data-field], [data-summary], [data-prep]").forEach((f) => (f.value = ""));
  processingStatus.textContent = "";
  updateTranscriptLengthWarning("");
  if (quickPrep) quickPrep.innerHTML = "";
  if (riskAlerts) riskAlerts.innerHTML = "";
  if (sessionCountBadge) sessionCountBadge.textContent = "0 Einträge";
  if (historyBook) historyBook.innerHTML = "";
  if (openPoints) openPoints.innerHTML = "";
  if (openCountBadge) openCountBadge.textContent = "0 offen";
  if (befundPanel) befundPanel.innerHTML = "";
}

// ---- Inhaltliche Suche durch Patientendaten und archivierte Sitzungen ----

function makeSnippet(text, query, padBefore = 30, padAfter = 60) {
  const lower = String(text).toLowerCase();
  const idx = lower.indexOf(query);
  if (idx < 0) return clip(text, 90);
  const start = Math.max(0, idx - padBefore);
  const end = Math.min(text.length, idx + query.length + padAfter);
  let snippet = text.slice(start, end).replace(/\s+/g, " ").trim();
  if (start > 0) snippet = "…" + snippet;
  if (end < text.length) snippet = snippet + "…";
  return snippet;
}

function findContentMatch(patient, query) {
  if (!query) return null;

  for (const f of ["focus", "agreement", "open", "transcript"]) {
    const text = patient[f];
    if (text && String(text).toLowerCase().includes(query)) {
      return { source: "Aktuell", snippet: makeSnippet(text, query) };
    }
  }

  const memory = patient.memory || {};
  for (const bucket of Object.keys(memory)) {
    const items = Array.isArray(memory[bucket]) ? memory[bucket] : [];
    for (const item of items) {
      const text = item && item.text;
      if (text && String(text).toLowerCase().includes(query)) {
        return { source: MEMORY_LABELS[bucket] || "Register", snippet: makeSnippet(text, query) };
      }
    }
  }

  for (const session of patient.sessions || []) {
    const dateLabel = formatDateShort(session.date);
    if ((session.focus || "").toLowerCase().includes(query)) {
      return { source: dateLabel, snippet: makeSnippet(session.focus, query) };
    }
    if ((session.transcript || "").toLowerCase().includes(query)) {
      return { source: dateLabel, snippet: makeSnippet(session.transcript, query) };
    }
    const summary = session.summary || {};
    for (const sf of ["core", "agreement", "open", "watch"]) {
      const text = summary[sf];
      if (text && String(text).toLowerCase().includes(query)) {
        return { source: dateLabel, snippet: makeSnippet(text, query) };
      }
    }
  }

  return null;
}

function patientMatchesQuery(patient, query) {
  if (!query) return true;
  if (patient.id.toLowerCase().includes(query)) return true;
  return findContentMatch(patient, query) !== null;
}

function patientButtonHtml(p, query) {
  const active = p.uid === selectedUid ? " active" : "";
  const idMatched = query && p.id.toLowerCase().includes(query);
  const contentHit = !idMatched && query ? findContentMatch(p, query) : null;
  const pending = p.pendingStructure ? `<span class="patient-flag pending">KI wartet</span>` : "";
  const risk = activeRiskItems(p).length ? `<span class="patient-flag risk">Hinweis</span>` : "";
  const appointment = p.nextDate ? formatNextAppointment(p).replace("Nächster Termin: ", "") : "Termin offen";
  const casePill = p.caseStatus && p.caseStatus !== "aktiv"
    ? `<span class="patient-status-pill">${escapeHtml(caseStatusLabel(p.caseStatus))}</span>`
    : "";
  const searchSnippet = contentHit
    ? `<span class="patient-search-hit">${escapeHtml(contentHit.source)}: ${escapeHtml(contentHit.snippet)}</span>`
    : "";
  const isSelected = p.uid === selectedUid;
  const sessionsBlock = isSelected ? patientSessionsHtml(p) : "";
  return `
      <div class="patient-entry${isSelected ? " is-selected" : ""}">
        <button class="patient-button${active}" type="button" data-uid="${escapeHtml(p.uid)}" data-search-hit="${contentHit ? "1" : ""}">
          <strong>${escapeHtml(p.id)}</strong>
          ${casePill}
          <span class="patient-meta">${escapeHtml(appointment)}</span>
          <span class="patient-flags">${pending}${risk}</span>
          ${searchSnippet}
        </button>
        ${sessionsBlock}
      </div>`;
}

function renderPatients() {
  const query = patientSearch.value.trim().toLowerCase();
  const visible = patients.filter((p) => patientMatchesQuery(p, query));
  const sorted = [...visible].sort(sortPatientsById);
  const { active, paused, completed, archived } = partitionPatientsByArchived(sorted);

  if (!sorted.length) {
    patientList.innerHTML = `
      <div class="empty-patients">
        <strong>${query ? "Keine Treffer" : "Noch keine Patienten"}</strong>
        <span>${query ? "Suche anpassen." : 'Oben auf „Patient anlegen“ klicken.'}</span>
      </div>`;
    return;
  }

  const activeHtml = groupPatientsByDate(active)
    .map(([date, group]) => patientDateGroupHtml(date, group, query))
    .join("");
  const archivedHtml = archived.length
    ? `<details class="archived-group"${query || !active.length ? " open" : ""}>
        <summary class="archived-heading">Archiviert <em>${archived.length}</em></summary>
        ${archived.map((p) => patientButtonHtml(p, query)).join("")}
      </details>`
    : "";
  const pausedHtml = patientCaseGroupHtml("Pausiert", paused, query, !active.length);
  const completedHtml = patientCaseGroupHtml("Abgeschlossen", completed, query, !active.length);
  patientList.innerHTML = activeHtml + pausedHtml + completedHtml + archivedHtml;

  patientList.querySelectorAll(".patient-button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const newUid = btn.dataset.uid;
      if (newUid !== selectedUid) viewSessionId = null;
      selectedUid = newUid;
      stopDictation(false);
      activeStep = btn.dataset.searchHit === "1" ? "prep" : "record";
      renderAll();
    });
  });
}

function handlePatientListNav(event) {
  if (event.target.closest(".session-nav-date-input")) return;
  const item = event.target.closest(".session-nav-item");
  if (!item || !patientList.contains(item)) return;
  patientList.querySelectorAll(".session-nav-item.is-current").forEach((el) => el.classList.remove("is-current"));
  item.classList.add("is-current");
  navigateToSession(item.dataset.sessionId);
}

function handlePatientListSessionDateChange(event) {
  const input = event.target.closest(".session-nav-date-input");
  if (!input || !patientList.contains(input)) return;
  const patient = getPatient();
  if (!patient) return;
  const sid = input.dataset.sessionId;
  const session = (patient.sessions || []).find((s) => s.id === sid);
  if (!session) return;
  session.date = input.value || "";
  patient.sessions = sortSessions(patient.sessions);
  savePatients();
  renderAll();
}

function handlePatientListKeydown(event) {
  if (event.target.classList?.contains("session-nav-date-input")) return;
  if (event.key !== "Enter" && event.key !== " ") return;
  const item = event.target.closest(".session-nav-item");
  if (!item || !patientList.contains(item)) return;
  event.preventDefault();
  item.click();
}

patientList.addEventListener("click", handlePatientListNav);
patientList.addEventListener("change", handlePatientListSessionDateChange);
patientList.addEventListener("keydown", handlePatientListKeydown);

function patientDateGroupHtml(date, group, query) {
  const hasDate = date !== "0000";
  const dateLabel = hasDate ? formatDateGroup(date) : "Termin offen";
  const dateMeta = hasDate ? formatDateShort(date) : "Bitte eintragen";
  const todayClass = date === todayIso() ? " day-today" : "";
  return `<details class="day-group${hasDate ? "" : " empty"}" open>
    <summary class="day-heading${todayClass}">
      <span class="day-title">
        <span class="day-name">${escapeHtml(dateLabel)}</span>
        <span class="day-date">${escapeHtml(dateMeta)}</span>
      </span>
      <em>${group.length}</em>
    </summary>
    ${group.map((p) => patientButtonHtml(p, query)).join("")}
  </details>`;
}

function patientCaseGroupHtml(label, group, query, openByDefault = false) {
  if (!group.length) return "";
  return `<details class="archived-group"${query || openByDefault ? " open" : ""}>
    <summary class="archived-heading">${escapeHtml(label)} <em>${group.length}</em></summary>
    ${group.map((p) => patientButtonHtml(p, query)).join("")}
  </details>`;
}

function groupPatientsByDate(list) {
  const map = new Map();
  for (const p of list) {
    const key = p.nextDate || "0000";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(p);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => {
      if (a === "0000") return 1;
      if (b === "0000") return -1;
      return a.localeCompare(b);
    })
    .map(([date, group]) => [date, [...group].sort(sortByDateAndTime)]);
}

function partitionPatientsByArchived(list) {
  const active = list.filter((p) => normalizeCaseStatus(p) === "aktiv");
  const paused = list.filter((p) => normalizeCaseStatus(p) === "pausiert");
  const completed = list.filter((p) => normalizeCaseStatus(p) === "abgeschlossen");
  const archived = list.filter((p) => normalizeCaseStatus(p) === "archiviert");
  return { active, paused, completed, archived };
}

function sortPatientsById(a, b) {
  return (a.id || "").localeCompare(b.id || "", "de", { numeric: true, sensitivity: "base" });
}

function caseStatusLabel(value) {
  return CASE_STATUS_LABELS[value] || CASE_STATUS_LABELS.aktiv;
}

function isCheckedStatus(value) {
  return normalizeEditStatus(value, "") === "Geprüft";
}

function sortByDateAndTime(a, b) {
  const aDate = a.nextDate || "9999";
  const bDate = b.nextDate || "9999";
  if (aDate !== bDate) return aDate.localeCompare(bDate);
  return (a.nextTime || "").localeCompare(b.nextTime || "");
}

function sortSessions(sessions) {
  return [...sessions].sort((a, b) => {
    const aKey = `${a.date || ""}T${a.time || "00:00"}`;
    const bKey = `${b.date || ""}T${b.time || "00:00"}`;
    return bKey.localeCompare(aKey);
  });
}

// Chronologische Nummer (1-basiert): aelteste Sitzung = 1.
// Sitzungen ohne Datum landen am Ende, in Anlage-Reihenfolge.
function computeSessionNumber(patient, sessionId) {
  if (!patient || !sessionId) return null;
  const sessions = Array.isArray(patient.sessions) ? patient.sessions : [];
  const indexed = sessions.map((s, i) => ({ s, i }));
  indexed.sort((a, b) => {
    const aHas = !!a.s.date;
    const bHas = !!b.s.date;
    if (aHas !== bHas) return aHas ? -1 : 1;
    if (!aHas) return a.i - b.i;
    const aKey = `${a.s.date}T${a.s.time || "00:00"}`;
    const bKey = `${b.s.date}T${b.s.time || "00:00"}`;
    return aKey.localeCompare(bKey);
  });
  const idx = indexed.findIndex((x) => x.s.id === sessionId);
  return idx >= 0 ? idx + 1 : null;
}

function getLastCheckedSession(patient) {
  const sorted = sortSessions(patient.sessions || []);
  return sorted.find((s) => isCheckedStatus(s.status)) || sorted[0] || null;
}

function getCheckedCurrentSession(patient) {
  const currentId = patient?.currentSessionId || "";
  if (!currentId) return null;
  return (patient.sessions || []).find((s) => s.id === currentId && isCheckedStatus(s.status)) || null;
}

function currentExportSource(patient, mode) {
  if (mode === "arbeitsnotiz") return patient;
  const session = getCheckedCurrentSession(patient);
  if (!session) return null;
  return {
    focus: session.focus || "",
    agreement: session.summary?.agreement || "",
    open: session.summary?.open || "",
    transcript: "",
    summary: session.summary || {},
    prep: session.prep || {},
    befund: session.befund
  };
}

function memorySignal(patient) {
  const memory = patient?.memory || {};
  const buckets = ["risks", "sensitiveTopics", "protectiveFactors"];
  for (const bucket of buckets) {
    const item = (memory[bucket] || []).find((entry) => entry.text && entry.status !== "erledigt");
    if (item) return `${MEMORY_LABELS[bucket]}: ${item.text}`;
  }
  return "";
}

function renderQuickPrep(patient) {
  if (!quickPrep) return;
  const latest = getLastCheckedSession(patient);
  const anchor = patient.prep?.anchor || latest?.summary?.agreement || patient.agreement || "";
  const open = patient.open || patient.summary?.open || latest?.summary?.open || "";
  const caution = memorySignal(patient) || patient.prep?.caution || patient.summary?.watch || latest?.summary?.watch || "";
  if (!latest && !anchor && !open && !caution) {
    quickPrep.innerHTML = "";
    return;
  }
  const latestLabel = latest
    ? `${formatDateShort(latest.date)}${latest.focus ? ` · ${clip(latest.focus, 64)}` : ""}`
    : "Noch kein archivierter Verlauf";

  quickPrep.innerHTML = `
    <div class="quick-prep-head">
      <div>
        <p class="eyebrow">Schnellblick</p>
        <h3>Nächste Sitzung vorbereiten</h3>
      </div>
      <button class="quiet-action quick-prep-action" type="button" data-open-prep>
        Anknüpfen öffnen
      </button>
    </div>
    <div class="quick-prep-grid">
      <article>
        <span>Anknüpfen</span>
        <strong>${escapeHtml(anchor || latestLabel)}</strong>
      </article>
      <article>
        <span>Offen</span>
        <strong>${escapeHtml(open || "Keine offenen Punkte dokumentiert")}</strong>
      </article>
      <article class="${caution ? "has-signal" : ""}">
        <span>Vorsicht</span>
        <strong>${escapeHtml(caution || "Keine Warnhinweise dokumentiert")}</strong>
      </article>
      <article>
        <span>Termin</span>
        <strong>${escapeHtml(formatNextAppointment(patient))}</strong>
      </article>
    </div>`;
}

function renderRiskAlerts(patient) {
  if (!riskAlerts) return;
  const risks = activeRiskItems(patient).slice(0, 4);
  const pending = patient?.pendingStructure ? normalizePendingStructure(patient.pendingStructure) : null;
  const parts = [];
  if (pending) {
    parts.push(`<article class="risk-alert pending-alert">
      <strong>KI-Ergebnis wartet</strong>
      <span>Beim Öffnen dieses Patienten muss die fertige Strukturierung übernommen oder verworfen werden.</span>
    </article>`);
  }
  for (const { bucket, item } of risks) {
    parts.push(`<article class="risk-alert">
      <strong>${escapeHtml(MEMORY_LABELS[bucket] || "Hinweis")}</strong>
      <span>${escapeHtml(item.text)}</span>
    </article>`);
  }
  riskAlerts.innerHTML = parts.join("");
}

function renderSessionDetails(s) {
  const sid = escapeHtml(s.id);
  const befundText = getBefundText(s.befund);
  const befundHtml = befundText
    ? `<div class="session-befund-readonly">
        <span>Psychopathologischer Befund</span>
        <p>${escapeHtml(befundText)}</p>
      </div>`
    : "";
  const number = computeSessionNumber(getPatient(), s.id);
  const numberLabel = number ? `Sitzung ${number}` : "Sitzung";
  const dateLabel = s.date ? formatDateShort(s.date) : "";
  const focusSuffix = s.focus ? ` · ${escapeHtml(clip(s.focus, 48))}` : "";
  // Archivierte Sitzung aufklappbar + rückwirkend editierbar (Felder schreiben direkt
  // via data-session-summary/-field). Re-Prüfen hält die Vorversion als Revision.
  return `<details class="session-item" data-session-id="${sid}">
    <summary class="session-summary">
      <strong>${escapeHtml(numberLabel)}</strong>
      ${dateLabel ? `<span class="session-date">${escapeHtml(dateLabel)}</span>` : ""}
      <span class="session-focus">${focusSuffix}</span>
      <span class="mini-status">${escapeHtml(s.status || "")}</span>
      ${s.revisions?.length ? `<span class="mini-status">${s.revisions.length} frühere Version${s.revisions.length === 1 ? "" : "en"}</span>` : ""}
    </summary>
    <div class="session-fields">
      <label class="field"><span>Kernpunkte</span>
        <textarea data-session-id="${sid}" data-session-summary="core" rows="3">${escapeHtml(s.summary?.core || "")}</textarea></label>
      <label class="field important-field"><span>Absprachen</span>
        <textarea data-session-id="${sid}" data-session-summary="agreement" rows="3">${escapeHtml(s.summary?.agreement || "")}</textarea></label>
      <label class="field"><span>Offen</span>
        <textarea data-session-id="${sid}" data-session-summary="open" rows="3">${escapeHtml(s.summary?.open || "")}</textarea></label>
      <label class="field session-transcript"><span>Transkript</span>
        <textarea data-session-id="${sid}" data-session-field="transcript" rows="4">${escapeHtml(s.transcript || "")}</textarea></label>
      ${befundHtml}
    </div>
  </details>`;
}

function patientSessionsHtml(patient) {
  const sessions = Array.isArray(patient.sessions) ? patient.sessions : [];
  const sorted = [...sessions].sort((a, b) => {
    const aHas = !!a.date;
    const bHas = !!b.date;
    if (aHas !== bHas) return aHas ? -1 : 1;
    if (!aHas) return sessions.indexOf(a) - sessions.indexOf(b);
    const aKey = `${a.date}T${a.time || "00:00"}`;
    const bKey = `${b.date}T${b.time || "00:00"}`;
    return aKey.localeCompare(bKey);
  });
  const items = sorted.map((s) => {
    const number = computeSessionNumber(patient, s.id);
    const isViewed = viewSessionId === s.id;
    return `<div class="session-nav-item${isViewed ? " is-current" : ""}" role="button" tabindex="0" data-session-id="${escapeHtml(s.id)}">
      <strong>Sitzung ${number ?? "?"}</strong>
      <input type="date" class="session-nav-date-input" data-session-id="${escapeHtml(s.id)}" value="${escapeHtml(s.date || "")}" aria-label="Datum für Sitzung ${number ?? ""}">
    </div>`;
  }).join("");
  const draftNumber = sessions.length + 1;
  const currentClass = viewSessionId ? "" : " is-current";
  return `<div class="patient-sessions">
    ${items}
    <div class="session-nav-item${currentClass}" role="button" tabindex="0" data-session-id="__current__">
      <strong>Aktuell · Sitzung ${draftNumber}</strong>
    </div>
  </div>`;
}

function navigateToSession(sessionId) {
  if (sessionId === "__current__") {
    viewSessionId = null;
    renderAll();
    document.querySelector(".workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  viewSessionId = sessionId;
  renderAll();
  document.querySelector(".workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderSessionViewPanel(patient) {
  if (!sessionViewPanel) return;
  if (!patient || !viewSessionId) {
    sessionViewPanel.innerHTML = "";
    return;
  }
  const session = (patient.sessions || []).find((s) => s.id === viewSessionId);
  if (!session) {
    sessionViewPanel.innerHTML = "";
    return;
  }
  const number = computeSessionNumber(patient, session.id);
  const dateLabel = session.date ? formatDateShort(session.date) : "ohne Datum";
  const timeLabel = session.time && session.date ? ` · ${escapeHtml(session.time)}` : "";
  const focusSuffix = session.focus ? ` · ${escapeHtml(clip(session.focus, 60))}` : "";
  const fields = [
    { label: "Fokus", value: session.focus },
    { label: "Kernpunkte", value: session.summary?.core },
    { label: "Absprachen", value: session.summary?.agreement },
    { label: "Offen", value: session.summary?.open },
    { label: "Vorsicht / Beobachtung", value: session.summary?.watch }
  ];
  const fieldsHtml = fields.map((f) => {
    const empty = !f.value;
    return `<div class="view-field${empty ? " empty" : ""}">
      <span>${f.label}</span>
      <p>${empty ? "—" : escapeHtml(f.value)}</p>
    </div>`;
  }).join("");
  const befundMarked = getBefundMarkedHtml(session.befund);
  const befundHtml = befundMarked
    ? `<details class="view-befund">
        <summary>Psychopathologischer Befund anzeigen</summary>
        <p>${befundMarked}</p>
      </details>`
    : "";
  const transcript = session.transcript || "";
  const transcriptHtml = transcript
    ? `<details class="view-transcript">
        <summary>Original-Transkript anzeigen</summary>
        <p>${escapeHtml(transcript)}</p>
      </details>`
    : `<p class="view-transcript-empty">Kein Transkript gespeichert.</p>`;
  sessionViewPanel.innerHTML = `
    <div class="view-head">
      <div>
        <h2>Sitzung ${number ?? "?"}</h2>
        <span class="view-date">${escapeHtml(dateLabel)}${timeLabel}${focusSuffix}</span>
      </div>
      <button class="back-to-current" type="button" id="backToCurrentBtn">← Aktuelle Sitzung</button>
    </div>
    ${fieldsHtml}
    ${befundHtml}
    ${transcriptHtml}
  `;
}

sessionViewPanel?.addEventListener("click", (event) => {
  if (event.target.closest("#backToCurrentBtn")) {
    viewSessionId = null;
    renderAll();
  }
});

function renderHistoryBook(patient) {
  if (!historyBook) return;
  const days = buildHistoryDays(patient);
  if (sessionCountBadge) {
    const sessions = (patient.sessions || []).length;
    sessionCountBadge.textContent = `${sessions} ${sessions === 1 ? "Eintrag" : "Einträge"}`;
  }
  if (!days.length) {
    historyBook.innerHTML = `<p class="empty-history"><strong>Noch kein Verlauf</strong><span>Nach der ersten geprüften Sitzung entsteht hier das Buch.</span></p>`;
    return;
  }
  // Ein Block pro Tag: Sitzung(en) + kompakte Zeilen für an dem Tag erledigte/ergänzte Punkte.
  const changeLine = (label, cls, items) => items.length
    ? `<p class="book-change ${cls}">${label} ${items.map((i) => escapeHtml(clip(i.text, 48))).join(" · ")}</p>`
    : "";
  historyBook.innerHTML = days.map((day) => {
    const date = `<span class="book-date">${escapeHtml(formatDateShort(day.date))}</span>`;
    const head = `<div class="book-day-head">${date}${day.sessions.length ? "" : "<strong>Notiz</strong>"}</div>`;
    const sessions = day.sessions.map(renderSessionDetails).join("");
    const resolved = changeLine("✓ erledigt:", "book-resolved-line", day.resolved);
    const added = changeLine("➕ ergänzt:", "book-added-line", day.added);
    return `<div class="book-day">${head}${sessions}${resolved}${added}</div>`;
  }).join("");
}

function renderOpenPoints(patient) {
  if (!openPoints) return;
  const suggestions = new Set(Array.isArray(patient.resolvedSuggestions) ? patient.resolvedSuggestions : []);
  const actionBuckets = new Set(["openQuestions", "agreements"]);
  const open = [];
  const context = [];
  const done = [];
  for (const bucket of MEMORY_BUCKETS) {
    for (const item of patient.memory?.[bucket] || []) {
      if (!item.text) continue;
      const entry = { item, bucket, relevance: memoryRelevance(item, bucket) };
      if (item.status === "erledigt") done.push(entry);
      else if (actionBuckets.has(bucket)) open.push(entry);
      else context.push(entry);
    }
  }
  const relevanceRank = { wichtig: 0, beobachten: 1, normal: 2, historisch: 3 };
  const sortMemoryEntries = (a, b) =>
    (relevanceRank[a.relevance] ?? 2) - (relevanceRank[b.relevance] ?? 2)
    || String(b.item.lastSeenAt || b.item.sourceDate || "").localeCompare(String(a.item.lastSeenAt || a.item.sourceDate || ""));
  open.sort(sortMemoryEntries);
  context.sort(sortMemoryEntries);
  if (openCountBadge) openCountBadge.textContent = `${open.length} offen`;
  const originLabel = (item) => item.origin === "manuell"
    ? `<span class="src self">selbst ${escapeHtml(formatDateShort(item.sourceDate))}</span>`
    : `<span class="src">aus Sitzung ${escapeHtml(formatDateShort(item.sourceDate))}</span>`;
  const itemHtml = ({ item, bucket, relevance }, extraClass = "") => {
    const id = escapeHtml(item.id);
    const relevanceBadge = `<span class="memory-badge ${escapeHtml(relevance)}">${escapeHtml(MEMORY_RELEVANCE_LABELS[relevance] || relevance)}</span>`;
    const suggest = suggestions.has(item.id)
      ? `<div class="resolve-suggest" data-suggest="${id}">Scheint erledigt — stimmt das?
           <button type="button" class="mini-yes" data-resolve="${id}">Ja, abhaken</button>
           <button type="button" class="mini-no" data-dismiss="${id}">Nein</button></div>`
      : "";
    return `<div class="open-item ${escapeHtml(relevance)}${extraClass ? ` ${extraClass}` : ""}${suggestions.has(item.id) ? " has-suggest" : ""}">
        <button type="button" class="check-box" data-resolve="${id}" aria-label="Abhaken"></button>
        <span class="open-text">${relevanceBadge}<strong>${escapeHtml(MEMORY_LABELS[bucket] || bucket)}</strong> ${escapeHtml(item.text)} ${originLabel(item)}</span>
      </div>${suggest}`;
  };
  const openHtml = open.map((entry) => itemHtml(entry)).join("");
  const contextHtml = context.length
    ? `<details class="context-fold" open><summary>${context.length} Hinweise im Blick</summary>${context.map((entry) => itemHtml(entry, "context-item")).join("")}</details>`
    : "";
  const doneHtml = done.length
    ? `<details class="done-fold"><summary>${done.length} erledigt</summary>${done.map(({ item }) =>
        `<div class="open-item done"><span class="check-box done"></span>
         <span class="open-text done-txt">${escapeHtml(item.text)}</span>
         <span class="meta">✓ ${escapeHtml(formatDateShort((item.resolvedAt || "").slice(0, 10)))}</span></div>`).join("")}</details>`
    : "";
  openPoints.innerHTML = (openHtml || `<p class="empty-history"><span>Keine offenen Aufgaben.</span></p>`) + contextHtml + doneHtml;
}

function setActiveStep(step) {
  activeStep = step;
  document.querySelectorAll(".workflow-step").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.step === activeStep);
  });
  document.querySelectorAll(".step-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `${activeStep}Panel`);
  });
}

// Transkript-Längen-Warnung — KI hat eine Wortgrenze, darüber geht Inhalt verloren
const TRANSCRIPT_WORDS_WARN = 2500;
const TRANSCRIPT_WORDS_CRIT = 4500;

function countWords(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function updateTranscriptLengthWarning(text) {
  if (!lengthWarning) return;
  const words = countWords(text);
  if (words >= TRANSCRIPT_WORDS_CRIT) {
    lengthWarning.className = "length-warning crit";
    lengthWarning.textContent = `${words} Wörter — bitte aufteilen, KI verarbeitet maximal ~5000.`;
  } else if (words >= TRANSCRIPT_WORDS_WARN) {
    lengthWarning.className = "length-warning warn";
    lengthWarning.textContent = `${words} Wörter — Strukturierung dauert evtl. mehrere Minuten.`;
  } else {
    lengthWarning.className = "length-warning";
    lengthWarning.textContent = "";
  }
}

// ============================================================
// FIELD UPDATES
// ============================================================

function syncFields(fieldName, value, source) {
  document.querySelectorAll("[data-field]").forEach((f) => {
    if (f === source || f.dataset.field !== fieldName) return;
    f.value = value;
  });
}

function updatePatientField(fieldName, value, source) {
  const patient = getPatient();
  if (!patient || patient[fieldName] === value) return;
  patient[fieldName] = value;

  if (fieldName === "nextDate" || fieldName === "nextTime") {
    patientMeta.textContent = formatNextAppointment(patient);
  } else if (fieldName === "transcript") {
    if (patient.status !== "Entwurf") {
      patient.status = "Entwurf";
      statusSelect.value = patient.status;
    }
    updateTranscriptLengthWarning(value);
  }

  syncFields(fieldName, value, source);
  savePatients();
  renderPatients();
}

function updateSummaryField(fieldName, value) {
  const patient = getPatient();
  if (!patient) return;
  patient.summary[fieldName] = value;
  patient.status = "Entwurf";
  statusSelect.value = patient.status;

  if (fieldName === "agreement") { patient.agreement = value; syncFields("agreement", value); }
  if (fieldName === "open") { patient.open = value; syncFields("open", value); }

  savePatients();
  renderPatients();
}

function updatePrepField(fieldName, value) {
  const patient = getPatient();
  if (!patient) return;
  patient.prep[fieldName] = value;
  savePatients();
}

function updateClosureField(fieldName, value) {
  const patient = getPatient();
  if (!patient) return;
  patient.closure = normalizeClosure(patient.closure || {});
  patient.closure[fieldName] = value;
  savePatients();
}

function getSessionById(sessionId) {
  return (getPatient()?.sessions || []).find((s) => s.id === sessionId);
}

function updateSessionSummary(sessionId, fieldName, value) {
  const session = getSessionById(sessionId);
  if (!session) return;
  session.summary[fieldName] = value;
  savePatients();
  renderQuickPrep(getPatient());
}

function updateSessionField(sessionId, fieldName, value) {
  const session = getSessionById(sessionId);
  if (!session) return;
  session[fieldName] = value;
  savePatients();
}

// ============================================================
// LONGITUDINAL MEMORY
// ============================================================

const MEMORY_LABELS = {
  risks: "Risiken / Warnhinweise",
  protectiveFactors: "Schutzfaktoren",
  openQuestions: "Offene Fragen",
  agreements: "Vereinbarungen",
  sensitiveTopics: "Sensible Themen",
  reliefNotes: "Entlastende Hinweise"
};

function normalizeMemoryText(text) {
  return String(text || "").trim().replace(/\s+/g, " ");
}

function splitMemoryText(text) {
  const cleaned = normalizeMemoryText(text);
  if (!cleaned) return [];
  return cleaned
    .split(/\s+\|\s+|;\s+|\n+/)
    .map((part) => normalizeMemoryText(part))
    .filter(Boolean);
}

const RISK_SIGNAL_RE = /suizid|todesgedanken|selbstverletz|fremdgefährd|krise|risiko|warnsignal|akut|alkohol|sucht/i;
const NEGATED_RISK_RE = /\b(kein|keine|keinen|nicht|ohne|verneint|verneinte|verneinen)\b[^.;,\n]{0,45}\b(suizid\w*|todesgedanken|selbstverletz\w*|fremdgefährd\w*|akute?\s+krise|akutes?\s+risiko)\b|\b(suizid\w*|todesgedanken|selbstverletz\w*|fremdgefährd\w*)\b[^.;,\n]{0,45}\b(verneint|ausgeschlossen|nicht vorhanden)\b/i;
const NEGATED_RISK_PHRASE_RE = /\b(kein|keine|keinen|nicht|ohne|verneint|verneinte|verneinen)\b[^.;,\n]{0,45}\b(suizid\w*|todesgedanken|selbstverletz\w*|fremdgefährd\w*|akute?\s+krise|akutes?\s+risiko)\b|\b(suizid\w*|todesgedanken|selbstverletz\w*|fremdgefährd\w*)\b[^.;,\n]{0,45}\b(verneint|ausgeschlossen|nicht vorhanden)\b/ig;

function hasRiskSignal(text) {
  const value = text || "";
  if (!RISK_SIGNAL_RE.test(value)) return false;
  const unnegated = value.replace(NEGATED_RISK_PHRASE_RE, " ");
  return RISK_SIGNAL_RE.test(unnegated);
}

function hasReliefSignal(text) {
  return NEGATED_RISK_RE.test(text || "") || /\b(entlastend|keine akute krise|keine hinweise auf akute|stabilisiert|deutlich gebessert)\b/i.test(text || "");
}

function hasProtectiveSignal(text) {
  return /schutz|ressource|schwester|bruder|freund|freundin|unterstütz|stabilisierend|krisenkarte|notfall/i.test(text || "");
}

function hasSensitiveSignal(text) {
  return /missbrauch|trauma|gewalt|übergriff|sexuell|sucht|ptbs|vergewalt/i.test(text || "");
}

function signalSnippet(text, predicate) {
  const chunks = String(text || "")
    .split(/[.!?]\s+|\s+\|\s+|;\s+|\n+/)
    .map((part) => normalizeMemoryText(part))
    .filter(Boolean);
  return chunks.find((part) => predicate(part)) || "";
}

function upsertMemoryItem(patient, bucket, text, session) {
  const value = normalizeMemoryText(text);
  if (!value) return;
  patient.memory = createMemoryState(patient.memory || {});
  const list = patient.memory[bucket] || [];
  const key = value.toLowerCase();
  const existing = list.find((item) =>
    item.status !== "erledigt" && normalizeMemoryText(item.text).toLowerCase() === key
  );
  const now = new Date().toISOString();
  if (existing) {
    existing.lastSeenAt = now;
    existing.sourceSessionId = session.id || existing.sourceSessionId;
    existing.sourceDate = session.date || existing.sourceDate;
    return;
  }
  list.unshift({
    id: makeId("mem"),
    text: value,
    status: "offen",
    relevance: defaultMemoryRelevance(bucket),
    sourceSessionId: session.id || "",
    sourceDate: session.date || todayIso(),
    createdAt: now,
    lastSeenAt: now
  });
  patient.memory[bucket] = list.slice(0, 30);
}

const MEMORY_BUCKETS = ["risks", "sensitiveTopics", "protectiveFactors", "openQuestions", "agreements", "reliefNotes"];

function defaultMemoryRelevance(bucket) {
  if (bucket === "risks" || bucket === "sensitiveTopics") return "wichtig";
  if (bucket === "reliefNotes") return "beobachten";
  return "normal";
}

function daysSinceIso(value) {
  if (!value) return 0;
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.floor((new Date(`${todayIso()}T00:00:00`) - date) / 86400000);
}

function memoryRelevance(item, bucket) {
  if (!item || item.status === "erledigt") return "historisch";
  if (item.relevance && item.relevance !== "normal") return item.relevance;
  if (!["risks", "sensitiveTopics"].includes(bucket) && daysSinceIso(item.lastSeenAt || item.sourceDate) > MEMORY_HISTORY_DAYS) {
    return "historisch";
  }
  return item.relevance || "normal";
}

function activeRiskItems(patient) {
  const memory = patient?.memory || {};
  return ["risks", "sensitiveTopics"]
    .flatMap((bucket) => (memory[bucket] || []).map((item) => ({ bucket, item })))
    .filter(({ bucket, item }) => item.text && item.status !== "erledigt" && memoryRelevance(item, bucket) !== "historisch");
}

function findMemoryItem(patient, itemId) {
  for (const bucket of MEMORY_BUCKETS) {
    const item = (patient.memory?.[bucket] || []).find((entry) => entry.id === itemId);
    if (item) return item;
  }
  return null;
}

function resolveMemoryItem(patient, itemId, { sessionId = "" } = {}) {
  const item = findMemoryItem(patient, itemId);
  if (!item || item.status === "erledigt") return false;
  // Append-only: nur Resolved-Felder ergänzen, Text/Quelle bleiben unangetastet.
  item.status = "erledigt";
  item.resolvedAt = new Date().toISOString();
  item.resolvedSessionId = sessionId || patient.currentSessionId || "";
  return true;
}

function addOpenPoint(patient, rawText) {
  const text = normalizeMemoryText(rawText);
  if (!text) return null;
  patient.memory = createMemoryState(patient.memory || {});
  const now = new Date().toISOString();
  const item = {
    id: makeId("mem"),
    text,
    status: "offen",
    relevance: "normal",
    origin: "manuell",
    sourceSessionId: "",
    sourceDate: todayIso(),
    resolvedAt: "",
    resolvedSessionId: "",
    createdAt: now,
    lastSeenAt: now
  };
  patient.memory.openQuestions.unshift(item);
  patient.memory.openQuestions = patient.memory.openQuestions.slice(0, 30);
  return item;
}

// Gleicht die KI-Vorschläge (resolved-Texte) gegen offene Register-Einträge ab.
// Reiner Abgleich: gibt nur Treffer-IDs zurück, ändert NICHTS (Bestätigung erfolgt separat).
function matchResolvedSuggestions(patient, resolvedTexts) {
  if (!Array.isArray(resolvedTexts) || !resolvedTexts.length) return [];
  const wanted = new Set(resolvedTexts.map((t) => normalizeMemoryText(t).toLowerCase()).filter(Boolean));
  const ids = [];
  for (const bucket of MEMORY_BUCKETS) {
    for (const item of patient.memory?.[bucket] || []) {
      if (item.status !== "erledigt" && wanted.has(normalizeMemoryText(item.text).toLowerCase())) {
        ids.push(item.id);
      }
    }
  }
  return ids;
}

function updatePatientMemoryFromSession(patient, session) {
  if (!patient || !session) return;
  const summary = session.summary || {};

  splitMemoryText(summary.agreement).forEach((text) => upsertMemoryItem(patient, "agreements", text, session));
  splitMemoryText(summary.open).forEach((text) => upsertMemoryItem(patient, "openQuestions", text, session));

  splitMemoryText(summary.watch).forEach((text) => {
    if (hasReliefSignal(text)) upsertMemoryItem(patient, "reliefNotes", text, session);
    if (hasSensitiveSignal(text)) upsertMemoryItem(patient, "sensitiveTopics", text, session);
    if (hasRiskSignal(text)) upsertMemoryItem(patient, "risks", text, session);
    if (hasProtectiveSignal(text)) upsertMemoryItem(patient, "protectiveFactors", text, session);
  });

  const summaryText = `${summary.core || ""} ${summary.open || ""} ${summary.watch || ""}`;
  const combined = `${summaryText} ${session.transcript || ""}`;
  const sensitiveText = signalSnippet(summaryText, hasSensitiveSignal) || signalSnippet(session.transcript, hasSensitiveSignal);
  const riskText = signalSnippet(summaryText, hasRiskSignal) || signalSnippet(session.transcript, hasRiskSignal);
  const reliefText = signalSnippet(summaryText, hasReliefSignal) || signalSnippet(session.transcript, hasReliefSignal);
  const protectiveText = signalSnippet(summaryText, hasProtectiveSignal) || signalSnippet(session.transcript, hasProtectiveSignal);
  if (hasReliefSignal(combined)) upsertMemoryItem(patient, "reliefNotes", reliefText || summary.watch || summary.open || summary.core, session);
  if (hasSensitiveSignal(combined)) upsertMemoryItem(patient, "sensitiveTopics", sensitiveText || summary.watch || summary.open || summary.core, session);
  if (hasRiskSignal(combined)) upsertMemoryItem(patient, "risks", riskText || summary.watch || summary.open || summary.core, session);
  if (hasProtectiveSignal(combined)) upsertMemoryItem(patient, "protectiveFactors", protectiveText || summary.watch || summary.core, session);
}

function memoryLines(patient, bucket, limit = 5) {
  const list = patient?.memory?.[bucket] || [];
  return list
    .filter((item) => item.text && item.status !== "erledigt")
    .slice(0, limit)
    .map((item) => `- ${MEMORY_LABELS[bucket]} (${item.sourceDate || "Datum offen"}): ${item.text}`);
}

function buildMemoryContext(patient) {
  if (!patient?.memory) return "";
  const lines = [
    ...memoryLines(patient, "risks", 5),
    ...memoryLines(patient, "sensitiveTopics", 5),
    ...memoryLines(patient, "protectiveFactors", 5),
    ...memoryLines(patient, "openQuestions", 5),
    ...memoryLines(patient, "agreements", 5),
    ...memoryLines(patient, "reliefNotes", 5)
  ];
  return lines.length
    ? "\n\nDauerhafte Patientennotizen aus früheren Sitzungen (prüfen, fortführen, nicht ohne Anlass löschen):\n" + lines.join("\n")
    : "";
}

// Leitet das Verlaufsbuch deterministisch aus Sitzungen + Register-Zeitstempeln ab.
// Gibt nach Datum aufsteigend sortierte Ereignisse zurück (kein eigener Speicher).
function buildHistoryBook(patient) {
  const events = [];
  for (const s of patient.sessions || []) {
    events.push({ type: "session", date: s.date || "", session: s, sortKey: 0 });
  }
  for (const bucket of MEMORY_BUCKETS) {
    for (const item of patient.memory?.[bucket] || []) {
      if (item.origin === "manuell" && item.sourceDate) {
        events.push({ type: "added", date: item.sourceDate, bucket, item, sortKey: 1 });
      }
      if (item.status === "erledigt" && item.resolvedAt) {
        events.push({ type: "resolved", date: item.resolvedAt.slice(0, 10), bucket, item, sortKey: 2 });
      }
    }
  }
  // Datum aufsteigend; am selben Tag: Sitzung (0) vor Ergänzung (1) vor Abhaken (2).
  return events.sort((a, b) =>
    (a.date || "").localeCompare(b.date || "") || a.sortKey - b.sortKey);
}

// Bündelt die Ereignisse zu einem Block pro Tag (neueste zuerst), damit das Buch
// pro Termin wächst statt pro einzelnem abgehakten/ergänzten Punkt.
function buildHistoryDays(patient) {
  const byDate = new Map();
  for (const e of buildHistoryBook(patient)) {
    if (!byDate.has(e.date)) byDate.set(e.date, { date: e.date, sessions: [], resolved: [], added: [] });
    const day = byDate.get(e.date);
    if (e.type === "session") day.sessions.push(e.session);
    else if (e.type === "resolved") day.resolved.push(e.item);
    else if (e.type === "added") day.added.push(e.item);
  }
  return [...byDate.values()].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

function renderMemoryBlock(patient) {
  if (!patient?.memory) return "";
  const sections = ["risks", "sensitiveTopics", "protectiveFactors", "openQuestions", "agreements", "reliefNotes"]
    .map((bucket) => {
      const items = (patient.memory[bucket] || [])
        .filter((item) => item.text && item.status !== "erledigt")
        .slice(0, 4);
      if (!items.length) return "";
      return `<p><strong>${escapeHtml(MEMORY_LABELS[bucket])}</strong>${items
        .map((item) => escapeHtml(`${item.text}${item.sourceDate ? ` (${formatDateShort(item.sourceDate)})` : ""}`))
        .join("<br>")}</p>`;
    })
    .filter(Boolean);
  return sections.join("");
}

// ============================================================
// PATIENTENAKTE EXPORT
// ============================================================

function textToExportHtml(value, fallback = "Nicht dokumentiert") {
  const text = String(value || "").trim();
  if (!text) return `<div class="export-value export-empty">${escapeHtml(fallback)}</div>`;
  return `<div class="export-value">${escapeHtml(text).replace(/\n/g, "<br>")}</div>`;
}

function exportField(label, value, fallback) {
  return `
    <section class="export-field">
      <h3>${escapeHtml(label)}</h3>
      ${textToExportHtml(value, fallback)}
    </section>`;
}

function exportMeta(label, value) {
  return `
    <div class="export-meta-item">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || "Nicht dokumentiert")}</strong>
    </div>`;
}

function formatExportDateTime(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value || "";
  const date = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${date}, ${time}`;
}

function exportSummaryFields(summary = {}) {
  return `
    <div class="export-grid two">
      ${exportField("Kernpunkte", summary.core)}
      ${exportField("Absprachen", summary.agreement)}
      ${exportField("Offene Punkte", summary.open)}
      ${exportField("Beobachtungsfokus", summary.watch)}
    </div>`;
}

function exportPrepFields(prep = {}) {
  return `
    <div class="export-grid three">
      ${exportField("Woran anknüpfen", prep.anchor)}
      ${exportField("Einstiegsfrage", prep.opening)}
      ${exportField("Vorsicht / fachlich prüfen", prep.caution)}
    </div>`;
}

function getBefundText(selection) {
  if (!selection || typeof selection !== "object") return "";
  if (typeof befundFliesstext !== "function" || typeof BEFUND_CATALOG === "undefined") return "";
  try {
    return befundFliesstext(BEFUND_CATALOG, selection);
  } catch {
    return "";
  }
}

// HTML mit Abweichungen markiert (befund-abweichung). Abweichende oder nicht erhebbare
// Sektionen werden hervorgehoben, normale fließen unauffällig.
function getBefundMarkedHtml(selection) {
  if (!selection || typeof selection !== "object") return "";
  if (typeof befundSectionText !== "function" || typeof BEFUND_CATALOG === "undefined") return "";
  try {
    const parts = BEFUND_CATALOG.map((section) => {
      const sel = selection[section.id] || { normal: true, itemIds: [] };
      const raw = befundSectionText(section, sel);
      const trimmed = raw.trim();
      const text = trimmed.endsWith(".") ? trimmed : `${trimmed}.`;
      // Jeder Abschnitt ist Satzanfang -> ersten Buchstaben großschreiben.
      const cap = text.replace(/^\s*(\p{Ll})/u, (_, c) => c.toUpperCase());
      const isAbnormal = !sel.normal || !!sel.nichtErhebbar;
      return { text: cap, isAbnormal };
    });
    return parts.map((p) => {
      const safe = escapeHtml(p.text);
      return p.isAbnormal ? `<mark class="befund-abweichung">${safe}</mark>` : safe;
    }).join(" ");
  } catch {
    return "";
  }
}

function exportBefundBlock(selection) {
  const text = getBefundText(selection);
  return text ? `<div class="export-grid one">${exportField("Psychopathologischer Befund", text)}</div>` : "";
}

function exportMemorySection(patient) {
  const buckets = ["risks", "sensitiveTopics", "protectiveFactors", "openQuestions", "agreements", "reliefNotes"];
  const sections = buckets.map((bucket) => {
    const items = patient.memory?.[bucket] || [];
    if (!items.length) {
      return `
        <section class="export-memory-bucket">
          <h3>${escapeHtml(MEMORY_LABELS[bucket])}</h3>
          <p class="export-empty">Keine Einträge</p>
        </section>`;
    }
    return `
      <section class="export-memory-bucket">
        <h3>${escapeHtml(MEMORY_LABELS[bucket])}</h3>
        <ul>
          ${items.map((item) => `
            <li>
              <span>${escapeHtml(item.text)}</span>
              <small>${escapeHtml([
                item.status ? `Status: ${item.status}` : "",
                item.sourceDate ? `Quelle: ${formatDateShort(item.sourceDate)}` : "",
                item.lastSeenAt ? `zuletzt: ${formatExportDateTime(item.lastSeenAt)}` : ""
              ].filter(Boolean).join(" · "))}</small>
            </li>`).join("")}
        </ul>
      </section>`;
  });
  return `<div class="export-grid two">${sections.join("")}</div>`;
}

function exportSessionBlock(session, number, { revision = false, mode = "akte" } = {}) {
  const summary = session.summary || {};
  const prep = session.prep || {};
  const revisions = Array.isArray(session.revisions) ? session.revisions : [];
  const includeWorking = mode === "arbeitsnotiz";
  const dateLine = [session.date ? formatDateShort(session.date) : "", session.time || ""]
    .filter(Boolean).join(", ");
  return `
    <article class="${revision ? "export-revision" : "export-session"}">
      <header class="export-session-head">
        <div>
          <h3>${revision ? "Frühere Version" : `Sitzung ${number}`}</h3>
          ${dateLine ? `<span>${escapeHtml(dateLine)}</span>` : ""}
        </div>
        <strong>${escapeHtml(session.status || "Status offen")}</strong>
      </header>
      <div class="export-grid two">
        ${exportField("Fokus", session.focus)}
        ${includeWorking ? exportField("Transkript", session.transcript) : ""}
      </div>
      ${exportSummaryFields(summary)}
      ${includeWorking ? exportPrepFields(prep) : ""}
      ${exportBefundBlock(session.befund)}
      ${session.revisedAt ? `<p class="export-note">Zuletzt überarbeitet: ${escapeHtml(formatExportDateTime(session.revisedAt))}</p>` : ""}
      ${!revision && revisions.length ? `
        <section class="export-revisions">
          <h3>Frühere Versionen</h3>
          ${revisions.map((rev) => exportSessionBlock(rev, null, { revision: true, mode })).join("")}
        </section>` : ""}
    </article>`;
}

function safeFilePart(value) {
  return String(value || "patient")
    .trim()
    .replace(/[^a-z0-9äöüß_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42) || "patient";
}

function exportClosureBlock(patient) {
  const closure = normalizeClosure(patient.closure || {});
  if (!closure.summary && !closure.outcome && !closure.recommendation) return "";
  return `
    <h2>Abschlussnotiz</h2>
    <div class="export-grid three">
      ${exportField("Fallzusammenfassung", closure.summary)}
      ${exportField("Stand bei Abschluss", closure.outcome)}
      ${exportField("Empfehlung / Wiedervorstellung", closure.recommendation)}
    </div>`;
}

function buildPatientExportHtml(patient, { mode = "akte" } = {}) {
  const sessions = sortSessions(patient.sessions || []);
  const exportedAt = new Date().toISOString();
  const isWorkNote = mode === "arbeitsnotiz";
  const title = `${isWorkNote ? "Arbeitsnotiz" : "Patientenakte"} ${patient.id || ""}`.trim();
  const currentSource = currentExportSource(patient, mode);
  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        --ink: #17222d;
        --muted: #5f6e79;
        --line: #c9d4dc;
        --soft: #f3f6f8;
        --accent: #16324a;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: #eef2f5;
        color: var(--ink);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 14px;
        line-height: 1.48;
      }
      main {
        width: min(1040px, calc(100% - 32px));
        margin: 24px auto;
        padding: 28px;
        background: #fff;
        border: 1px solid var(--line);
      }
      header.export-title {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 24px;
        padding-bottom: 18px;
        border-bottom: 2px solid var(--accent);
      }
      h1, h2, h3, p { margin-top: 0; }
      h1 { margin-bottom: 6px; color: var(--accent); font-size: 30px; line-height: 1.08; }
      h2 {
        margin: 28px 0 12px;
        padding-bottom: 7px;
        border-bottom: 1px solid var(--line);
        color: var(--accent);
        font-size: 19px;
      }
      h3 { margin-bottom: 7px; color: var(--accent); font-size: 12px; letter-spacing: 0.05em; text-transform: uppercase; }
      .export-subtitle, .export-note, .export-empty { color: var(--muted); }
      .export-subtitle { margin: 0; }
      .export-meta {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
        margin-top: 16px;
      }
      .export-meta-item, .export-field, .export-memory-bucket {
        border: 1px solid var(--line);
        background: var(--soft);
        padding: 11px 12px;
        break-inside: avoid;
      }
      .export-meta-item span {
        display: block;
        margin-bottom: 4px;
        color: var(--muted);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }
      .export-meta-item strong { display: block; color: var(--ink); }
      .export-grid { display: grid; gap: 10px; margin-bottom: 10px; }
      .export-grid.one { grid-template-columns: 1fr; }
      .export-grid.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .export-grid.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .export-value { white-space: normal; overflow-wrap: anywhere; }
      .export-session {
        margin-top: 16px;
        padding: 16px;
        border: 1px solid var(--line);
        break-inside: avoid;
      }
      .export-session-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 12px;
      }
      .export-session-head span, .export-session-head strong {
        color: var(--muted);
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }
      .export-session-head h3 {
        margin: 2px 0 0;
        font-size: 16px;
        letter-spacing: 0;
        text-transform: none;
      }
      .export-memory-bucket ul { display: grid; gap: 8px; margin: 0; padding-left: 18px; }
      .export-memory-bucket li span { display: block; }
      .export-memory-bucket small { color: var(--muted); }
      .export-revisions { margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--line); }
      .export-revision {
        margin-top: 10px;
        padding: 12px;
        border: 1px dashed var(--line);
        background: #fbfcfd;
        break-inside: avoid;
      }
      @page { margin: 16mm; }
      @media print {
        body { background: #fff; }
        main { width: 100%; margin: 0; padding: 0; border: 0; }
        h2 { break-after: avoid; }
        .export-grid.two, .export-grid.three, .export-meta { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (max-width: 720px) {
        main { width: 100%; margin: 0; padding: 18px; border: 0; }
        header.export-title { display: block; }
        .export-grid.two, .export-grid.three, .export-meta { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <main>
      <header class="export-title">
        <div>
          <h1>${escapeHtml(title)}</h1>
          <p class="export-subtitle">${isWorkNote
            ? "Interne Arbeitsnotiz aus Praxis Memo. Enthält Entwürfe, Vorbereitung und ggf. Rohtext."
            : "Geprüfte Aktenansicht aus Praxis Memo. Entwürfe und Rohtranskripte werden standardmäßig ausgelassen."}</p>
        </div>
        <p class="export-note">Erstellt: ${escapeHtml(formatExportDateTime(exportedAt))}</p>
      </header>

      <section class="export-meta">
        ${exportMeta("Patient", patient.id)}
        ${exportMeta("Bearbeitungsstatus", patient.status)}
        ${exportMeta("Fallstatus", caseStatusLabel(patient.caseStatus))}
        ${exportMeta("Nächster Termin", formatNextAppointment(patient))}
        ${exportMeta("Archivierte Sitzungen", String(sessions.length))}
      </section>

      ${currentSource ? `
        <h2>Aktuelle Übersicht</h2>
        <div class="export-grid two">
          ${exportField("Letzter Fokus", currentSource.focus)}
          ${exportField("Letzte Vereinbarung", currentSource.agreement)}
          ${exportField("Offen", currentSource.open)}
          ${isWorkNote ? exportField("Aktuelles Transkript / Entwurf", currentSource.transcript) : ""}
        </div>
        ${exportSummaryFields(currentSource.summary || {})}
        ${isWorkNote ? exportPrepFields(currentSource.prep || {}) : ""}
        ${exportBefundBlock(currentSource.befund)}
      ` : `<p class="export-note">Aktuelle Entwurfsfelder wurden ausgelassen, weil sie nicht über „Geprüft speichern" archiviert sind.</p>`}

      ${exportClosureBlock(patient)}

      <h2>Patientenregister</h2>
      ${exportMemorySection(patient)}

      <h2>Archivierte Sitzungen</h2>
      ${sessions.length
        ? sessions.map((session) => exportSessionBlock(session, computeSessionNumber(patient, session.id), { mode })).join("")
        : `<p class="export-empty">Keine archivierten Sitzungen vorhanden.</p>`}
    </main>
  </body>
</html>`;
}

function downloadPatientExport(patient, html, mode = "akte") {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const stamp = new Date().toISOString().slice(0, 10);
  const kind = mode === "arbeitsnotiz" ? "arbeitsnotiz" : "akte";
  downloadBlob(blob, `praxis-memo-${kind}-${safeFilePart(patient.id)}-${stamp}.html`);
}

function exportCurrentPatient(mode = "akte") {
  const patient = getPatient();
  if (!patient) {
    showToast("Bitte zuerst einen Patienten auswählen.");
    return;
  }
  const html = buildPatientExportHtml(patient, { mode });
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    downloadPatientExport(patient, html, mode);
    showToast("Druckansicht wurde blockiert — HTML-Datei heruntergeladen.");
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => {
    try {
      printWindow.print();
      showToast(`${mode === "arbeitsnotiz" ? "Arbeitsnotiz" : "Patientenakte"} geöffnet — im Druckdialog als PDF speichern.`);
    } catch {
      showToast("Patientenakte als Druckansicht geöffnet.");
    }
  }, 300);
}

// ============================================================
// SESSION MANAGEMENT
// ============================================================

function buildSessionFromCurrent(patient) {
  const existing = (patient.sessions || []).find((s) => s.id === patient.currentSessionId);
  return createSession({
    id: patient.currentSessionId || makeId("session"),
    date: existing?.date || todayIso(),
    time: existing?.time || patient.nextTime || "08:00",
    status: "Geprüft",
    focus: patient.focus,
    agreement: patient.summary.agreement || patient.agreement,
    open: patient.summary.open || patient.open,
    transcript: patient.transcript,
    summary: patient.summary,
    prep: patient.prep,
    befund: patient.befund
  });
}

function archiveCurrentSession(patient) {
  const archived = buildSessionFromCurrent(patient);
  const idx = (patient.sessions || []).findIndex((s) => s.id === archived.id);
  if (idx >= 0) {
    const previous = patient.sessions[idx];
    // Append-only: eine bereits geprüfte Version wird nicht verworfen, sondern als
    // unveränderbare Revision aufbewahrt (rechtlicher Nachweis früherer Stände).
    if (isCheckedStatus(previous.status)) {
      const snapshot = clone(previous);
      const olderRevisions = Array.isArray(snapshot.revisions) ? snapshot.revisions : [];
      delete snapshot.revisions;
      snapshot.revisedAt = previous.revisedAt || `${previous.date || ""} ${previous.time || ""}`.trim();
      archived.revisions = [snapshot, ...olderRevisions];
    } else if (Array.isArray(previous.revisions)) {
      archived.revisions = previous.revisions;
    }
    archived.revisedAt = new Date().toISOString();
    patient.sessions[idx] = archived;
  } else {
    patient.sessions = [archived, ...(patient.sessions || [])];
  }
  updatePatientMemoryFromSession(patient, archived);
  patient.sessions = sortSessions(patient.sessions);
  patient.status = "Geprüft";
  patient.currentSessionId = archived.id;
  patient.agreement = archived.summary.agreement;
  patient.open = archived.summary.open;
  patient.prep = {
    anchor: archived.summary.agreement,
    opening: `Anknüpfen an: ${clip(archived.focus, 120)}`,
    caution: archived.summary.watch || "Fachliche Bewertung bleibt manuell."
  };
}

function approveCurrent() {
  const patient = getPatient();
  if (!patient) return;
  archiveCurrentSession(patient);
  savePatients();
  activeStep = "prep";
  renderAll();
  showToast("Geprüfte Sitzung archiviert. Verlauf bleibt erhalten.");
}

function startNewSession() {
  const patient = getPatient();
  if (!patient) return;
  const hasDraft = patient.status !== "Geprüft" && Boolean(
    patient.transcript?.trim() || patient.summary?.core?.trim() || patient.summary?.agreement?.trim()
  );
  if (hasDraft && !window.confirm("Aktueller Entwurf ist noch nicht geprüft. Trotzdem neue Sitzung beginnen?")) return;

  const latest = getLastCheckedSession(patient);
  patient.currentSessionId = makeId("session");
  patient.status = "Offen";
  patient.transcript = "";
  patient.summary = { core: "", agreement: latest?.summary?.agreement || "", open: latest?.summary?.open || "", watch: "" };
  patient.focus = latest?.focus || patient.focus || "";
  patient.agreement = latest?.summary?.agreement || patient.agreement || "";
  patient.open = latest?.summary?.open || patient.open || "";
  patient.prep = latest
    ? { anchor: latest.summary.agreement, opening: `Anknüpfen an: ${clip(latest.focus, 120)}`, caution: latest.summary.watch || "Fachlich prüfen." }
    : { anchor: "", opening: "", caution: "Fachlich prüfen, bevor Inhalte übernommen werden." };
  patient.befund = carriedBefundSelection(patient, latest);

  savePatients();
  activeStep = "record";
  renderAll();
  showToast("Neue Sitzung angelegt. Bisheriger Verlauf bleibt im Archiv.");
}

function addPatient() {
  const usedNumbers = patients
    .map((p) => parseInt(String(p.id || "").replace(/\D/g, ""), 10))
    .filter((n) => !Number.isNaN(n));
  const nextNum = (usedNumbers.length ? Math.max(...usedNumbers) : 0) + 1;
  const uid = makeId("p");
  const patient = createEmptyPatient(uid, `P-${String(nextNum).padStart(3, "0")}`);
  patients.push(patient);
  selectedUid = patient.uid;
  activeStep = "record";
  savePatients();
  renderAll();
  patientIdInput.focus();
  patientIdInput.select();
  showToast("Patient angelegt — Kürzel und Termin eintragen.");
}

function deletePatient() {
  const patient = getPatient();
  if (!patient) return;

  const sessionCount = (patient.sessions || []).length;
  const sessionLine = sessionCount
    ? `${sessionCount} archivierte Sitzung${sessionCount === 1 ? "" : "en"}`
    : "Keine archivierten Sitzungen";

  const confirmed = window.confirm(
    `Patient ${patient.id} wirklich löschen?\n\n` +
    `${sessionLine} und alle aktuellen Notizen werden unwiderruflich entfernt.\n\n` +
    `Empfehlung: vorher 'Backup erstellen' klicken.`
  );
  if (!confirmed) return;

  const removedId = patient.id;
  patients = patients.filter((p) => p.uid !== patient.uid);
  selectedUid = patients[0]?.uid || null;
  activeStep = "record";
  stopDictation(false);
  savePatients();
  renderAll();
  showToast(`Patient ${removedId} gelöscht.`);
}

// ============================================================
// BEFUND KI-VORSCHLAG (über Server-Proxy → Ollama)
// ============================================================

async function requestBefundSuggest(patient) {
  const transcript = (patient.transcript || "").trim();
  if (!transcript) {
    showToast("Keine Notiz vorhanden.");
    return;
  }

  // Kompakten Katalog fuer den Server aufbauen
  const catalog = BEFUND_CATALOG.map((section) => ({
    id: section.id,
    label: section.label,
    items: befundSectionItems(section).map((it) => ({ id: it.id, label: it.label }))
  }));

  // Button in den Lade-Zustand versetzen
  const aiBtn = befundPanel && befundPanel.querySelector(".befund-ai-btn");
  if (aiBtn) {
    aiBtn.disabled = true;
    aiBtn.textContent = "KI läuft…";
  }

  try {
    const r = await fetch("/api/befund-suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript, catalog })
    });
    const data = await r.json();
    if (!r.ok || !data.ok) throw new Error(data.error || "Fehler");

    patient.befund = befundApplySuggestions(
      patient.befund || befundDefaultSelection(BEFUND_CATALOG),
      data.suggestions,
      BEFUND_CATALOG
    );
    savePatients();
    renderBefund(patient);
    const n = Object.values(data.suggestions || {}).reduce((a, arr) => a + (Array.isArray(arr) ? arr.length : 0), 0);
    showToast(n > 0
      ? `KI hat ${n} Punkt(e) angekreuzt — bitte fachlich pruefen.`
      : "KI hat keine ankreuzbaren Auffaelligkeiten gefunden.");
  } catch {
    showToast("KI-Befund-Vorschlag fehlgeschlagen — bitte KI-Status pruefen.");
  }
}

// ============================================================
// KI / Strukturierung (über Server-Proxy → Ollama)
// ============================================================

async function checkKiAvailability() {
  if (window.location.protocol === "file:") { kiAvailable = false; renderKiStatus(); return; }
  try {
    const r = await fetch("/api/structure-status", { signal: AbortSignal.timeout(2000) });
    if (r.ok) {
      const data = await r.json();
      kiAvailable = Boolean(data.available);
      kiMode = data.mode || "local";
      kiModel = data.model || "";
    } else {
      kiAvailable = false;
    }
  } catch {
    kiAvailable = false;
  }
  renderKiStatus();
}

function renderKiStatus() {
  if (!kiStatus) return;
  if (kiAvailable === null) { kiStatus.textContent = ""; return; }
  kiStatus.className = `ki-status ${kiAvailable ? "ki-ok" : "ki-off"}`;
  if (!kiAvailable) {
    kiStatus.textContent = "KI nicht aktiv — 'KI einrichten.bat' ausführen oder Felder manuell füllen";
  } else {
    kiStatus.textContent = kiModel ? `KI bereit (lokal, ${kiModel})` : "KI bereit (lokal)";
  }
}

const STRUCTURE_REQUIRED_KEYS = ["core", "agreement", "open", "watch"];
const CLINICAL_CLAIM_TERMS = [
  "adhs",
  "bipolar",
  "borderline",
  "depression",
  "manie",
  "ptbs",
  "psychose",
  "schizophren"
];
const UNSUPPORTED_CARE_PATTERNS = [
  { label: "Facharzt", pattern: /\bfacharzt\b|\bfachärzt\w*/i },
  { label: "Überweisung", pattern: /\büberweis\w*|\bueberweis\w*/i },
  { label: "Medikation", pattern: /\bmedikation\b|\bmedikament\w*|\bmedikamentös\w*|\bmedikamentoes\w*/i },
  { label: "Klinik/Einweisung", pattern: /\bklinik\w*|\bstationär\w*|\bstationaer\w*|\bnotaufnahme\b|\beinweisung\w*/i }
];

function textContainsTerm(text, term) {
  return new RegExp(`\\b${term}\\w*`, "i").test(text || "");
}

function validateStructuredResult(parsed, sourceInput, patientId = "") {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("KI-Antwort ist kein Objekt");
  }
  const missing = STRUCTURE_REQUIRED_KEYS.filter((key) => typeof parsed[key] !== "string");
  if (missing.length) {
    throw new Error(`KI-Antwort unvollständig: ${missing.join(", ")}`);
  }

  const outputText = STRUCTURE_REQUIRED_KEYS.map((key) => parsed[key] || "").join(" ");
  const outputIds = outputText.match(/\bP-[A-Za-z0-9-]+\b/g) || [];
  const inventedIds = outputIds.filter((id) => {
    if (patientId && id !== patientId) return true;
    return !patientId && !sourceInput.includes(id);
  });
  if (inventedIds.length) {
    throw new Error(`KI-Antwort enthält fremde oder nicht belegte Patientenkürzel: ${inventedIds.join(", ")}`);
  }

  const unsupportedTerms = CLINICAL_CLAIM_TERMS.filter(
    (term) => textContainsTerm(outputText, term) && !textContainsTerm(sourceInput, term)
  );
  if (unsupportedTerms.length) {
    throw new Error(`KI-Antwort enthält nicht belegte klinische Begriffe: ${unsupportedTerms.join(", ")}`);
  }

  const unsupportedCare = UNSUPPORTED_CARE_PATTERNS
    .filter(({ pattern }) => pattern.test(outputText) && !pattern.test(sourceInput || ""))
    .map(({ label }) => label);
  if (unsupportedCare.length) {
    throw new Error(`KI-Antwort enthält nicht belegte Versorgungs-/Therapieempfehlungen: ${unsupportedCare.join(", ")}`);
  }
}

function structuredOverwriteLabels(patient, parsed) {
  const ops = [
    { key: "core", label: "Kernpunkte", cur: patient.summary.core },
    { key: "agreement", label: "Vereinbarungen", cur: patient.summary.agreement },
    { key: "open", label: "Offene Punkte", cur: patient.summary.open },
    { key: "watch", label: "Beobachtungsfokus", cur: patient.summary.watch }
  ];
  return ops
    .filter((op) => parsed[op.key] && (op.cur || "").trim() && parsed[op.key].trim() !== (op.cur || "").trim())
    .map((op) => op.label);
}

function applyStructuredResult(target, parsed, { forceOverwrite = false } = {}) {
  const canWrite = (cur) => forceOverwrite || !(cur || "").trim();

  if (parsed.core && canWrite(target.summary.core)) target.summary.core = parsed.core;
  if (parsed.agreement && canWrite(target.summary.agreement)) {
    target.summary.agreement = parsed.agreement;
    target.agreement = parsed.agreement;
  }
  if (parsed.open && canWrite(target.summary.open)) {
    target.summary.open = parsed.open;
    target.open = parsed.open;
  }
  if (parsed.watch && canWrite(target.summary.watch)) target.summary.watch = parsed.watch;

  target.prep.anchor = target.summary.agreement;
  target.prep.opening = target.focus ? `Anknüpfen an: ${clip(target.focus, 120)}` : "";
  target.prep.caution = target.summary.watch || "Fachliche Bewertung bleibt manuell.";
  target.status = "Entwurf";
}

function storePendingStructure(target, parsed, overwriteLabels) {
  target.pendingStructure = {
    id: makeId("pending"),
    createdAt: new Date().toISOString(),
    overwriteLabels,
    resolved: Array.isArray(parsed.resolved) ? parsed.resolved : [],
    result: {
      core: parsed.core || "",
      agreement: parsed.agreement || "",
      open: parsed.open || "",
      watch: parsed.watch || ""
    }
  };
  target.status = "Entwurf";
}

function resolvePendingStructure(patient) {
  const pending = normalizePendingStructure(patient.pendingStructure);
  if (!pending) {
    patient.pendingStructure = null;
    return;
  }

  const overwriteLabels = pending.overwriteLabels.length
    ? pending.overwriteLabels
    : structuredOverwriteLabels(patient, pending.result);
  const shouldApply = !overwriteLabels.length || window.confirm(
    "Für diesen Patienten liegt eine fertige KI-Strukturierung vor, die während eines Patientenwechsels abgeschlossen wurde.\n\n" +
    "Folgende Felder enthalten bereits Notizen und würden ersetzt:\n\n" +
    overwriteLabels.map((label) => `• ${label}`).join("\n") +
    "\n\nJetzt übernehmen?"
  );

  if (shouldApply) {
    applyStructuredResult(patient, pending.result, { forceOverwrite: true });
    // KI-Vorschlag „scheint erledigt" auch für die im Hintergrund abgeschlossene Strukturierung.
    patient.resolvedSuggestions = matchResolvedSuggestions(patient, pending.resolved);
    showToast("Ausstehende Strukturierung übernommen. Bitte fachlich prüfen.");
  } else {
    showToast("Ausstehende Strukturierung verworfen. Bestehende Felder bleiben unverändert.");
  }

  patient.pendingStructure = null;
  savePatients();
}

// Baut die Eingabe für die KI: Transkript plus bereits in Felder eingetragene
// Notizen, damit nachträglich diktierte/getippte Ergänzungen nicht verloren gehen.
function buildStructureInput(patient) {
  let input = patient.transcript?.trim() || "";
  input += buildMemoryContext(patient);
  const fields = [
    ["Beobachtungsfokus", patient.focus],
    ["Letzte Vereinbarung", patient.agreement],
    ["Top-Level offene Punkte", patient.open],
    ["Kernpunkte", patient.summary?.core],
    ["Vereinbarungen", patient.summary?.agreement],
    ["Offene Punkte", patient.summary?.open],
    ["Beobachtung für nächsten Termin", patient.summary?.watch]
  ];
  const notes = fields
    .map(([label, val]) => [label, (val || "").trim()])
    .filter(([, val]) => val)
    .map(([label, val]) => `- ${label}: ${val}`);
  if (notes.length) {
    input += "\n\nBereits in Felder eingetragene Notizen (in die Strukturierung einbeziehen, nicht verwerfen):\n" + notes.join("\n");
  }
  return input;
}

async function structureTranscript() {
  const patient = getPatient();
  if (!patient) return;
  const transcript = patient.transcript?.trim();
  if (!transcript) {
    showToast("Bitte zuerst eine Nachnotiz diktieren oder eintragen.");
    return;
  }

  const words = countWords(transcript);
  if (words >= TRANSCRIPT_WORDS_CRIT) {
    showToast(`Transkript hat ${words} Wörter — bitte in mehrere Memos aufteilen (max. ~5000).`);
    return;
  }

  if (kiAvailable !== true) await checkKiAvailability();
  if (!kiAvailable) {
    showToast("KI nicht aktiv. Bitte 'KI einrichten.bat' ausführen und die App neu starten.");
    return;
  }

  // Patienten-UID merken — falls während der Anfrage gewechselt wird, schreiben wir
  // trotzdem in den richtigen Patienten und springen NICHT auf review.
  const lockedUid = patient.uid;
  const lockedPatientId = patient.id;

  structureButton.disabled = true;
  processingStatus.textContent = "KI strukturiert… (kann 30-90 s dauern)";
  const structureInput = buildStructureInput(patient);

  try {
    const r = await fetch("/api/structure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Bereits in Felder eingetragene Notizen mitgeben, damit Nachträge nach der
      // ersten Strukturierung nicht verloren gehen.
      body: JSON.stringify({ transcript: structureInput, patientId: lockedPatientId })
    });
    const data = await r.json();
    if (!r.ok || !data.ok) throw new Error(data.error || "Fehler");

    // Server liefert open/watch teils als Array — vor der String-Validierung normalisieren.
    const rawResult = data.result || {};
    const parsed = { ...rawResult };
    for (const key of ["core", "agreement", "open", "watch"]) {
      const v = parsed[key];
      parsed[key] = Array.isArray(v) ? v.filter(Boolean).join("; ") : (v == null ? "" : String(v));
    }
    validateStructuredResult(parsed, structureInput, lockedPatientId);
    const target = patients.find((p) => p.uid === lockedUid);
    if (!target) throw new Error("Patient nicht mehr vorhanden");

    // Vor dem Überschreiben prüfen: welche Felder haben bereits Inhalt, der durch
    // abweichenden KI-Text ersetzt würde?
    const overwriteLabels = structuredOverwriteLabels(target, parsed);

    let allowOverwrite = true;
    if (overwriteLabels.length) {
      if (selectedUid === lockedUid) {
        allowOverwrite = window.confirm(
          "Folgende Felder enthalten bereits Notizen und würden durch die neue KI-Strukturierung ersetzt:\n\n" +
          overwriteLabels.map((l) => `• ${l}`).join("\n") +
          "\n\nVorhandene Notizen wurden der KI als Kontext mitgegeben. Trotzdem ersetzen?"
        );
      } else {
        // Patient nicht sichtbar: nicht stillschweigend überschreiben und das
        // Ergebnis nicht verwerfen. Beim Zurückwechseln wird der Merge bestätigt.
        storePendingStructure(target, parsed, overwriteLabels);
        savePatients();
        renderPatients();
        showToast(`Strukturierung für ${target.id} fertig — beim Zurückwechseln übernehmen oder verwerfen.`);
        return;
      }
    }
    applyStructuredResult(target, parsed, { forceOverwrite: allowOverwrite });
    // KI-Vorschlag „scheint erledigt": nur als Vorschlag merken, niemals automatisch anwenden.
    target.resolvedSuggestions = matchResolvedSuggestions(target, parsed.resolved);

    savePatients();

    if (selectedUid === lockedUid) {
      activeStep = "review";
      renderAll();
      showToast("Nachnotiz strukturiert. Bitte alle Felder prüfen und ggf. anpassen.");
    } else {
      renderPatients();
      showToast(`Strukturierung für ${target.id} fertig — beim nächsten Wechsel sichtbar.`);
    }
  } catch (err) {
    showToast("Strukturierung fehlgeschlagen — bitte Felder manuell ausfüllen.");
    processingStatus.textContent = "Fehler";
  } finally {
    structureButton.disabled = false;
    if (processingStatus.textContent.startsWith("KI strukturiert")) {
      processingStatus.textContent = patient.status === "Geprüft" ? "Fachlich geprüft" : "Editierbarer Entwurf";
    }
  }
}

// ============================================================
// DIKTAT — MediaRecorder lokal → faster-whisper (alle Browser, offline)
// ============================================================

function formatTimer(value) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

async function checkWhisperAvailability() {
  if (window.location.protocol === "file:") { whisperAvailable = false; return; }
  try {
    const r = await fetch("/api/transcribe-status", { signal: AbortSignal.timeout(1500) });
    if (r.ok) {
      const data = await r.json();
      whisperAvailable = Boolean(data.available);
    } else {
      whisperAvailable = false;
    }
  } catch {
    whisperAvailable = false;
  }
  if (recordStatus && !isRecording) recordStatus.textContent = "Bereit";
}

function startDictation() {
  startDictationForField(transcriptInput, {
    button: recordButton,
    useGlobalStatus: true,
    startMessage: "Diktat läuft — Nachnotiz einsprechen, dann nochmal klicken.",
    stopMessage: "Aufnahme beendet. Text wird verarbeitet…"
  });
}

async function startDictationForField(target, options = {}) {
  if (isRecording) {
    const sameTarget = activeDictationTarget === target;
    await stopDictation(sameTarget);
    if (sameTarget) return;
  }

  if (!whisperAvailable) {
    // Bei jedem Versuch erneut prüfen (Server könnte zwischenzeitlich gestartet sein)
    await checkWhisperAvailability();
  }

  if (!whisperAvailable) {
    showToast("Diktat erst nach Ausführen von 'KI einrichten.bat' verfügbar. Aus Datenschutzgründen kein Cloud-Diktat.");
    return;
  }

  await startMediaRecordingForField(target, options);
}

async function startMediaRecordingForField(target, options = {}) {
  // Patient zum Aufnahme-START festhalten. Wird der Patient während der Aufnahme
  // gewechselt (Klick-Handler setzt selectedUid, bevor er stopDictation aufruft),
  // muss das Audio trotzdem beim ursprünglichen Patienten landen.
  const recordingPatientUid = getPatient()?.uid || null;

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    showToast("Mikrofonzugriff verweigert. Bitte in den Browser-Einstellungen erlauben.");
    return;
  }

  const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ? "audio/webm;codecs=opus"
    : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
    ? "audio/ogg;codecs=opus"
    : MediaRecorder.isTypeSupported("audio/webm")
    ? "audio/webm"
    : "";

  audioChunks = [];
  mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) audioChunks.push(e.data);
  };

  mediaRecorder.onstop = async () => {
    stream.getTracks().forEach((t) => t.stop());
    const blob = new Blob(audioChunks, { type: mediaRecorder?.mimeType || "audio/webm" });
    audioChunks = [];
    await sendAudioForTranscription(blob, target, options, recordingPatientUid);
  };

  mediaRecorder.start(250);

  isRecording = true;
  activeDictationTarget = target;
  activeFieldButton = options.button || null;
  seconds = 0;
  if (activeFieldButton) activeFieldButton.classList.add("recording");
  waveform.classList.add("active");
  if (options.useGlobalStatus) recordStatus.textContent = "Nimmt auf";
  recordTimer.textContent = "00:00";
  timer = window.setInterval(() => { seconds += 1; recordTimer.textContent = formatTimer(seconds); }, 1000);
  target.focus();
  showToast(options.startMessage || "Diktat läuft — zum Beenden nochmal klicken.");
}

async function sendAudioForTranscription(blob, target, options, lockedPatientUid) {
  // Schutz vor leeren / sehr kurzen Aufnahmen (< 0.5 s ergibt meist Müll)
  if (blob.size < 4000) {
    showToast("Aufnahme zu kurz. Bitte länger sprechen.");
    if (options.useGlobalStatus) {
      processingStatus.textContent = target.value?.trim() ? "Transkript bereit" : "Noch nicht verarbeitet";
      recordStatus.textContent = "Bereit";
    }
    return;
  }

  // lockedPatientUid stammt aus dem Aufnahme-START (startMediaRecordingForField),
  // nicht aus dem Stop-Zeitpunkt — sonst würde ein Patientenwechsel das Audio
  // dem falschen Patienten zuordnen.

  if (options.useGlobalStatus) {
    processingStatus.textContent = "Transkription läuft…";
    recordStatus.textContent = "Verarbeite…";
  }
  if (options.button) options.button.disabled = true;

  try {
    const r = await fetch("/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": blob.type || "audio/webm" },
      body: blob
    });
    const data = await r.json();
    if (!r.ok || !data.ok) throw new Error(data.error || "Fehler");

    const text = (data.text || "").trim();
    if (!text) {
      showToast("Keine Sprache erkannt. Bitte nochmal versuchen.");
      return;
    }

    // Schreibe in das ursprüngliche Field-Element, oder bei Patientenwechsel direkt in den Datensatz
    const currentPatient = getPatient();
    if (currentPatient?.uid === lockedPatientUid && document.body.contains(target)) {
      const existing = (target.value || "").trim();
      target.value = existing ? `${existing} ${text}` : text;
      setFieldDictationValue(target, target.value);
      showToast("Transkription abgeschlossen. Bitte Text prüfen.");
    } else {
      // Patient hat in der Zwischenzeit gewechselt → direkt in den Datensatz schreiben
      const lockedPatient = patients.find((p) => p.uid === lockedPatientUid);
      if (lockedPatient) {
        const existing = (lockedPatient.transcript || "").trim();
        lockedPatient.transcript = existing ? `${existing} ${text}` : text;
        lockedPatient.status = "Entwurf";
        savePatients();
        showToast(`Transkription für ${lockedPatient.id} gespeichert.`);
      }
    }
  } catch {
    showToast("Transkription fehlgeschlagen. Bitte 'KI einrichten.bat' prüfen.");
    if (options.useGlobalStatus) processingStatus.textContent = "Fehler";
  } finally {
    if (options.useGlobalStatus) {
      processingStatus.textContent = target.value?.trim() ? "Transkript bereit" : "Noch nicht verarbeitet";
      recordStatus.textContent = "Bereit";
    }
    if (options.button) options.button.disabled = false;
  }
}

function setFieldDictationValue(target, value) {
  target.value = value;
  const patient = getPatient();
  if (patient) { patient.status = "Entwurf"; statusSelect.value = patient.status; }
  target.dispatchEvent(new Event("input", { bubbles: true }));
  savePatients();
  renderPatients();
}

async function stopDictation(shouldShowToast) {
  if (timer) { window.clearInterval(timer); timer = null; }

  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop(); // triggert onstop → sendAudioForTranscription
    mediaRecorder = null;
  }

  isRecording = false;
  if (activeFieldButton) activeFieldButton.classList.remove("recording");
  waveform.classList.remove("active");
  activeDictationTarget = null;
  activeFieldButton = null;
  if (shouldShowToast) showToast("Aufnahme beendet. Wird verarbeitet…");
}

// ============================================================
// FIELD DICTATION ENHANCEMENT
// ============================================================

function enhanceFieldDictation() {
  fieldDictationTargets.forEach((target) => {
    if (target.closest(".dictation-shell") || target.closest(".no-field-dictation")) return;

    const shell = document.createElement("div");
    shell.className = "dictation-shell";
    target.parentNode.insertBefore(shell, target);
    shell.appendChild(target);

    const button = document.createElement("button");
    button.className = "field-dictate-button";
    button.type = "button";
    button.title = "In dieses Feld diktieren";
    button.setAttribute("aria-label", `In Feld ${getFieldLabel(target)} diktieren`);
    button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"></path>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
      <path d="M12 19v3"></path>
    </svg>`;
    shell.appendChild(button);

    button.addEventListener("click", () => {
      startDictationForField(target, {
        button,
        append: false,
        startMessage: `Diktat für „${getFieldLabel(target)}" läuft.`
      });
    });
  });
}

function getFieldLabel(target) {
  const label = target.closest("label");
  const labelText = label?.querySelector("span")?.textContent?.trim();
  const panelText = target.closest(".panel")?.querySelector("h3")?.textContent?.trim();
  return labelText || panelText || "Textfeld";
}

// ============================================================
// TOAST
// ============================================================

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.remove("visible"), 4000);
}

// ============================================================
// EVENTS
// ============================================================

document.addEventListener("input", (event) => {
  const t = event.target;
  if (t.dataset.field) updatePatientField(t.dataset.field, t.value, t);
  if (t.dataset.summary) updateSummaryField(t.dataset.summary, t.value);
  if (t.dataset.prep) updatePrepField(t.dataset.prep, t.value);
  if (t.dataset.closure) updateClosureField(t.dataset.closure, t.value);
  if (t.dataset.sessionSummary) updateSessionSummary(t.dataset.sessionId, t.dataset.sessionSummary, t.value);
  if (t.dataset.sessionField) updateSessionField(t.dataset.sessionId, t.dataset.sessionField, t.value);
});

document.addEventListener("change", (event) => {
  const t = event.target;
  if (t.dataset.field) updatePatientField(t.dataset.field, t.value, t);
  if (t.dataset.summary) updateSummaryField(t.dataset.summary, t.value);
  if (t.dataset.prep) updatePrepField(t.dataset.prep, t.value);
  if (t.dataset.closure) updateClosureField(t.dataset.closure, t.value);
  if (t.dataset.sessionSummary) updateSessionSummary(t.dataset.sessionId, t.dataset.sessionSummary, t.value);
  if (t.dataset.sessionField) updateSessionField(t.dataset.sessionId, t.dataset.sessionField, t.value);
});

patientIdInput.addEventListener("input", () => {
  const patient = getPatient();
  if (!patient) return;
  patient.id = patientIdInput.value || "P-?";
  savePatients();
  renderPatients();
});

statusSelect.addEventListener("change", () => {
  const patient = getPatient();
  if (!patient) return;
  if (statusSelect.value === "Geprüft") {
    statusSelect.value = patient.status;
    activeStep = "review";
    setActiveStep(activeStep);
    showToast("Bitte mit 'Geprüft speichern' prüfen und archivieren.");
    return;
  }
  patient.status = normalizeEditStatus(statusSelect.value);
  savePatients();
  renderAll();
});

caseStatusSelect?.addEventListener("change", () => {
  const patient = getPatient();
  if (!patient) return;
  patient.caseStatus = normalizeCaseStatus({ caseStatus: caseStatusSelect.value });
  patient.archived = patient.caseStatus === "archiviert";
  savePatients();
  renderAll();
  showToast(`Fallstatus: ${caseStatusLabel(patient.caseStatus)}.`);
});

newSessionButton.addEventListener("click", () => { stopDictation(false); startNewSession(); });
exportPatientButton.addEventListener("click", () => { stopDictation(false); exportCurrentPatient("akte"); });
workExportPatientButton?.addEventListener("click", () => { stopDictation(false); exportCurrentPatient("arbeitsnotiz"); });
backupButton.addEventListener("click", () => { stopDictation(false); createManualBackup(); });
restoreButton.addEventListener("click", () => restoreInput.click());
restoreInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (file) await restoreFromFile(file);
  restoreInput.value = "";
});
addPatientButton.addEventListener("click", addPatient);
deletePatientButton.addEventListener("click", deletePatient);
if (archivePatientButton) {
  archivePatientButton.addEventListener("click", () => {
    const patient = getPatient();
    if (!patient) return;
    patient.caseStatus = patient.caseStatus === "archiviert" ? "aktiv" : "archiviert";
    patient.archived = patient.caseStatus === "archiviert";
    savePatients();
    renderAll();
    showToast(patient.archived ? `Patient ${patient.id} archiviert.` : `Patient ${patient.id} reaktiviert.`);
  });
}
patientSearch.addEventListener("input", renderPatients);
recordButton.addEventListener("click", startDictation);
structureButton.addEventListener("click", structureTranscript);
approveButton.addEventListener("click", approveCurrent);
document.addEventListener("click", (event) => {
  if (event.target.closest("[data-add-patient-empty]")) addPatient();
});
quickPrep?.addEventListener("click", (event) => {
  if (!event.target.closest("[data-open-prep]")) return;
  activeStep = "prep";
  setActiveStep("prep");
});

openPoints?.addEventListener("click", (event) => {
  const patient = getPatient();
  if (!patient) return;
  const resolveId = event.target.closest("[data-resolve]")?.dataset.resolve;
  if (resolveId) {
    if (resolveMemoryItem(patient, resolveId)) {
      patient.resolvedSuggestions = (patient.resolvedSuggestions || []).filter((id) => id !== resolveId);
      savePatients();
      renderAll();
      showToast("Punkt abgehakt.");
    }
    return;
  }
  const dismissId = event.target.closest("[data-dismiss]")?.dataset.dismiss;
  if (dismissId) {
    patient.resolvedSuggestions = (patient.resolvedSuggestions || []).filter((id) => id !== dismissId);
    savePatients();
    renderAll();
  }
});

openAddForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const patient = getPatient();
  if (!patient) return;
  if (addOpenPoint(patient, openAddInput.value)) {
    openAddInput.value = "";
    savePatients();
    renderAll();
    showToast("Offener Punkt ergänzt.");
  }
});

document.querySelectorAll(".workflow-step").forEach((btn) => {
  btn.addEventListener("click", () => setActiveStep(btn.dataset.step));
});

// ============================================================
// INIT
// ============================================================

enhanceFieldDictation();
renderAll();
hydrateFromServer();
checkKiAvailability();
checkWhisperAvailability();
