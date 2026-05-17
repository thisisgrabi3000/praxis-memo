// ============================================================
// CONSTANTS
// ============================================================
const STORAGE_KEY = "praxismemo-v8";
const SERVER_SAVE_DELAY = 650;

// ============================================================
// DATA FACTORIES
// ============================================================

function createEmptyPatient(uid, id) {
  return {
    uid,
    id,
    status: "Offen",
    nextDate: "",
    nextTime: "",
    focus: "",
    agreement: "",
    open: "",
    transcript: "",
    summary: { core: "", agreement: "", open: "", watch: "" },
    prep: { anchor: "", opening: "", caution: "" },
    currentSessionId: `${uid}-current`,
    sessions: []
  };
}

function createSession({ id, date, time, status = "Geprüft", focus, agreement, open, watch, transcript, summary, prep }) {
  const safeFocus = focus || "Fokus ergänzen";
  const safeAgreement = agreement || "Vereinbarung ergänzen.";
  const safeOpen = open || "Offene Punkte ergänzen.";
  return {
    id,
    date,
    time: time || "08:00",
    status,
    focus: safeFocus,
    transcript: transcript || `Nachnotiz: Fokus war ${safeFocus}. Vereinbart: ${safeAgreement}`,
    summary: {
      core: summary?.core || `Schwerpunkt: ${safeFocus}.`,
      agreement: summary?.agreement || safeAgreement,
      open: summary?.open || safeOpen,
      watch: summary?.watch || watch || "Beim nächsten Termin fachlich prüfen."
    },
    prep: {
      anchor: prep?.anchor || safeAgreement,
      opening: prep?.opening || `Anknüpfen an: ${safeFocus}.`,
      caution: prep?.caution || "Fachliche Bewertung bleibt manuell."
    }
  };
}

function normalizePatient(raw) {
  const uid = raw.uid || `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return {
    uid,
    id: raw.id || "P-?",
    status: raw.status || "Offen",
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
    currentSessionId: raw.currentSessionId || `${uid}-current`,
    sessions: Array.isArray(raw.sessions) ? raw.sessions.map(normalizeSession) : []
  };
}

function normalizeSession(s) {
  return createSession({
    id: s.id || `session-${Date.now()}`,
    date: s.date || todayIso(),
    time: s.time || "08:00",
    status: s.status || "Geprüft",
    focus: s.focus,
    transcript: s.transcript,
    summary: s.summary,
    prep: s.prep
  });
}

// ============================================================
// STATE
// ============================================================
let patients = loadPatients();
let selectedUid = patients[0]?.uid || null;
let activeStep = "record";
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
    return Array.isArray(parsed) && parsed.length ? parsed.map(normalizePatient) : [];
  } catch {
    return [];
  }
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
    if (Array.isArray(payload.patients) && payload.patients.length) {
      patients = payload.patients.map(normalizePatient);
      if (!patients.some((p) => p.uid === selectedUid)) {
        selectedUid = patients[0]?.uid || null;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(patients));
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

function downloadBackupFile() {
  const payload = getStoragePayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  a.href = url;
  a.download = `praxismemo-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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
const recordButton = document.querySelector("#recordButton");
const recordStatus = document.querySelector("#recordStatus");
const recordTimer = document.querySelector("#recordTimer");
const waveform = document.querySelector("#waveform");
const transcriptInput = document.querySelector("#transcriptInput");
const processingStatus = document.querySelector("#processingStatus");
const structureButton = document.querySelector("#structureButton");
const approveButton = document.querySelector("#approveButton");
const newSessionButton = document.querySelector("#newSessionButton");
const storageStatus = document.querySelector("#storageStatus");
const backupButton = document.querySelector("#backupButton");
const restoreButton = document.querySelector("#restoreButton");
const restoreInput = document.querySelector("#restoreInput");
const addPatientButton = document.querySelector("#addPatientButton");
const deletePatientButton = document.querySelector("#deletePatientButton");
const sessionHistory = document.querySelector("#sessionHistory");
const sessionCountBadge = document.querySelector("#sessionCountBadge");
const contextPrepBrief = document.querySelector("#contextPrepBrief");
const contextHistory = document.querySelector("#contextHistory");
const contextSessionCount = document.querySelector("#contextSessionCount");
const kiStatus = document.querySelector("#kiStatus");
const lengthWarning = document.querySelector("#lengthWarning");
const demoBanner = document.querySelector("#demoBanner");
const toast = document.querySelector("#toast");
let kiMode = "local"; // 'local' (Ollama) oder 'openai-demo'
const fieldDictationTargets = document.querySelectorAll("[data-field], [data-summary], [data-prep]");

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

  deletePatientButton.disabled = false;
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

  processingStatus.textContent = patient.status === "Geprüft" ? "Fachlich geprüft" : "Editierbarer Entwurf";
  updateTranscriptLengthWarning(patient.transcript);
  renderStorageStatus();
  renderSessionHistory(patient);
  renderContextPanel(patient);
  renderPatients();
  setActiveStep(activeStep);
}

