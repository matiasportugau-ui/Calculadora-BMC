/**
 * bugCapture.js
 * Lightweight, always-on (prod-safe) ring buffer for user bug reports.
 * Captures errors, high-signal events, and context to help the team reproduce/fix issues.
 *
 * Usage:
 *   import { addBugLog, captureBugContext } from "../utils/bugCapture.js";
 *   addBugLog("error", "quote batch failed", { row: 12, status: 503 });
 *   const ctx = captureBugContext({ extra: "wolfboard scope=consulta" });
 *
 * The modal / boundaries will call captureBugContext at report time.
 */

const MAX_LOGS = 80;
const logs = [];
let listenersInstalled = false;

function push(entry) {
  logs.push(entry);
  if (logs.length > MAX_LOGS) logs.shift();
}

function nowIso() {
  return new Date().toISOString();
}

function safeString(v) {
  try {
    if (v == null) return "";
    if (typeof v === "string") return v;
    if (v instanceof Error) return v.message || String(v);
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export function addBugLog(level, message, meta = {}) {
  const entry = {
    t: Date.now(),
    level: String(level || "info").toLowerCase(),
    message: safeString(message),
    ... (meta && typeof meta === "object" ? meta : {}),
  };
  push(entry);
  // Also mirror to console in dev for visibility (non-fatal)
  if (typeof import.meta !== "undefined" && import.meta.env?.DEV) {
    const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    try { fn("[bug]", entry.message, meta); } catch { /* ignore console noise */ }
  }
  return entry;
}

function installGlobalListeners() {
  if (listenersInstalled || typeof window === "undefined") return;
  listenersInstalled = true;

  window.addEventListener("error", (ev) => {
    addBugLog("error", ev?.message || "window error", {
      source: ev?.filename || "",
      line: ev?.lineno,
      col: ev?.colno,
      stack: safeString(ev?.error?.stack || ev?.error),
    });
  });

  window.addEventListener("unhandledrejection", (ev) => {
    const reason = ev?.reason;
    addBugLog("error", "unhandledrejection", {
      reason: safeString(reason),
      stack: reason && reason.stack ? safeString(reason.stack) : "",
    });
  });
}

// Install as soon as this module is imported (side-effect, safe).
installGlobalListeners();

/**
 * Capture a snapshot suitable for a bug report.
 * Call this at the moment the user clicks "enviar reporte".
 * @param {object} [extra] - caller-provided context (e.g. { module: "wolfboard", scope: "consulta", currentRow: 7 })
 */
export function captureBugContext(extra = {}) {
  const url = (typeof window !== "undefined" && window.location) ? window.location.href : "";
  const ua = (typeof navigator !== "undefined") ? navigator.userAgent : "";
  const vp = (typeof window !== "undefined") ? { w: window.innerWidth, h: window.innerHeight } : null;

  // Pull a recent slice (most recent last)
  const recentLogs = logs.slice(-40).map(e => ({ ...e })); // shallow copy

  const payload = {
    capturedAt: nowIso(),
    url,
    userAgent: ua,
    viewport: vp,
    logs: recentLogs,
    extra: extra && typeof extra === "object" ? { ...extra } : {},
  };

  return payload;
}

/** Convenience: push an error with stack (used by boundaries) */
export function addErrorToBugLog(err, info = {}) {
  const message = err?.message || String(err);
  const stack = err?.stack ? String(err.stack) : "";
  return addBugLog("error", message, {
    stack: stack.slice(0, 2000),
    ...info,
  });
}

/** For tests / reset (not used in prod UI) */
export function __resetBugLogsForTest() {
  logs.length = 0;
}

export const __getInternalLogsForTest = () => logs; // test helper only
