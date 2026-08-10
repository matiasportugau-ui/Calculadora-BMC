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
 * Bug DG: after a cloud PUT attempt, decide whether Guardar/Confirmar may
 * overwrite Drive. A revision conflict means another client already won the
 * cloud draft — uploading our stale local stops would clobber their newer
 * `.bmc-envios.json` (filename upsert, no etag). Non-conflict cloud failures
 * still allow Drive as a backup.
 *
 * @param {{ ok?: boolean, conflict?: boolean } | null | undefined} cloudResult
 * @returns {boolean}
 */
export function shouldWriteDriveAfterCloudSave(cloudResult) {
  if (cloudResult && cloudResult.conflict) return false;
  return true;
}

/**
 * Operator message when Drive write is skipped due to cloud revision conflict.
 * @returns {string}
 */
export function formatCoordinationConflictDriveSkipMessage() {
  return "Nube: conflicto de revisión — no se escribió Drive (resolvé el conflicto primero).";
}