function renderEmptyState() {
  deletePatientButton.disabled = true;
  patientIdInput.value = "";
  statusSelect.value = "Offen";
  patientMeta.textContent = "Noch keine Patienten angelegt";
  document.querySelectorAll("[data-field], [data-summary], [data-prep]").forEach((f) => (f.value = ""));
  processingStatus.textContent = "";
  updateTranscriptLengthWarning("");
  if (sessionHistory) sessionHistory.innerHTML = "";
  if (contextPrepBrief) contextPrepBrief.innerHTML = "";
  if (contextHistory) contextHistory.innerHTML = "";
  if (sessionCountBadge) sessionCountBadge.textContent = "0 Einträge";
  if (contextSessionCount) contextSessionCount.textContent = "0 Einträge";
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

function renderPatients() {
  const query = patientSearch.value.trim().toLowerCase();
  const visible = patients.filter((p) => patientMatchesQuery(p, query));
  const sorted = [...visible].sort(sortByDateAndTime);
  const groups = groupPatientsByDate(sorted);

  if (!sorted.length) {
    patientList.innerHTML = `
      <div class="empty-patients">
        <strong>${query ? "Keine Treffer" : "Noch keine Patienten"}</strong>
        <span>${query ? "Suche anpassen." : "Oben auf „Patient anlegen“ klicken."}</span>
      </div>`;
    return;
  }

  patientList.innerHTML = groups
    .map(([dateKey, group]) => {
      const isOpen = Boolean(query) || group.some((p) => p.uid === selectedUid) || dateKey === todayIso();
      const label = formatDateGroup(dateKey);
      const isToday = dateKey === todayIso();
      return `
      <details class="day-group"${isOpen ? " open" : ""}>
        <summary class="day-heading${isToday ? " day-today" : ""}">
          <span class="day-title">
            <span class="day-name">${escapeHtml(label)}</span>
            ${dateKey && dateKey !== "0000" ? `<small class="day-date">${escapeHtml(formatDateShort(dateKey))}</small>` : ""}
          </span>
          <em>${group.length} ${group.length === 1 ? "Termin" : "Termine"}</em>
        </summary>
        ${group.map((p) => {
          const active = p.uid === selectedUid ? " active" : "";
          // Snippet nur zeigen, wenn nicht direkt durch Patientenkürzel gematcht
          const idMatched = query && p.id.toLowerCase().includes(query);
          const contentHit = !idMatched && query ? findContentMatch(p, query) : null;
          return `
          <button class="patient-button${active}" type="button" data-uid="${escapeHtml(p.uid)}" data-search-hit="${contentHit ? "1" : ""}">
            <strong>${escapeHtml(p.id)}</strong>
            <span class="mini-status">${escapeHtml(p.status)}</span>
            <span>${escapeHtml(p.nextTime || "Uhrzeit offen")}</span>
            <span class="patient-focus">${escapeHtml(clip(p.focus || p.agreement, 92))}</span>
            ${contentHit ? `<span class="patient-search-hit">${escapeHtml(contentHit.source)}: ${escapeHtml(contentHit.snippet)}</span>` : ""}
          </button>`;
        }).join("")}
      </details>`;
    })
    .join("");

  patientList.querySelectorAll(".patient-button").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedUid = btn.dataset.uid;
      stopDictation(false);
      // Wenn der Treffer aus einer Inhaltssuche kam, direkt ins Archiv springen
      activeStep = btn.dataset.searchHit === "1" ? "prep" : "record";
      renderAll();
    });
  });
}

