/**
 * BMC Envíos P5b — draft cloud sync helpers (pure).
 * Autosave gates, dirty fingerprint, revision conflict resolution.
 */

import { buildEnviosDraft, draftIdFromEnvNo } from "./enviosDraft.js";

export const AUTOSAVE_MIN_INTERVAL_MS = 2500;

/**
 * Stable fingerprint of draft content (ignores savedAt timestamps).
 * @param {object} state app state or draft payload shape
 * @returns {string}
 */
export function fingerprintDraft(state) {
  const built = state?.payload
    ? { ok: true, payload: state.payload }
    : buildEnviosDraft(state || {}, { now: () => "fp" });
  if (!built.ok) return "";
  const p = built.payload || state.payload || {};
  const core = {
    numero: p.info?.numero || "",
    fecha: p.info?.fecha || "",
    transportista: p.info?.transportista || "",
    patente: p.info?.patente || "",
    notas: p.info?.notas || "",
    truckL: p.truckL,
    distributionMode: p.distributionMode,
    cargoLayoutMode: p.cargoLayoutMode,
    manualPkgOrderKeys: p.manualPkgOrderKeys || [],
    rowOverrides: p.rowOverrides || {},
    stops: (p.stops || []).map((s) => ({
      id: s.id,
      orden: s.orden,
      cliente: s.cliente,
      telefono: s.telefono,
      direccion: s.direccion,
      orderId: s.orderId,
      cotizacionId: s.cotizacionId,
      estado: s.estado,
      paneles: s.paneles,
      accesorios: s.accesorios,
      geo: s.geo,
      mapLink: s.mapLink,
      pdfLink: s.pdfLink,
      checks: s.checks,
    })),
    ui: p.ui || {},
  };
  return stableStringify(core);
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

/**
 * @param {{
 *   hydrated?: boolean,
 *   envNo?: string,
 *   hasToken?: boolean,
 *   dirty?: boolean,
 *   cloudBusy?: boolean,
 *   hasConflict?: boolean,
 *   autosaveEnabled?: boolean,
 *   lastPushAt?: number|null,
 *   now?: number,
 *   minIntervalMs?: number,
 * }} opts
 */
export function shouldAutosave(opts = {}) {
  if (!opts.hydrated) return { ok: false, reason: "not_hydrated" };
  if (!opts.autosaveEnabled) return { ok: false, reason: "autosave_off" };
  if (!opts.hasToken) return { ok: false, reason: "no_token" };
  const id = draftIdFromEnvNo(opts.envNo);
  if (!id) return { ok: false, reason: "missing_env_no" };
  if (!opts.dirty) return { ok: false, reason: "clean" };
  if (opts.cloudBusy) return { ok: false, reason: "busy" };
  // Unresolved 409: never autosave — next PUT with advanced remote rev would
  // silently overwrite the other device and defeat the conflict UI.
  if (opts.hasConflict) return { ok: false, reason: "conflict" };
  const now = opts.now ?? Date.now();
  const last = opts.lastPushAt ?? 0;
  const min = opts.minIntervalMs ?? AUTOSAVE_MIN_INTERVAL_MS;
  if (last && now - last < min) return { ok: false, reason: "throttle", waitMs: min - (now - last) };
  return { ok: true, id };
}

/**
 * Optimistic concurrency resolution.
 * @param {{
 *   localRevision?: number|null,
 *   remoteRevision?: number|null,
 *   localSavedAt?: string|null,
 *   remoteSavedAt?: string|null,
 *   dirty?: boolean,
 * }} opts
 * @returns {{ action: 'push'|'pull'|'ask'|'noop', reason: string }}
 */
export function resolveConflict(opts = {}) {
  const lr = opts.localRevision == null ? null : Number(opts.localRevision);
  const rr = opts.remoteRevision == null ? null : Number(opts.remoteRevision);

  if (rr == null && lr == null) return { action: "push", reason: "no_revisions" };
  if (rr == null) return { action: "push", reason: "no_remote" };
  if (lr == null) {
    return opts.dirty
      ? { action: "ask", reason: "local_dirty_no_local_rev" }
      : { action: "pull", reason: "fresh_local" };
  }
  if (Number.isFinite(lr) && Number.isFinite(rr)) {
    if (rr > lr && opts.dirty) return { action: "ask", reason: "remote_ahead_local_dirty" };
    if (rr > lr && !opts.dirty) return { action: "pull", reason: "remote_ahead" };
    if (rr === lr && opts.dirty) return { action: "push", reason: "same_rev_dirty" };
    if (rr === lr && !opts.dirty) return { action: "noop", reason: "in_sync" };
    if (lr > rr) return { action: "push", reason: "local_rev_ahead" };
  }
  return { action: "ask", reason: "unknown" };
}

/**
 * Parse API error for conflict handling.
 * @param {number} status
 * @param {object} body
 */
export function parsePutDraftResponse(status, body) {
  if (status === 409 || body?.error === "revision_conflict") {
    return {
      ok: false,
      conflict: true,
      draft: body?.draft || null,
      error: "revision_conflict",
    };
  }
  if (status >= 200 && status < 300 && body?.ok !== false) {
    return { ok: true, conflict: false, draft: body?.draft || body, error: null };
  }
  return {
    ok: false,
    conflict: false,
    draft: null,
    error: body?.error || `http_${status}`,
  };
}
