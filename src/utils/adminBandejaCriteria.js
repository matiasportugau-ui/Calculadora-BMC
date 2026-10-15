/**
 * Twin of Admin cotizaciones: Antigüedad, Alerta, Prioridad, canal WA.
 * Pure helpers — no React.
 */

/**
 * Parse Admin fecha. The live sheet uses `DD-MM` (year implied).
 * Also accepts `DD/MM`, `DD-MM-YY` and `DD/MM/YYYY`.
 * A day-month with no year that would fall in the future is last year.
 */
export function parseAdminFecha(s, now = new Date()) {
  const m = String(s || "").trim().match(/^(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?$/);
  if (!m) return null;
  const day = Number(m[1]);
  const mon = Number(m[2]) - 1;
  if (mon < 0 || mon > 11 || day < 1 || day > 31) return null;
  let yr;
  if (m[3] == null || m[3] === "") {
    yr = now.getFullYear();
    const candidate = new Date(yr, mon, day);
    if (candidate.getDate() !== day || candidate.getMonth() !== mon) return null;
    const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    if (candidate >= startOfTomorrow) yr -= 1;
  } else {
    yr = Number(m[3]);
    if (yr < 100) yr += 2000;
  }
  const d = new Date(yr, mon, day);
  if (!Number.isFinite(d.getTime()) || d.getDate() !== day || d.getMonth() !== mon) return null;
  return d;
}

/** Days since fecha; null if unparseable. */
export function ageDays(fechaStr, now = new Date()) {
  const d = parseAdminFecha(fechaStr, now);
  if (!d) return null;
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export function antiguedadDays(fechaStr, now = new Date()) {
  return ageDays(fechaStr, now);
}

export function antiguedadLabel(fechaStr, now = new Date()) {
  const d = ageDays(fechaStr, now);
  if (d == null) return "—";
  if (d === 0) return "hoy";
  if (d === 1) return "1d";
  return `${d}d`;
}

/**
 * Alerta (not "salud"): abandonment clock.
 * Enviado → en plazo. 7d+ warn, 14d+ late.
 */
export function healthLevel(fechaStr, estado, now = new Date()) {
  if (String(estado || "").toLowerCase() === "enviado") return "ok";
  const age = ageDays(fechaStr, now);
  if (age == null) return "none";
  if (age >= 14) return "late";
  if (age >= 7) return "warn";
  return "ok";
}

export function alertaLevel(fechaStr, estado, now = new Date()) {
  return healthLevel(fechaStr, estado, now);
}

export function alertaLabel(level) {
  switch (level) {
    case "late": return "14+ días";
    case "warn": return "7+ días";
    case "ok": return "En plazo";
    default: return "—";
  }
}

/**
 * Prioridad: sheet Urgencia (S) when present; else from alerta.
 */
export function prioridadFromRow(row, now = new Date()) {
  const raw = String(row?.urgencia || "").trim();
  if (raw) return raw;
  const lvl = alertaLevel(row?.fecha, row?.estado, now);
  if (lvl === "late") return "Alta";
  if (lvl === "warn") return "Media";
  return "Normal";
}

export function isWaCanal(origen) {
  const o = String(origen || "").trim().toUpperCase();
  if (!o) return false;
  return o === "WA" || o === "WA-AUTO" || o.startsWith("WA-") || o.includes("WHATSAPP");
}