function groupPatientsByDate(list) {
  const map = new Map();
  for (const p of list) {
    const key = p.nextDate || "0000";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(p);
  }
  return Array.from(map.entries()).sort(([a], [b]) => {
    if (a === "0000") return 1;
    if (b === "0000") return -1;
    return a.localeCompare(b);
  });
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

function getLastCheckedSession(patient) {
  const sorted = sortSessions(patient.sessions || []);
  return sorted.find((s) => s.status === "Geprüft") || sorted[0] || null;
}

function renderSessionHistory(patient) {
  if (!sessionHistory) return;
  const sessions = sortSessions(patient.sessions || []);
  if (sessionCountBadge) {
    sessionCountBadge.textContent = `${sessions.length} ${sessions.length === 1 ? "Eintrag" : "Einträge"}`;
  }

  if (!sessions.length) {
    sessionHistory.innerHTML = `
      <div class="empty-history">
        <strong>Noch kein archivierter Eintrag</strong>
        <span>Nach dem Prüfen wird die Sitzung hier als Verlauf gespeichert.</span>
      </div>`;
    return;
  }

  sessionHistory.innerHTML = sessions.map((session, i) => `
    <details class="session-item"${i === 0 ? " open" : ""}>
      <summary class="session-summary">
        <span class="session-date">${escapeHtml(formatDateShort(session.date))}</span>
        <strong>${escapeHtml(clip(session.focus, 58))}</strong>
        <span class="mini-status">${escapeHtml(session.status)}</span>
      </summary>
      <div class="session-fields">
        <label class="field">
          <span>Kernpunkte</span>
          <textarea data-session-id="${escapeHtml(session.id)}" data-session-summary="core" rows="3">${escapeHtml(session.summary.core)}</textarea>
        </label>
        <label class="field important-field">
          <span>Absprachen</span>
          <textarea data-session-id="${escapeHtml(session.id)}" data-session-summary="agreement" rows="3">${escapeHtml(session.summary.agreement)}</textarea>
        </label>
        <label class="field">
          <span>Offen</span>
          <textarea data-session-id="${escapeHtml(session.id)}" data-session-summary="open" rows="3">${escapeHtml(session.summary.open)}</textarea>
        </label>
        <label class="field session-transcript">
          <span>Transkript</span>
          <textarea data-session-id="${escapeHtml(session.id)}" data-session-field="transcript" rows="4">${escapeHtml(session.transcript)}</textarea>
        </label>
      </div>
    </details>`).join("");
}

function renderContextPanel(patient) {
  const sessions = sortSessions(patient.sessions || []);
  const latest = getLastCheckedSession(patient);
  if (contextSessionCount) {
    contextSessionCount.textContent = `${sessions.length} ${sessions.length === 1 ? "Eintrag" : "Einträge"}`;
  }

  if (contextPrepBrief) {
    contextPrepBrief.innerHTML = latest
      ? `<p><strong>Anknüpfen</strong>${escapeHtml(latest.summary.agreement)}</p>
         <p><strong>Offen</strong>${escapeHtml(latest.summary.open)}</p>
         <p><strong>Letzter Fokus</strong>${escapeHtml(latest.focus)}</p>`
      : `<p><strong>Noch kein Verlauf</strong>Nach dem ersten geprüften Eintrag entsteht hier die Vorbereitung.</p>`;
  }

  if (!contextHistory) return;
  contextHistory.innerHTML = sessions.length
    ? sessions.slice(0, 5).map((s) => `
        <div class="compact-history-item">
          <span>${escapeHtml(formatDateShort(s.date))} · ${escapeHtml(s.status)}</span>
          <strong>${escapeHtml(clip(s.focus, 72))}</strong>
          <p>${escapeHtml(clip(s.summary.agreement || s.summary.core, 110))}</p>
        </div>`).join("")
    : `<div class="empty-history"><strong>Kein Verlauf</strong><span>Noch keine Sitzung archiviert.</span></div>`;
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

function getSessionById(sessionId) {
  return (getPatient()?.sessions || []).find((s) => s.id === sessionId);
}

function updateSessionSummary(sessionId, fieldName, value) {
  const session = getSessionById(sessionId);
  if (!session) return;
  session.summary[fieldName] = value;
  savePatients();
  renderContextPanel(getPatient());
}

function updateSessionField(sessionId, fieldName, value) {
  const session = getSessionById(sessionId);
  if (!session) return;
  session[fieldName] = value;
  savePatients();
}

// ============================================================
// SESSION MANAGEMENT
// ============================================================

function buildSessionFromCurrent(patient) {
  const existing = (patient.sessions || []).find((s) => s.id === patient.currentSessionId);
  return createSession({
    id: patient.currentSessionId || `session-${patient.uid}-${Date.now()}`,
    date: existing?.date || todayIso(),
    time: existing?.time || patient.nextTime || "08:00",
    status: "Geprüft",
    focus: patient.focus,
    agreement: patient.summary.agreement || patient.agreement,
    open: patient.summary.open || patient.open,
    transcript: patient.transcript,
    summary: patient.summary,
    prep: patient.prep
  });
}

function archiveCurrentSession(patient) {
  const archived = buildSessionFromCurrent(patient);
  const idx = (patient.sessions || []).findIndex((s) => s.id === archived.id);
  if (idx >= 0) {
    patient.sessions[idx] = archived;
  } else {
    patient.sessions = [archived, ...(patient.sessions || [])];
  }
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
  patient.currentSessionId = `session-${patient.uid}-${Date.now()}`;
  patient.status = "Offen";
  patient.transcript = "";
  patient.summary = { core: "", agreement: latest?.summary?.agreement || "", open: latest?.summary?.open || "", watch: "" };
  patient.focus = latest?.focus || patient.focus || "";
  patient.agreement = latest?.summary?.agreement || patient.agreement || "";
  patient.open = latest?.summary?.open || patient.open || "";
  patient.prep = latest
    ? { anchor: latest.summary.agreement, opening: `Anknüpfen an: ${clip(latest.focus, 120)}`, caution: latest.summary.watch || "Fachlich prüfen." }
    : { anchor: "", opening: "", caution: "Fachlich prüfen, bevor Inhalte übernommen werden." };

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
  const uid = `p-${Date.now()}`;
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
    } else {
      kiAvailable = false;
    }
  } catch {
    kiAvailable = false;
  }
  renderKiStatus();
  renderDemoBanner();
}

