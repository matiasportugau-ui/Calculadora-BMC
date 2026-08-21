/**
 * Per-ENV local archive so a worked ruta survives seed reloads and
 * the single current-slot overwrite (`bmc-logistica-online-v2`).
 */

import { draftIdFromEnvNo } from "./enviosDraft.js";

export const ARCHIVE_INDEX_KEY = "bmc-logistica-drafts-index-v1";
export const ARCHIVE_ITEM_PREFIX = "bmc-logistica-draft-v1:";
export const ARCHIVE_MAX = 40;

/**
 * @param {string} id
 */
export function archiveItemKey(id) {
  const clean = draftIdFromEnvNo(id);
  return clean ? `${ARCHIVE_ITEM_PREFIX}${clean}` : "";
}

/**
 * @param {object|null|undefined} payload
 */
export function routeLegCount(payload) {
  const legs = payload?.route?.orderedLegs;
  return Array.isArray(legs) ? legs.length : 0;
}

/**
 * @param {object|null|undefined} payload
 */
export function draftStopCount(payload) {
  return Array.isArray(payload?.stops) ? payload.stops.length : 0;
}

/**
 * Incoming seed/cloud must not wipe operator route work.
 * @param {object|null|undefined} current
 * @param {object|null|undefined} incoming
 * @returns {"keep"|"take"|"merge"}
 */
export function decideDraftLoad(current, incoming) {
  if (!incoming || typeof incoming !== "object") return "keep";
  if (!current || typeof current !== "object") return "take";
  const cLegs = routeLegCount(current);
  const iLegs = routeLegCount(incoming);
  const cStops = draftStopCount(current);
  const iStops = draftStopCount(incoming);
  if (cLegs > 0 && iLegs === 0) return cStops >= iStops ? "keep" : "merge";
  if (cStops > iStops && cLegs >= iLegs) return "keep";
  return "take";
}

/**
 * Keep worked itinerary / wizard when the incoming copy is thinner.
 * @param {object|null|undefined} current
 * @param {object|null|undefined} incoming
 */
export function mergeKeepRouteWork(current, incoming) {
  if (!incoming) return current || null;
  if (!current) return incoming;
  const decision = decideDraftLoad(current, incoming);
  if (decision === "keep") return current;
  const keepRoute = routeLegCount(incoming) === 0 && routeLegCount(current) > 0;
  const keepWizard =
    current.ui?.wizard &&
    (!incoming.ui?.wizard || incoming.ui.wizard.enabled === false);
  if (decision === "take" && !keepRoute && !keepWizard) return incoming;
  return {
    ...incoming,
    route: keepRoute ? current.route : incoming.route || current.route || null,
    ui: {
      ...(incoming.ui || {}),
      collapsedStopIds: incoming.ui?.collapsedStopIds || current.ui?.collapsedStopIds || [],
      wizard: keepWizard ? current.ui.wizard : incoming.ui?.wizard || current.ui?.wizard,
    },
  };
}

function emptyIndex() {
  return { v: 1, ids: [], meta: {} };
}

/**
 * @param {string|null|undefined} raw
 */
export function parseArchiveIndex(raw) {
  if (!raw) return emptyIndex();
  try {
    const j = JSON.parse(raw);
    if (!j || typeof j !== "object") return emptyIndex();
    const ids = Array.isArray(j.ids) ? j.ids.map(String).filter(Boolean) : [];
    const meta = j.meta && typeof j.meta === "object" ? j.meta : {};
    return { v: 1, ids, meta };
  } catch {
    return emptyIndex();
  }
}

/**
 * @param {object} index
 * @param {{ id: string, savedAt?: string, stopCount?: number, legCount?: number, label?: string }} entry
 * @param {{ max?: number }} [opts]
 */
export function upsertArchiveIndex(index, entry, opts = {}) {
  const max = opts.max ?? ARCHIVE_MAX;
  const id = draftIdFromEnvNo(entry?.id);
  if (!id) return index || emptyIndex();
  const prev = index && typeof index === "object" ? index : emptyIndex();
  const ids = [id, ...(prev.ids || []).filter((x) => x !== id)].slice(0, max);
  const dropped = (prev.ids || []).filter((x) => !ids.includes(x));
  return {
    v: 1,
    ids,
    meta: {
      ...(prev.meta || {}),
      [id]: {
        savedAt: entry.savedAt || new Date().toISOString(),
        stopCount: Number(entry.stopCount) || 0,
        legCount: Number(entry.legCount) || 0,
        label: entry.label || id,
      },
    },
    dropped,
  };
}

/**
 * @param {{ getItem?: Function, setItem?: Function, removeItem?: Function }} storage
 * @param {object} payload
 */
export function writeDraftArchive(storage, payload) {
  const id = draftIdFromEnvNo(payload?.info?.numero);
  if (!id || !storage?.setItem) return { ok: false, error: "missing_env_no" };
  const key = archiveItemKey(id);
  try {
    const existingRaw = storage.getItem?.(key);
    if (existingRaw) {
      const existing = JSON.parse(existingRaw);
      if (existing && decideDraftLoad(existing, payload) === "keep") {
        return { ok: true, id, skipped: true };
      }
    }
  } catch {
    /* ignore corrupt existing */
  }
  const savedAt = payload.savedAt || new Date().toISOString();
  const blob = { ...payload, savedAt };
  try {
    storage.setItem(key, JSON.stringify(blob));
    const index = upsertArchiveIndex(parseArchiveIndex(storage.getItem?.(ARCHIVE_INDEX_KEY)), {
      id,
      savedAt,
      stopCount: draftStopCount(blob),
      legCount: routeLegCount(blob),
      label: id,
    });
    storage.setItem(ARCHIVE_INDEX_KEY, JSON.stringify({ v: 1, ids: index.ids, meta: index.meta }));
    for (const dropId of index.dropped || []) {
      try {
        storage.removeItem?.(archiveItemKey(dropId));
      } catch {
        /* ignore */
      }
    }
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e?.message || "quota" };
  }
}

/**
 * @param {{ getItem?: Function }} storage
 * @param {string} id
 */
export function readDraftArchive(storage, id) {
  const key = archiveItemKey(id);
  if (!key || !storage?.getItem) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const j = JSON.parse(raw);
    return j && typeof j === "object" ? j : null;
  } catch {
    return null;
  }
}

/**
 * @param {{ getItem?: Function }} storage
 * @returns {Array<{ id: string, savedAt: string, stopCount: number, legCount: number, label: string }>}
 */
export function listDraftArchive(storage) {
  const index = parseArchiveIndex(storage?.getItem?.(ARCHIVE_INDEX_KEY));
  return (index.ids || []).map((id) => {
    const m = index.meta?.[id] || {};
    return {
      id,
      savedAt: m.savedAt || "",
      stopCount: Number(m.stopCount) || 0,
      legCount: Number(m.legCount) || 0,
      label: m.label || id,
    };
  });
}
