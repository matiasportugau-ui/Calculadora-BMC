/**
 * FSM de batch de reparto / coordinación.
 * Separado de stopStatusFsm (carga física) y de chips Ventas.
 */
import { withStopUuids } from "./stopUuid.js";

/** @typedef {'draft'|'en_coordinacion'|'coordinado'|'en_curso'|'cerrado'|'cancelado'} RepartoStatus */

export const REPARTO_STATUS = Object.freeze([
  "draft",
  "en_coordinacion",
  "coordinado",
  "en_curso",
  "cerrado",
  "cancelado",
]);

export const REPARTO_STATUS_LABEL = Object.freeze({
  draft: "Borrador",
  en_coordinacion: "En Coordinación",
  coordinado: "Coordinado",
  en_curso: "En curso",
  cerrado: "Cerrado",
  cancelado: "Cancelado",
});

/** Allowed transitions */
const TRANSITIONS = Object.freeze({
  draft: ["en_coordinacion", "cancelado"],
  en_coordinacion: ["coordinado", "cancelado", "draft"],
  coordinado: ["en_curso", "cerrado", "cancelado"],
  en_curso: ["cerrado", "cancelado"],
  cerrado: [],
  cancelado: [],
});

/**
 * @param {string} status
 * @returns {RepartoStatus}
 */
export function normalizeRepartoStatus(status) {
  const s = String(status || "").trim().toLowerCase().replace(/\s+/g, "_");
  if (s === "en_coordinacion" || s === "encoordinacion") return "en_coordinacion";
  if (REPARTO_STATUS.includes(s)) return /** @type {RepartoStatus} */ (s);
  return "draft";
}

/**
 * @param {string} from
 * @param {string} to
 */
export function canTransitionReparto(from, to) {
  const a = normalizeRepartoStatus(from);
  const b = normalizeRepartoStatus(to);
  if (a === b) return true;
  return (TRANSITIONS[a] || []).includes(b);
}

/**
 * @param {string} from
 * @param {string} to
 * @returns {{ ok: boolean, from: string, to: string, error?: string }}
 */
export function applyRepartoTransition(from, to) {
  const a = normalizeRepartoStatus(from);
  const b = normalizeRepartoStatus(to);
  if (a === b) return { ok: true, from: a, to: b };
  if (!canTransitionReparto(a, b)) {
    return {
      ok: false,
      from: a,
      to: b,
      error: `Transición no permitida: ${REPARTO_STATUS_LABEL[a]} → ${REPARTO_STATUS_LABEL[b]}`,
    };
  }
  return { ok: true, from: a, to: b };
}

/**
 * When first stop is added to empty session → en_coordinacion
 */
export function statusOnFirstStop(currentStatus) {
  const s = normalizeRepartoStatus(currentStatus);
  if (s === "draft" || s === "en_coordinacion") return "en_coordinacion";
  return s;
}

/**
 * Confirm is only legal from En Coordinación.
 * Identity (coordinado→coordinado) is intentionally NOT allowed — confirmed
 * snapshots are immutable (applyRepartoTransition treats a===b as ok).
 * @param {string} status
 */
export function canConfirmReparto(status) {
  return normalizeRepartoStatus(status) === "en_coordinacion";
}

/**
 * Label for UI chips
 * @param {string} status
 */
export function repartoStatusLabel(status) {
  const s = normalizeRepartoStatus(status);
  return REPARTO_STATUS_LABEL[s] || s;
}

/**
 * Chip tone for UI
 * @param {string} status
 * @returns {'neutral'|'warning'|'info'|'success'|'danger'}
 */
export function repartoStatusTone(status) {
  const s = normalizeRepartoStatus(status);
  if (s === "en_coordinacion") return "warning";
  if (s === "coordinado") return "success";
  if (s === "en_curso") return "info";
  if (s === "cancelado") return "danger";
  return "neutral";
}

/**
 * Build a minimal reparto payload snapshot from logistics app state.
 * @param {object} state
 */
export function buildRepartoPayload(state = {}) {
  return {
    schema: "bmc-reparto-payload-v1",
    schemaVersion: 1,
    stops: withStopUuids(Array.isArray(state.stops) ? state.stops : []),
    truckL: state.truckL ?? null,
    distributionMode: state.distributionMode ?? "balanced",
    cargoLayoutMode: state.cargoLayoutMode ?? "auto",
    manualPkgOrderKeys: Array.isArray(state.manualPkgOrderKeys) ? state.manualPkgOrderKeys : [],
    rowOverrides: state.rowOverrides && typeof state.rowOverrides === "object" ? state.rowOverrides : {},
    freePositions: state.freePositions && typeof state.freePositions === "object" ? state.freePositions : {},
    loadWarnings: Array.isArray(state.loadWarnings) ? state.loadWarnings : [],
    info: state.info && typeof state.info === "object" ? state.info : {},
    savedAt: new Date().toISOString(),
  };
}

/**
 * Client slugs for Drive / display from stops
 * @param {object[]} stops
 */
export function stopSummariesForReparto(stops = []) {
  return (Array.isArray(stops) ? stops : []).map((s, i) => ({
    stopId: s.id || `s${i}`,
    orden: s.orden ?? i + 1,
    cliente: String(s.cliente || "").trim(),
    orderId: String(s.orderId || s.cotizacionId || "").trim(),
    ventasSheetRow1Based: s.ventasSheetRow1Based ?? null,
  }));
}