function renderKiStatus() {
  if (!kiStatus) return;
  if (kiAvailable === null) { kiStatus.textContent = ""; return; }
  kiStatus.className = `ki-status ${kiAvailable ? "ki-ok" : "ki-off"}`;
  if (!kiAvailable) {
    kiStatus.textContent = "KI nicht aktiv — 'KI einrichten.bat' ausführen oder Felder manuell füllen";
  } else if (kiMode === "openai-demo") {
    kiStatus.textContent = "KI bereit (Demo: OpenAI Cloud)";
  } else {
    kiStatus.textContent = "KI bereit (lokal)";
  }
}

function renderDemoBanner() {
  if (!demoBanner) return;
  demoBanner.hidden = kiMode !== "openai-demo";
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

  structureButton.disabled = true;
  processingStatus.textContent = "KI strukturiert… (kann 30-90 s dauern)";

  try {
    const r = await fetch("/api/structure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript })
    });
    const data = await r.json();
    if (!r.ok || !data.ok) throw new Error(data.error || "Fehler");

    const parsed = data.result || {};
    const target = patients.find((p) => p.uid === lockedUid);
    if (!target) throw new Error("Patient nicht mehr vorhanden");

    if (parsed.core) target.summary.core = parsed.core;
    if (parsed.agreement) { target.summary.agreement = parsed.agreement; target.agreement = parsed.agreement; }
    if (parsed.open) { target.summary.open = parsed.open; target.open = parsed.open; }
    if (parsed.watch) target.summary.watch = parsed.watch;

    target.prep.anchor = target.summary.agreement;
    target.prep.opening = target.focus ? `Anknüpfen an: ${clip(target.focus, 120)}` : "";
    target.prep.caution = target.summary.watch || "Fachliche Bewertung bleibt manuell.";
    target.status = "Entwurf";

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
    await sendAudioForTranscription(blob, target, options);
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

async function sendAudioForTranscription(blob, target, options) {
  // Schutz vor leeren / sehr kurzen Aufnahmen (< 0.5 s ergibt meist Müll)
  if (blob.size < 4000) {
    showToast("Aufnahme zu kurz. Bitte länger sprechen.");
    if (options.useGlobalStatus) {
      processingStatus.textContent = target.value?.trim() ? "Transkript bereit" : "Noch nicht verarbeitet";
      recordStatus.textContent = "Bereit";
    }
    return;
  }

  // Patient-UID merken — falls währenddessen der Patient wechselt, schreiben wir trotzdem korrekt
  const lockedPatientUid = getPatient()?.uid || null;

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
  const contextText = target.closest(".context-block")?.querySelector(".eyebrow")?.textContent?.trim();
  const panelText = target.closest(".panel")?.querySelector("h3")?.textContent?.trim();
  return labelText || contextText || panelText || "Textfeld";
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
  if (t.dataset.sessionSummary) updateSessionSummary(t.dataset.sessionId, t.dataset.sessionSummary, t.value);
  if (t.dataset.sessionField) updateSessionField(t.dataset.sessionId, t.dataset.sessionField, t.value);
});

document.addEventListener("change", (event) => {
  const t = event.target;
  if (t.dataset.field) updatePatientField(t.dataset.field, t.value, t);
  if (t.dataset.summary) updateSummaryField(t.dataset.summary, t.value);
  if (t.dataset.prep) updatePrepField(t.dataset.prep, t.value);
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
  patient.status = statusSelect.value;
  if (patient.status === "Geprüft") archiveCurrentSession(patient);
  savePatients();
  renderAll();
});

newSessionButton.addEventListener("click", () => { stopDictation(false); startNewSession(); });
backupButton.addEventListener("click", () => { stopDictation(false); createManualBackup(); });
restoreButton.addEventListener("click", () => restoreInput.click());
restoreInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (file) await restoreFromFile(file);
  restoreInput.value = "";
});
addPatientButton.addEventListener("click", addPatient);
deletePatientButton.addEventListener("click", deletePatient);
patientSearch.addEventListener("input", renderPatients);
recordButton.addEventListener("click", startDictation);
structureButton.addEventListener("click", structureTranscript);
approveButton.addEventListener("click", approveCurrent);

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
