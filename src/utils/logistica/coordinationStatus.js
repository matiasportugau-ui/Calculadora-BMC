/**
 * Ventas → coordination lifecycle chips for /logistica search results (Ops UX F2).
 * Pure functions — column F = estado text; fecha entrega / G = coordinación.
 * Fechas planilla (dd/mm, dd/mm/yy) se normalizan vía parsePlanillaFechaToIso.
 */

import { parsePlanillaFechaToIso } from "./ventasSheetMap.js";

/** @typedef {'enviado'|'coordinado'|'por_coordinar'} CoordinationStatus */

/**
 * @param {string} s
 * @returns {string}
 */
export function normalizeSearchText(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * True when "enviado" appears only under negation (NO ENVIADO, sin enviar, etc.).
 * "NO ENVIADO" / "sin enviar" still contain the substring "enviad*".
 * @param {string} n already normalizeSearchText'd
 * @returns {boolean}
 */
export function hasNegatedEnviado(n) {
  const s = String(n || "");
  if (!s) return false;
  return (
    /\bno\s+enviad/.test(s) ||
    /\bsin\s+enviad/.test(s) ||
    /\bno\s+se\s+envi/.test(s) ||
    /\bpendiente\s+de\s+envi/.test(s) ||
    /\baun\s+no\s+envi/.test(s) ||
    /\baún\s+no\s+envi/.test(s)
  );
}

/**
 * Classify a mapped Ventas row for operator chips.
 * @param {{
 *   estadoText?: string,
 *   fechaEntrega?: string,
 *   pickupId?: string,
 *   rawSheetText?: string,
 * }} row
 * @returns {{
 *   status: CoordinationStatus,
 *   coordDateIso: string|null,
 *   batchKey: string|null,
 *   label: string,
 * }}
 */
export function classifyVentasCoordination(row = {}) {
  const estado = String(row.estadoText || "");
  const raw = String(row.rawSheetText || "");
  const blob = `${estado}\n${raw}`;
  const n = normalizeSearchText(blob);

  // Negation first: "NO ENVIADO" matches \benviado\b otherwise.
  if (
    !hasNegatedEnviado(n) &&
    (/\benviado\b|\benviada\b|\benviados\b/.test(n) || /\benviad/.test(n))
  ) {
    return {
      status: "enviado",
      coordDateIso: null,
      batchKey: null,
      label: "Enviado",
    };
  }

  // Prefer already-normalized ISO; also accept raw planilla forms (07/08, 22/05/2026).
  const rawFecha = String(row.fechaEntrega || "").trim();
  const coordDateIso =
    (/^\d{4}-\d{2}-\d{2}$/.test(rawFecha) ? rawFecha : "") || parsePlanillaFechaToIso(rawFecha) || null;
  if (coordDateIso) {
    return {
      status: "coordinado",
      coordDateIso,
      batchKey: coordDateIso,
      label: "Coordinado",
    };
  }

  return {
    status: "por_coordinar",
    coordDateIso: null,
    batchKey: null,
    label: "Por coordinar",
  };
}

/**
 * Stable pastel color from batch key (same coordination date → same color).
 * @param {string|null|undefined} batchKey
 * @returns {string} css color
 */
export function batchColorFromKey(batchKey) {
  if (!batchKey) return "#94a3b8";
  let h = 0;
  const s = String(batchKey);
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  const hue = h % 360;
  return `hsl(${hue} 62% 42%)`;
}

/**
 * Format chip secondary text (date dd/mm for Coordinado).
 * @param {{ status: CoordinationStatus, coordDateIso: string|null, label: string }} c
 * @returns {string}
 */
export function coordinationChipCaption(c) {
  if (!c) return "";
  if (c.status === "coordinado" && c.coordDateIso) {
    const parts = c.coordDateIso.split("-");
    const m = parts[1];
    const d = parts[2];
    return `${c.label} · ${d}/${m}`;
  }
  return c.label;
}
