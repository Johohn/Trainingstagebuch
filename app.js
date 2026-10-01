/* ============================================================
   Trainingstagebuch – Anwendungslogik
   Datenmodell: localStorage["trainingstagebuch.v1"]
     { "YYYY-MM-DD": [ einheit, ... ], ... }
   Eine "Einheit" ist entweder
     - "typid"                        (ohne Details, altes Format)
     - { t: "typid", n: "Details" }   (mit Detail-Text)
   Beide Formen werden überall akzeptiert (kompatibel mit alten Backups).
   ============================================================ */
"use strict";

/* ---------- Konfiguration ---------- */

// Workout-Typen: hier zentral ändern (ID, Label, Farbe)
const TYPES = [
  { id: "werfen",      label: "Werfen",                    color: "#3B82F6" },
  { id: "ausdauer",    label: "Ausdauer",                  color: "#22C55E" },
  { id: "field",       label: "Field Workout (Cuts, Agility)", color: "#F97316" },
  { id: "training",    label: "Ultimate Training",         color: "#EAB308" },
  { id: "stretching",  label: "Stretching/Mobility",       color: "#EC4899" },
  { id: "beine",       label: "Beinkraft",                 color: "#A855F7" },
  { id: "oberkoerper", label: "Oberkörper Kraft",          color: "#EF4444" },
  { id: "sonstiges",   label: "Sonstiges",                 color: "#64748B" },
];

const MONTHS = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

// Kurznamen für die Monatslabels im 12-Monats-Diagramm
const MONTHS_SHORT = [
  "Jan", "Feb", "Mär", "Apr", "Mai", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
];

// Wochenstart Montag: Index 0 = Montag
const WEEKDAYS_FULL = [
  "Montag", "Dienstag", "Mittwoch", "Donnerstag",
  "Freitag", "Samstag", "Sonntag",
];

const STORAGE_KEY = "trainingstagebuch.v1";
const MAX_DOTS = 8;        // max. Punkte pro Tag im Kalender (ein Punkt pro Typ)
const MAX_NOTE_LEN = 500;  // max. Länge des Detail-Texts pro Einheit

/* ---------- Reine Hilfsfunktionen (auch von test.html genutzt) ---------- */

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** Datum -> Speicherschlüssel "YYYY-MM-DD" (m ist 0-basiert). */
function dateKey(y, m, d) {
  return y + "-" + pad2(m + 1) + "-" + pad2(d);
}

