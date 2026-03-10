// ═══════════════════════════════════════════════════════════════════════════
// src/utils/budgetLog.js — Budget auto-save, coding & log persistence
// BMC Uruguay · Presupuestos con código auto-generado
// ═══════════════════════════════════════════════════════════════════════════

const STORAGE_KEY = "bmc_budget_logs";
const COUNTER_KEY = "bmc_budget_counter";
const PREFIX = "BMC";

// ── Counter management ───────────────────────────────────────────────────

function getNextSequence() {
  const currentYear = new Date().getFullYear();
  const raw = localStorage.getItem(COUNTER_KEY);
  let counter = raw ? JSON.parse(raw) : { year: currentYear, seq: 0 };
  if (counter.year !== currentYear) {
    counter = { year: currentYear, seq: 0 };
  }
  counter.seq += 1;
  localStorage.setItem(COUNTER_KEY, JSON.stringify(counter));
  return { year: counter.year, seq: counter.seq };
}

function peekNextSequence() {
  const currentYear = new Date().getFullYear();
  const raw = localStorage.getItem(COUNTER_KEY);
  const counter = raw ? JSON.parse(raw) : { year: currentYear, seq: 0 };
  if (counter.year !== currentYear) return { year: currentYear, seq: 1 };
  return { year: counter.year, seq: counter.seq + 1 };
}

// ── Code generation ──────────────────────────────────────────────────────
// Format: BMC-2026-0042

function buildCode(year, seq) {
  return `${PREFIX}-${year}-${String(seq).padStart(4, "0")}`;
}

export function generateBudgetCode() {
  const { year, seq } = getNextSequence();
  return buildCode(year, seq);
}

export function peekNextCode() {
  const { year, seq } = peekNextSequence();
  return buildCode(year, seq);
}

// ── Slug builder (AI-readable name) ──────────────────────────────────────
// Produces: "BMC-2026-0042_ISODEC-EPS-100mm_ClienteNombre_Techo"

function sanitize(str) {
  return String(str || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 40);
}

export function buildLogName(code, { producto, cliente, escenario }) {
  const parts = [code];
  if (producto) parts.push(sanitize(producto));
  if (cliente) parts.push(sanitize(cliente));
  if (escenario) parts.push(sanitize(escenario));
  return parts.join("_");
}

// ── Log entry structure ──────────────────────────────────────────────────

function createEntry({ code, cliente, producto, escenario, listaPrecios, total, groups, snapshot }) {
  const now = new Date();
  return {
    id: code,
    nombre: buildLogName(code, { producto, cliente, escenario }),
    timestamp: now.toISOString(),
    fecha: now.toLocaleDateString("es-UY", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }),
    cliente: cliente || "",
    producto: producto || "",
    escenario: escenario || "",
    listaPrecios: listaPrecios || "web",
    total: total || 0,
    groups,
    snapshot,
  };
}

// ── CRUD operations ──────────────────────────────────────────────────────

export function getAllLogs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveBudget({ cliente, producto, escenario, listaPrecios, total, groups, snapshot }) {
  const code = generateBudgetCode();
  const entry = createEntry({ code, cliente, producto, escenario, listaPrecios, total, groups, snapshot });
  const logs = getAllLogs();
  logs.unshift(entry);

  // Keep max 500 entries to avoid localStorage bloat
  if (logs.length > 500) logs.length = 500;

  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  return entry;
}

export function updateBudget(id, updates) {
  const logs = getAllLogs();
  const idx = logs.findIndex(l => l.id === id);
  if (idx === -1) return null;
  logs[idx] = { ...logs[idx], ...updates, id };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  return logs[idx];
}

export function deleteBudget(id) {
  const logs = getAllLogs().filter(l => l.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
}

export function clearAllLogs() {
  localStorage.removeItem(STORAGE_KEY);
}

export function getBudgetById(id) {
  return getAllLogs().find(l => l.id === id) || null;
}

// ── Export utilities ─────────────────────────────────────────────────────

export function exportLogsAsJSON() {
  const logs = getAllLogs();
  const blob = new Blob([JSON.stringify(logs, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `BMC_presupuestos_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportSingleBudget(entry) {
  const blob = new Blob([JSON.stringify(entry, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${entry.nombre || entry.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Statistics ───────────────────────────────────────────────────────────

export function getLogStats() {
  const logs = getAllLogs();
  if (logs.length === 0) return { total: 0, totalUSD: 0, lastDate: null };
  const totalUSD = logs.reduce((sum, l) => sum + (l.total || 0), 0);
  return {
    total: logs.length,
    totalUSD,
    lastDate: logs[0]?.fecha || null,
    lastCode: logs[0]?.id || null,
  };
}
