/**
 * BMC Envíos P5 — durable draft payload (pure).
 * localStorage remains offline cache; server stores the same JSON shape.
 */

export const DRAFT_SCHEMA_VERSION = 1;
export const DRAFT_SCHEMA = "bmc-envios-draft-v1";

/**
 * Sanitize ENV number / free text into a stable draft id.
 * @param {string} [envNo]
 * @returns {string}
 */
export function draftIdFromEnvNo(envNo) {
  const raw = String(envNo || "").trim().toUpperCase();
  if (!raw) return "";
  const cleaned = raw
    .replace(/[^A-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned.slice(0, 80);
}

/**
 * Build server-ready draft document from app state.
 * @param {object} state
 * @param {object} [state.info]
 * @param {Array} [state.stops]
 * @param {number} [state.truckL]
 * @param {string} [state.view]
 * @param {string} [state.distributionMode]
 * @param {object} [state.accProfiles]
 * @param {string} [state.cargoLayoutMode]
 * @param {string[]} [state.manualPkgOrderKeys]
 * @param {object} [state.rowOverrides]
 * @param {Array} [state.transportistas]
 * @param {Array} [state.camionesCat]
 * @param {Array} [state.priceHistory]
 * @param {Array} [state.tripCostLog]
 * @param {{ collapsedStopIds?: string[] }} [state.ui]
 * @param {{ now?: () => string }} [opts]
 */
export function buildEnviosDraft(state, opts = {}) {
  const now = opts.now || (() => new Date().toISOString());
  const info = state?.info && typeof state.info === "object" ? state.info : {};
  const envNo = String(info.numero || "").trim();
  const id = draftIdFromEnvNo(envNo);
  if (!id) {
    return { ok: false, error: "missing_env_no" };
  }
  const payload = {
    schema: DRAFT_SCHEMA,
    schemaVersion: DRAFT_SCHEMA_VERSION,
    savedAt: now(),
    info: { ...info, numero: envNo },
    stops: Array.isArray(state.stops) ? state.stops : [],
    truckL: state.truckL ?? null,
    view: state.view ?? "form",
    distributionMode: state.distributionMode ?? "balanced",
    accProfiles: state.accProfiles && typeof state.accProfiles === "object" ? state.accProfiles : {},
    cargoLayoutMode: state.cargoLayoutMode === "manual" ? "manual" : "auto",
    manualPkgOrderKeys: Array.isArray(state.manualPkgOrderKeys) ? state.manualPkgOrderKeys : [],
    rowOverrides: state.rowOverrides && typeof state.rowOverrides === "object" ? state.rowOverrides : {},
    freeDragEnabled: state.freeDragEnabled === true,
    freePositions:
      state.freePositions && typeof state.freePositions === "object" ? state.freePositions : {},
    loadWarnings: Array.isArray(state.loadWarnings) ? state.loadWarnings : [],
    transportistas: Array.isArray(state.transportistas) ? state.transportistas : [],
    camionesCat: Array.isArray(state.camionesCat) ? state.camionesCat : [],
    priceHistory: Array.isArray(state.priceHistory) ? state.priceHistory : [],
    tripCostLog: Array.isArray(state.tripCostLog) ? state.tripCostLog : [],
    ui: {
      collapsedStopIds: Array.isArray(state.ui?.collapsedStopIds) ? state.ui.collapsedStopIds : [],
    },
  };
  return {
    ok: true,
    id,
    envNo,
    payload,
    stopCount: payload.stops.length,
  };
}

/**
 * Validate / normalize a payload from server or localStorage.
 * @param {unknown} raw
 * @returns {{ ok: true, payload: object } | { ok: false, error: string }}
 */
export function parseEnviosDraftPayload(raw) {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "invalid_payload" };
  }
  const p = raw;
  if (p.schema && p.schema !== DRAFT_SCHEMA) {
    // accept legacy localStorage blobs without schema
    if (!Array.isArray(p.stops) && !p.info) {
      return { ok: false, error: "unknown_schema" };
    }
  }
  if (p.info && typeof p.info !== "object") {
    return { ok: false, error: "invalid_info" };
  }
  if (p.stops != null && !Array.isArray(p.stops)) {
    return { ok: false, error: "invalid_stops" };
  }
  return {
    ok: true,
    payload: {
      schema: DRAFT_SCHEMA,
      schemaVersion: DRAFT_SCHEMA_VERSION,
      savedAt: p.savedAt || null,
      info: p.info && typeof p.info === "object" ? p.info : {},
      stops: Array.isArray(p.stops) ? p.stops : [],
      truckL: p.truckL ?? null,
      view: p.view ?? "form",
      distributionMode: p.distributionMode ?? "balanced",
      accProfiles: p.accProfiles && typeof p.accProfiles === "object" ? p.accProfiles : {},
      cargoLayoutMode: p.cargoLayoutMode === "manual" ? "manual" : "auto",
      manualPkgOrderKeys: Array.isArray(p.manualPkgOrderKeys) ? p.manualPkgOrderKeys : [],
      rowOverrides: p.rowOverrides && typeof p.rowOverrides === "object" ? p.rowOverrides : {},
      freeDragEnabled: p.freeDragEnabled === true,
      freePositions: p.freePositions && typeof p.freePositions === "object" ? p.freePositions : {},
      loadWarnings: Array.isArray(p.loadWarnings) ? p.loadWarnings : [],
      transportistas: Array.isArray(p.transportistas) ? p.transportistas : [],
      camionesCat: Array.isArray(p.camionesCat) ? p.camionesCat : [],
      priceHistory: Array.isArray(p.priceHistory) ? p.priceHistory : [],
      tripCostLog: Array.isArray(p.tripCostLog) ? p.tripCostLog : [],
      ui: {
        collapsedStopIds: Array.isArray(p.ui?.collapsedStopIds) ? p.ui.collapsedStopIds : [],
      },
    },
  };
}

/**
 * Decide whether cloud draft should replace local (simple LWW by savedAt).
 * @param {string|null|undefined} localSavedAt ISO
 * @param {string|null|undefined} cloudSavedAt ISO
 * @returns {"cloud"|"local"|"equal"|"unknown"}
 */
export function preferDraftSource(localSavedAt, cloudSavedAt) {
  const l = Date.parse(localSavedAt || "");
  const c = Date.parse(cloudSavedAt || "");
  if (!Number.isFinite(l) && !Number.isFinite(c)) return "unknown";
  if (!Number.isFinite(l)) return "cloud";
  if (!Number.isFinite(c)) return "local";
  if (c > l) return "cloud";
  if (l > c) return "local";
  return "equal";
}