/** "YYYY-MM-DD" -> [y, m, d] (m 0-basiert) oder null bei ungültigem Format. */
function parseKey(key) {
  if (typeof key !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const y = +m[1], mo = +m[2] - 1, d = +m[3];
  if (mo < 0 || mo > 11 || d < 1 || d > 31) return null;
  return [y, mo, d];
}

/** Tage im Monat (Schaltjahre via Date korrekt). m 0-basiert. */
function daysInMonth(y, m) {
  return new Date(y, m + 1, 0).getDate();
}

/** Typ-ID einer Einheit (funktioniert für String- und Objekt-Form). */
function entryType(e) {
  return typeof e === "string" ? e : (e && typeof e === "object" ? e.t : null);
}

/** Detail-Text einer Einheit ("" wenn keine). */
function entryNote(e) {
  return e && typeof e === "object" && typeof e.n === "string" ? e.n : "";
}

/** Einheit normalisieren: immer { t, n } (n kann ""). */
function normalizeEntry(e) {
  const t = entryType(e);
  return { t, n: entryNote(e) };
}

/**
 * Einheiten kompakt speichern: ohne Details als String,
 * mit Details als { t, n }-Objekt.
 */
function packEntries(entries) {
  return entries.map((e) => (e.n ? { t: e.t, n: e.n } : e.t));
}

/**
 * Baut das Kalendergitter für einen Monat (Montag-startend).
 * Vorige/nächste Tage werden zu vollen Wochen (Vielfaches von 7) ergänzt.
 * Rückgabe: Array von Zellen { key, day, inMonth }.
 */
function buildMonthGrid(y, m) {
  const first = new Date(y, m, 1);
  // getDay(): 0 = Sonntag -> auf Montag-Index umrechnen
  const leading = (first.getDay() + 6) % 7;
  const total = daysInMonth(y, m);
  const cells = [];
  const start = new Date(y, m, 1 - leading);
  const length = Math.ceil((leading + total) / 7) * 7;
  for (let i = 0; i < length; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push({
      key: dateKey(d.getFullYear(), d.getMonth(), d.getDate()),
      day: d.getDate(),
      inMonth: d.getMonth() === m,
    });
  }
  return cells;
}

/** Deutsches Langdatum: "Donnerstag, 1. Oktober" (Jahr optional). */
function formatDateDE(key, withYear) {
  const p = parseKey(key);
  if (!p) return "";
  const date = new Date(p[0], p[1], p[2]);
  const wd = WEEKDAYS_FULL[(date.getDay() + 6) % 7];
  let s = wd + ", " + p[2] + ". " + MONTHS[p[1]];
  if (withYear) s += " " + p[0];
  return s;
}

/**
 * Monatszusammenfassung: pro Typ die Anzahl Trainings-TAGE
 * sowie die Gesamtzahl aller Trainingstage im Monat.
 */
function monthSummary(data, y, m) {
  const perType = {};
  TYPES.forEach((t) => { perType[t.id] = 0; });
  let totalDays = 0;
  const prefix = dateKey(y, m, 1).slice(0, 7); // "YYYY-MM"
  Object.keys(data).forEach((key) => {
    if (!key.startsWith(prefix)) return;
    const entries = Array.isArray(data[key]) ? data[key] : [];
    if (!entries.length) return;
    let used = false;
    entries.forEach((e) => {
      const id = entryType(e);
      if (perType[id] !== undefined) {
        perType[id] += 1;
        used = true;
      }
    });
    if (used) totalDays += 1;
  });
  return { perType, totalDays };
}

/**
 * Trainingseinheiten eines Monats: pro Typ die ANZAHL EINHEITEN
 * (Tag x Typ = 1 Einheit) und die Gesamtzahl – Grundlage fürs Diagramm.
 */
function monthUnitCounts(data, y, m) {
  const perType = {};
  TYPES.forEach((t) => { perType[t.id] = 0; });
  let total = 0;
  const prefix = dateKey(y, m, 1).slice(0, 7);
  Object.keys(data).forEach((key) => {
    if (!key.startsWith(prefix)) return;
    const entries = Array.isArray(data[key]) ? data[key] : [];
    entries.forEach((e) => {
      const id = entryType(e);
      if (perType[id] !== undefined) {
        perType[id] += 1;
        total += 1;
      }
    });
  });
  return { perType, total };
}

/** Die letzten n Monate (ältester zuerst), endend mit (y, m). */
function lastNMonths(y, m, n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    let mm = m - i;
    let yy = y;
    while (mm < 0) { mm += 12; yy -= 1; }
    out.push({ y: yy, m: mm });
  }
  return out;
}

/** Daten bereinigen: nur gültige Schlüssel, bekannte Typ-IDs, Text-Notizen. */
function sanitizeData(raw) {
  const clean = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return clean;
  Object.keys(raw).forEach((key) => {
    if (!parseKey(key)) return;
    const val = raw[key];
    if (!Array.isArray(val)) return;
    const entries = [];
    val.forEach((e) => {
      const t = entryType(e);
      if (!t || !TYPES.some((x) => x.id === t)) return;
      const note = entryNote(e);
      entries.push(note ? { t, n: note } : t);
    });
    if (entries.length) clean[key] = entries;
  });
  return clean;
}

/* ---------- Speicher ---------- */

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return sanitizeData(JSON.parse(raw));
  } catch (e) {
    showToast("Fehler beim Laden der Daten");
    return {};
  }
}

function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    showToast("Speichern fehlgeschlagen (Speicher voll oder blockiert)");
    return false;
  }
}

/* ---------- Zustand ---------- */

const state = {
  data: loadData(),
  year: new Date().getFullYear(),
  month: new Date().getMonth(), // 0-basiert
};

/* ---------- DOM-Referenzen ---------- */

