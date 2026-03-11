// ═══════════════════════════════════════════════════════════════════════════
// src/utils/budgetLog.js — Local budget log (localStorage-backed)
// ═══════════════════════════════════════════════════════════════════════════

const STORAGE_KEY = "bmc_budget_logs";
const COUNTER_KEY = "bmc_budget_counter";

function nextCode() {
  const year = new Date().getFullYear();
  const raw = localStorage.getItem(COUNTER_KEY);
  let seq = 1;
  if (raw) {
    try {
      const prev = JSON.parse(raw);
      if (prev.year === year) seq = (prev.seq || 0) + 1;
    } catch { /* reset */ }
  }
  localStorage.setItem(COUNTER_KEY, JSON.stringify({ year, seq }));
  return `BMC-${year}-${String(seq).padStart(4, "0")}`;
}

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch { return []; }
}

function writeAll(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function saveBudget({ cliente, producto, escenario, total, listaPrecios, snapshot }) {
  const entries = readAll();
  const id = nextCode();
  const entry = {
    id,
    nombre: `${id} — ${cliente || "Sin nombre"}`,
    cliente: cliente || "",
    producto: producto || "",
    escenario: escenario || "",
    total: total ?? 0,
    listaPrecios: listaPrecios || "web",
    fecha: new Date().toISOString(),
    snapshot: snapshot || null,
  };
  entries.unshift(entry);
  if (entries.length > 100) entries.length = 100;
  writeAll(entries);
  return entry;
}

export function getAllLogs() {
  return readAll();
}

export function deleteBudget(id) {
  writeAll(readAll().filter(e => e.id !== id));
}

export function clearAllLogs() {
  localStorage.removeItem(STORAGE_KEY);
}

export function exportLogsAsJSON() {
  const data = readAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `panelin-bmc-logs-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportSingleBudget(entry) {
  const blob = new Blob([JSON.stringify(entry, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${entry.id || "budget"}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
