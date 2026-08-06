/**
 * Ventas → coordination lifecycle chips for /logistica search results (Ops UX F2).
 * Phase B+: delegates to saleState (full lifecycle + camión).
 */

import {
  normalizeSaleText,
  classifySaleStatus,
  saleStatusChipCaption,
  batchColorFromKey as saleBatchColor,
} from "./saleState.js";

/** @typedef {'enviado'|'coordinado'|'por_coordinar'} CoordinationStatus */

/**
 * @param {string} s
 * @returns {string}
 */
export function normalizeSearchText(s) {
  return normalizeSaleText(s);
}

/**
 * True when "enviado" appears only under negation (NO ENVIADO, sin enviar, etc.).
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
 * Classify a mapped Ventas row for operator chips (legacy 3-state + label from saleState).
 * @param {object} row
 * @returns {{
 *   status: CoordinationStatus,
 *   coordDateIso: string|null,
 *   batchKey: string|null,
 *   label: string,
 *   saleStatus?: string,
 *   camion?: number|null,
 * }}
 */
export function classifyVentasCoordination(row = {}) {
  const sale = classifySaleStatus(row);
  /** @type {CoordinationStatus} */
  let status = "por_coordinar";
  if (sale.status === "enviado" || sale.status === "entregado") status = "enviado";
  else if (sale.status === "coordinado" || sale.status === "con_pendientes") status = "coordinado";
  return {
    status,
    coordDateIso: sale.coordDateIso,
    batchKey: sale.batchKey,
    label: sale.label,
    saleStatus: sale.status,
    camion: sale.camion,
  };
}

/**
 * Stable pastel color from batch key (same coordination date → same color).
 * @param {string|null|undefined} batchKey
 * @returns {string} css color
 */
export function batchColorFromKey(batchKey) {
  return saleBatchColor(batchKey);
}

/**
 * Format chip secondary text (date dd/mm for Coordinado + camión).
 * @param {object} c
 * @returns {string}
 */
export function coordinationChipCaption(c) {
  if (!c) return "";
  if (c.saleStatus || c.camion || c.coordDateIso) {
    return saleStatusChipCaption({
      status: c.saleStatus || c.status,
      coordDateIso: c.coordDateIso,
      camion: c.camion ?? null,
      label: c.label,
    });
  }
  if (c.status === "coordinado" && c.coordDateIso) {
    const parts = c.coordDateIso.split("-");
    const m = parts[1];
    const d = parts[2];
    return `${c.label} · ${d}/${m}`;
  }
  return c.label;
}