const el = {
  monthLabel: document.getElementById("monthLabel"),
  calGrid: document.getElementById("calGrid"),
  calendarCard: document.getElementById("calendarCard"),
  legend: document.getElementById("legend"),
  summary: document.getElementById("summary"),
  summaryTotal: document.getElementById("summaryTotal"),
  chart: document.getElementById("chart"),
  backdrop: document.getElementById("backdrop"),
  sheet: document.getElementById("sheet"),
  sheetDate: document.getElementById("sheetDate"),
  chipGrid: document.getElementById("chipGrid"),
  detailArea: document.getElementById("detailArea"),
  btnCloseSheet: document.getElementById("btnCloseSheet"),
  settingsBackdrop: document.getElementById("settingsBackdrop"),
  settingsSheet: document.getElementById("settingsSheet"),
  btnCloseSettings: document.getElementById("btnCloseSettings"),
  dataInfo: document.getElementById("dataInfo"),
  importConfirm: document.getElementById("importConfirm"),
  importInfo: document.getElementById("importInfo"),
  toast: document.getElementById("toast"),
};

function typeById(id) {
  return TYPES.find((t) => t.id === id);
}

/* ---------- Kalender zeichnen ---------- */

function renderCalendar() {
  const { year: y, month: m, data } = state;
  el.monthLabel.textContent = MONTHS[m] + " " + y;

  const today = new Date();
  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());
  const cells = buildMonthGrid(y, m);

  el.calGrid.textContent = "";
  cells.forEach((cell) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "day";
    if (!cell.inMonth) btn.classList.add("outside");
    if (cell.key === todayKey) btn.classList.add("today");
    btn.setAttribute("aria-label", formatDateDE(cell.key, true));

    const num = document.createElement("span");
    num.className = "num";
    num.textContent = cell.day;
    btn.appendChild(num);

    // Punkte: ein farbiger Punkt pro Typ an diesem Tag (max. MAX_DOTS)
    const entries = data[cell.key] || [];
    if (entries.length) {
      const dots = document.createElement("span");
      dots.className = "dots";
      entries.slice(0, MAX_DOTS).forEach((e) => {
        const t = typeById(entryType(e));
        if (!t) return;
        const dot = document.createElement("span");
        dot.className = "dot";
        dot.style.background = t.color;
        dots.appendChild(dot);
      });
      btn.appendChild(dots);
    }

    btn.addEventListener("click", () => openSheet(cell.key));
    el.calGrid.appendChild(btn);
  });
}

/* ---------- Legende & Zusammenfassung ---------- */

function renderLegend() {
  el.legend.textContent = "";
  TYPES.forEach((t) => {
    const li = document.createElement("li");
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = t.color;
    const label = document.createElement("span");
    label.textContent = t.label;
    li.append(swatch, label);
    el.legend.appendChild(li);
  });
}

function renderSummary() {
  const { perType, totalDays } = monthSummary(state.data, state.year, state.month);
  const max = Math.max(1, ...Object.values(perType));

  el.summary.textContent = "";
  TYPES.forEach((t) => {
    const count = perType[t.id];
    const li = document.createElement("li");

    const label = document.createElement("span");
    label.className = "label";
    label.textContent = t.label;

    const track = document.createElement("span");
    track.className = "bar-track";
    const bar = document.createElement("span");
    bar.className = "bar";
    bar.style.width = (count / max) * 100 + "%";
    bar.style.background = t.color;
    track.appendChild(bar);

    const countEl = document.createElement("span");
    countEl.className = "count";
    countEl.textContent = count;

    li.append(label, track, countEl);
    el.summary.appendChild(li);
  });

  el.summaryTotal.textContent = "";
  const num = document.createElement("span");
  num.className = "num";
  num.textContent = totalDays;
  el.summaryTotal.append(num, document.createTextNode(" Trainingstage im " + MONTHS[state.month]));
}

/* ---------- 12-Monats-Diagramm ---------- */

/**
 * Balkendiagramm der letzten 12 Monate: Balkenhöhe = Anzahl Einheiten,
 * gestapelt und farbcodiert nach Kategorie (Reihenfolge wie TYPES).
 */
