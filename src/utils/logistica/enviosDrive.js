/**
 * Drive persistence for Logística coordinations (.bmc-envios.json).
 * Same Drive root pattern as calculator quotations — resumable from Calculadora.
 */

import { draftIdFromEnvNo, DRAFT_SCHEMA, DRAFT_SCHEMA_VERSION } from "./enviosDraft.js";

export const ENVIOS_DRIVE_FOLDER = "BMC Envíos Coordinaciones";
export const ENVIOS_DRIVE_EXT = ".bmc-envios.json";
export const ENVIOS_DRIVE_KIND = "bmc-envios";
/** sessionStorage handoff Calculadora → /logistica */
export const ENVIOS_DRIVE_RESUME_KEY = "bmc-envios-drive-resume-v1";

/**
 * @param {"saved"|"completed"|string} [status]
 * @returns {"saved"|"completed"}
 */
export function normalizeCoordinationStatus(status) {
  return status === "completed" ? "completed" : "saved";
}

/**
 * Filename for Drive: ENV-….bmc-envios.json
 * @param {string} envNo
 */
export function enviosDriveFileName(envNo) {
  const id = draftIdFromEnvNo(envNo) || "ENV-DRAFT";
  return `${id}${ENVIOS_DRIVE_EXT}`;
}

/**
 * Wrap draft payload for Drive with coordination metadata.
 * @param {object} draftPayload — from buildEnviosDraft().payload
 * @param {{ status?: string, repartoNo?: string|null, label?: string }} [meta]
 */
export function buildEnviosDriveDocument(draftPayload, meta = {}) {
  const status = normalizeCoordinationStatus(meta.status);
  const info = draftPayload?.info && typeof draftPayload.info === "object" ? draftPayload.info : {};
  const envNo = String(info.numero || "").trim();
  return {
    ...draftPayload,
    schema: DRAFT_SCHEMA,
    schemaVersion: DRAFT_SCHEMA_VERSION,
    coordination: {
      status,
      statusLabel: status === "completed" ? "Completada" : "Guardada",
      repartoNo: meta.repartoNo || null,
      label: meta.label || envNo || null,
      savedAt: new Date().toISOString(),
      resumableFrom: ["logistica", "calculadora"],
    },
  };
}

/**
 * Detect Drive / paste JSON that is an envíos coordination (not a quote .bmc.json).
 * @param {unknown} raw
 */
export function isEnviosDriveDocument(raw) {
  if (!raw || typeof raw !== "object") return false;
  const p = /** @type {Record<string, unknown>} */ (raw);
  if (p.schema === DRAFT_SCHEMA) return true;
  if (p.coordination && (Array.isArray(p.stops) || p.info)) return true;
  if (typeof p._meta === "object" && p._meta && /** @type {any} */ (p._meta).kind === ENVIOS_DRIVE_KIND) {
    return true;
  }
  return false;
}

/**
 * Stash payload so /logistica can resume after navigate from Calculadora.
 * @param {object} doc
 */
export function stashEnviosDriveResume(doc) {
  if (typeof sessionStorage === "undefined") return false;
  try {
    sessionStorage.setItem(
      ENVIOS_DRIVE_RESUME_KEY,
      JSON.stringify({ at: new Date().toISOString(), doc }),
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * @returns {{ doc: object } | null}
 */
export function takeEnviosDriveResume() {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(ENVIOS_DRIVE_RESUME_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(ENVIOS_DRIVE_RESUME_KEY);
    const parsed = JSON.parse(raw);
    if (parsed?.doc && typeof parsed.doc === "object") return { doc: parsed.doc };
    return null;
  } catch {
    try {
      sessionStorage.removeItem(ENVIOS_DRIVE_RESUME_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
}

/**
 * Session pointers after opening a coordination (Drive / cloud draft / reparto).
 *
 * Opening must not keep the previous activeReparto or cloudMeta unless the open
 * explicitly provides replacements — otherwise Confirm writes into the wrong
 * reparto, and a stale revision / null expectedRevision can clobber a newer
 * cloud draft on autosave.
 *
 * @param {{ reparto?: object|null, cloudMeta?: object|null }} [meta]
 * @returns {{ activeReparto: object|null, cloudMeta: object|null }}
 */
export function sessionPointersAfterCoordinationOpen(meta = {}) {
  return {
    activeReparto: meta.reparto != null ? meta.reparto : null,
    cloudMeta: meta.cloudMeta != null ? meta.cloudMeta : null,
  };
}

/**
 * Operator-facing save result: never claim "Drive + nube" unless both succeeded.
 *
 * @param {{
 *   envNo: string,
 *   status: "saved"|"completed"|string,
 *   stopCount: number,
 *   cloudOk: boolean,
 *   cloudError?: string|null,
 * }} opts
 */
export function formatCoordinationSaveMessage(opts) {
  const envNo = opts.envNo || "ENV";
  const statusLabel = opts.status === "completed" ? "Completada" : "Guardada";
  const stops = `${opts.stopCount ?? 0} parada(s)`;
  if (opts.cloudOk) {
    return `✓ Guardado ${envNo} · ${statusLabel} · Drive + nube · ${stops}`;
  }
  const cloudErr = opts.cloudError || "error";
  return `✓ Drive ${envNo} · ${statusLabel} · nube: ${cloudErr} · ${stops}`;
}