function renderChart() {
  const now = new Date();
  const months = lastNMonths(now.getFullYear(), now.getMonth(), 12);
  const stats = months.map(({ y, m }) => ({
    y, m,
    units: monthUnitCounts(state.data, y, m),
  }));
  const max = Math.max(1, ...stats.map((s) => s.units.total));
  const curMonth = dateKey(now.getFullYear(), now.getMonth(), 1).slice(0, 7);

  el.chart.textContent = "";
  stats.forEach((s) => {
    const mk = dateKey(s.y, s.m, 1).slice(0, 7);

    const col = document.createElement("div");
    col.className = "chart-col";

    // Gesamtzahl über dem Balken
    const total = document.createElement("span");
    total.className = "chart-total";
    total.textContent = s.units.total > 0 ? s.units.total : "";

    // Gestapelter Balken (unterste Kategorie = erste in TYPES)
    const bar = document.createElement("div");
    bar.className = "chart-bar";
    TYPES.forEach((t) => {
      const c = s.units.perType[t.id];
      if (!c) return;
      const seg = document.createElement("span");
      seg.className = "chart-seg";
      seg.style.background = t.color;
      seg.style.height = (c / max) * 100 + "%";
      seg.title = t.label + ": " + c;
      bar.appendChild(seg);
    });

    // Monatslabel
    const label = document.createElement("span");
    label.className = "chart-label";
    if (mk === curMonth) label.classList.add("current");
    label.textContent = MONTHS_SHORT[s.m];

    col.append(total, bar, label);
    el.chart.appendChild(col);
  });
}

function renderAll() {
  renderCalendar();
  renderSummary();
  renderChart();
}

/* ---------- Bottom Sheet (Tag) ---------- */

function openSheet(key) {
  el.sheetDate.textContent = formatDateDE(key, true);
  renderChips(key);
  showSheet(el.sheet, el.backdrop);
}

function renderChips(key) {
  // Einheiten normalisieren, damit String- und Objekt-Form gleich behandelt werden
  const entries = (state.data[key] || []).map(normalizeEntry);
  const selected = new Set(entries.map((e) => e.t));

  el.chipGrid.textContent = "";
  TYPES.forEach((t) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.style.setProperty("--chip-color", t.color);
    if (selected.has(t.id)) chip.classList.add("selected");

    const check = document.createElement("span");
    check.className = "check";
    const mark = document.createElement("span");
    mark.className = "mark";
    mark.textContent = "✓";
    check.appendChild(mark);

    const label = document.createElement("span");
    label.textContent = t.label;

    chip.append(check, label);
    // Sofort speichern -> 2 Taps reichen: Tag antippen, Typ antippen
    chip.addEventListener("click", () => toggleType(key, t.id));
    el.chipGrid.appendChild(chip);
  });

  renderDetails(key, entries, selected);
}

/**
 * Detail-Textfeld für jede ausgewählte Einheit.
 * Speichert bei jeder Eingabe sofort (kein Extra-Button nötig).
 */
function renderDetails(key, entries, selected) {
  el.detailArea.textContent = "";
  if (!selected.size) return;

  TYPES.forEach((t) => {
    if (!selected.has(t.id)) return;
    const entry = entries.find((e) => e.t === t.id);

    const item = document.createElement("div");
    item.className = "detail-item";

    const head = document.createElement("div");
    head.className = "detail-label";
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = t.color;
    const name = document.createElement("span");
    name.textContent = t.label;
    head.append(swatch, name);

    const ta = document.createElement("textarea");
    ta.className = "detail-input";
    ta.placeholder = "Details (optional) …";
    ta.maxLength = MAX_NOTE_LEN;
    ta.rows = 2;
    ta.value = entry ? entry.n : "";
    ta.setAttribute("aria-label", "Details zu " + t.label);
    // Jede Änderung sofort persistieren, damit ein Typ-Wechsel nichts verliert
    ta.addEventListener("input", () => saveNote(key, t.id, ta.value));

    item.append(head, ta);
    el.detailArea.appendChild(item);
  });
}

/** Typ an/aus und sofort persistieren + Ansicht auffrischen. */
function toggleType(key, id) {
  const entries = (state.data[key] || []).map(normalizeEntry);
  const idx = entries.findIndex((e) => e.t === id);
  if (idx === -1) entries.push({ t: id, n: "" });
  else entries.splice(idx, 1);

  applyEntries(key, entries);
  if (saveData(state.data)) renderChips(key);
  renderAll();
}

/** Detail-Text einer Einheit speichern (ohne Neu-Rendern der Eingabe). */
function saveNote(key, id, text) {
  const entries = (state.data[key] || []).map(normalizeEntry);
  const entry = entries.find((e) => e.t === id);
  if (!entry) return;
  entry.n = String(text).slice(0, MAX_NOTE_LEN);
  applyEntries(key, entries);
  saveData(state.data);
}

/** Einheiten in den Zustand schreiben (leere Tage entfernen). */
function applyEntries(key, entries) {
  const packed = packEntries(entries.filter((e) => e.t));
  if (packed.length) state.data[key] = packed;
  else delete state.data[key];
}

/* ---------- Sheets öffnen/schließen ---------- */

function showSheet(sheet, backdrop) {
  sheet.hidden = false;
  backdrop.hidden = false;
  // Nächstes Frame: Übergang auslösen (von translateY(100%) zu 0)
  requestAnimationFrame(() => requestAnimationFrame(() => {
    sheet.classList.add("open");
    backdrop.classList.add("visible");
  }));
}

function hideSheet(sheet, backdrop) {
  sheet.classList.remove("open");
  backdrop.classList.remove("visible");
  const onEnd = () => {
    sheet.hidden = true;
    backdrop.hidden = true;
    sheet.removeEventListener("transitionend", onEnd);
  };
  sheet.addEventListener("transitionend", onEnd);
  // Fallback, falls kein transitionend feuert (z. B. reduced motion)
  setTimeout(() => { if (!sheet.classList.contains("open")) onEnd(); }, 400);
}

/* ---------- Wischgesten ---------- */

/* Monat wechseln: horizontales Wischen über die Kalenderkarte */
function setupCalendarSwipe() {
  let startX = 0, startY = 0, tracking = false;
  el.calendarCard.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    tracking = true;
  }, { passive: true });
  el.calendarCard.addEventListener("touchend", (e) => {
    if (!tracking) return;
    tracking = false;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      changeMonth(dx < 0 ? 1 : -1);
    }
  }, { passive: true });
}

/* Bottom Sheet per Wischen nach unten schließen – nur im Griffbereich
   (Griff + Kopf), damit Textfelder normal scrollen/fokussieren können. */
function setupSheetDrag(dragZone, sheet, backdrop, onClose) {
  let startY = 0, dy = 0, dragging = false;
  dragZone.addEventListener("touchstart", (e) => {
    startY = e.touches[0].clientY;
    dy = 0;
    dragging = true;
    sheet.style.transition = "none";
  }, { passive: true });
  dragZone.addEventListener("touchmove", (e) => {
    if (!dragging) return;
    dy = e.touches[0].clientY - startY;
    if (dy > 0) sheet.style.transform = "translateY(" + dy + "px)";
  }, { passive: true });
  dragZone.addEventListener("touchend", () => {
    if (!dragging) return;
    dragging = false;
    sheet.style.transition = "";
    sheet.style.transform = "";
    if (dy > 110) onClose();
  }, { passive: true });
}

/* ---------- Einstellungen / Backup ---------- */

function refreshDataInfo() {
  const days = Object.keys(state.data).length;
  el.dataInfo.textContent = days === 1
    ? "Es ist 1 Trainingstag gespeichert (lokal auf diesem Gerät)."
    : "Es sind " + days + " Trainingstage gespeichert (lokal auf diesem Gerät).";
}

function openSettings() {
  refreshDataInfo();
  el.importConfirm.hidden = true;
  showSheet(el.settingsSheet, el.settingsBackdrop);
}

/** JSON-Backup herunterladen. */
function exportData() {
  const today = new Date();
  const name = "trainingstagebuch-backup-" + dateKey(today.getFullYear(), today.getMonth(), today.getDate()) + ".json";
  try {
    const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Backup wird heruntergeladen");
  } catch (e) {
    showToast("Export fehlgeschlagen");
  }
}

/**
 * Import-Datei prüfen und Bestätigung anzeigen.
 * Erst nach "Überschreiben" werden die Daten ersetzt.
 */
function prepareImport(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onerror = () => showToast("Datei konnte nicht gelesen werden");
  reader.onload = () => {
    try {
      const imported = sanitizeData(JSON.parse(String(reader.result)));
      const days = Object.keys(imported).length;
      if (days === 0) {
        showToast("Keine gültigen Trainingsdaten in der Datei");
        return;
      }
      const current = Object.keys(state.data).length;
      el.importInfo.textContent =
        "Backup enthält " + days + (days === 1 ? " Trainingstag." : " Trainingstage.") +
        " Vorhandene Daten (" + current + (current === 1 ? " Tag" : " Tage") + ") werden überschrieben.";
      el.importConfirm.hidden = false;
      // Bestätigter Import als Funktion merken
      el.btnImportConfirm.onclick = () => {
        state.data = imported;
        if (saveData(state.data)) {
          renderAll();
          refreshDataInfo();
          showToast("Import erfolgreich: " + days + (days === 1 ? " Tag" : " Tage") + " übernommen");
        }
        el.importConfirm.hidden = true;
      };
    } catch (e) {
      showToast("Ungültige Datei: kein gültiges JSON");
    }
  };
  reader.readAsText(file);
}

/* ---------- Toast ---------- */

let toastTimer = null;
function showToast(msg) {
  el.toast.textContent = msg;
  el.toast.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => el.toast.classList.add("visible")));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.toast.classList.remove("visible");
    setTimeout(() => { el.toast.hidden = true; }, 300);
  }, 2600);
}

/* ---------- Navigation ---------- */

function changeMonth(delta) {
  let m = state.month + delta;
  let y = state.year;
  if (m < 0) { m = 11; y -= 1; }
  if (m > 11) { m = 0; y += 1; }
  state.month = m;
  state.year = y;
  renderAll();
}

function goToday() {
  const now = new Date();
  state.year = now.getFullYear();
  state.month = now.getMonth();
  renderAll();
}

/* ---------- Initialisierung ---------- */

function init() {
  document.getElementById("btnPrev").addEventListener("click", () => changeMonth(-1));
  document.getElementById("btnNext").addEventListener("click", () => changeMonth(1));
  document.getElementById("btnToday").addEventListener("click", goToday);

  document.getElementById("btnSettings").addEventListener("click", openSettings);
  el.btnCloseSettings.addEventListener("click", () => hideSheet(el.settingsSheet, el.settingsBackdrop));
  el.settingsBackdrop.addEventListener("click", () => hideSheet(el.settingsSheet, el.settingsBackdrop));

  el.btnCloseSheet.addEventListener("click", () => hideSheet(el.sheet, el.backdrop));
  el.backdrop.addEventListener("click", () => hideSheet(el.sheet, el.backdrop));

  document.getElementById("btnExport").addEventListener("click", exportData);
  document.getElementById("btnImport").addEventListener("click", () => document.getElementById("fileImport").click());
  document.getElementById("fileImport").addEventListener("change", (e) => {
    prepareImport(e.target.files[0]);
    e.target.value = ""; // gleiche Datei erneut wählbar
  });
  document.getElementById("btnImportCancel").addEventListener("click", () => { el.importConfirm.hidden = true; });

  setupCalendarSwipe();
  setupSheetDrag(document.getElementById("sheetDrag"), el.sheet, el.backdrop,
    () => hideSheet(el.sheet, el.backdrop));
  setupSheetDrag(document.getElementById("settingsSheetDrag"), el.settingsSheet, el.settingsBackdrop,
    () => hideSheet(el.settingsSheet, el.settingsBackdrop));

  renderLegend();
  renderAll();

  // Service Worker nur über HTTPS/localhost registrieren (nicht z. B. via file://)
  if ("serviceWorker" in navigator &&
      (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {
      /* Offline-Cache dann eben nicht – die App funktioniert trotzdem */
    });
  }
}

/* Reine Funktionen für Tests nach außen geben (test.html) */
window.TT = {
  TYPES, MONTHS, MONTHS_SHORT, WEEKDAYS_FULL,
  pad2, dateKey, parseKey, daysInMonth, buildMonthGrid,
  formatDateDE, monthSummary, monthUnitCounts, lastNMonths,
  entryType, entryNote, normalizeEntry, packEntries, sanitizeData,
};

document.addEventListener("DOMContentLoaded", init);
