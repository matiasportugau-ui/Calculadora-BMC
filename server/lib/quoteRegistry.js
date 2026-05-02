/**
 * Persistent quote registry for the Panelin agent.
 *
 * Stores one JSON object per quote at `gs://${GCS_QUOTES_BUCKET}/registry/{pdfId}.json`
 * so `obtener_cotizacion_por_id` and `listar_cotizaciones_recientes` survive
 * Cloud Run cold-starts.
 *
 * Falls back to an in-memory Map when GCS_QUOTES_BUCKET is unset (local dev
 * without GCS credentials). The fallback keeps the old 24h TTL so memory
 * doesn't grow unbounded; the GCS path has no TTL — quotes are permanent.
 */
import { config } from "../config.js";
import {
  uploadJsonToGcsPath,
  downloadJsonFromGcs,
  listJsonInGcs,
} from "./gcsUpload.js";

const PREFIX = "registry/";
const FALLBACK_TTL_MS = 24 * 60 * 60 * 1000;

// In-memory cache. Always consulted first; also acts as the storage layer when
// no bucket is configured.
const cache = new Map();
let warnedNoBucket = false;

function bucket() {
  return config.gcsQuotesBucket || "";
}

function gcsPath(pdfId) {
  return `${PREFIX}${pdfId}.json`;
}

function buildEntry({ pdfId, pdfUrl, code, client, scenario, total, lista }) {
  return {
    id: pdfId,
    code: code || null,
    client: client || "—",
    scenario: scenario || "",
    total: total || 0,
    lista: lista || "web",
    pdfUrl,
    createdAt: Date.now(),
    timestamp: new Date().toISOString(),
    status: "active",
    cancelledAt: null,
    cancelReason: null,
    cancelBy: null,
  };
}

function pruneCacheIfNoBucket() {
  if (bucket()) return;
  const now = Date.now();
  for (const [id, entry] of cache) {
    if (now - (entry.createdAt || 0) > FALLBACK_TTL_MS) cache.delete(id);
  }
}

function warnIfNoBucketOnce() {
  if (bucket() || warnedNoBucket) return;
  warnedNoBucket = true;
  console.warn(
    "[quoteRegistry] GCS_QUOTES_BUCKET unset — using in-memory fallback (24h TTL, no persistence across restarts)."
  );
}

/**
 * Persist a new quote registration. Updates cache + GCS (best-effort).
 * @param {object} input  { pdfId, pdfUrl, code, client, scenario, total, lista }
 * @returns {Promise<{ok:true,entry:object}>}
 */
export async function registerQuotation(input) {
  warnIfNoBucketOnce();
  const entry = buildEntry(input);
  cache.set(entry.id, entry);

  const b = bucket();
  if (b) {
    try {
      await uploadJsonToGcsPath(entry, gcsPath(entry.id), b);
    } catch (err) {
      console.warn(`[quoteRegistry] GCS persist failed for ${entry.id}: ${err.message}`);
    }
  }
  pruneCacheIfNoBucket();
  return { ok: true, entry };
}

/**
 * Look up a quote by id. Cache first, then GCS.
 * @param {string} pdfId
 * @returns {Promise<object|null>}
 */
export async function getQuotation(pdfId) {
  if (!pdfId) return null;
  if (cache.has(pdfId)) return cache.get(pdfId);

  const b = bucket();
  if (!b) return null;
  try {
    const entry = await downloadJsonFromGcs(gcsPath(pdfId), b);
    if (entry) cache.set(pdfId, entry);
    return entry;
  } catch {
    return null;
  }
}

/**
 * List quotes sorted by createdAt desc. Filters cancelled by default.
 * @param {object} [opts]
 * @param {number} [opts.limit=50]
 * @param {boolean} [opts.includeCancelled=false]
 * @returns {Promise<Array<object>>}
 */
export async function listQuotations({ limit = 50, includeCancelled = false } = {}) {
  const b = bucket();
  const seen = new Map();

  if (b) {
    const files = await listJsonInGcs({ bucket: b, prefix: PREFIX, limit: Math.max(limit * 2, 100) });
    const ids = files
      .map((f) => {
        const m = f.name.match(/^registry\/(.+)\.json$/);
        return m ? m[1] : null;
      })
      .filter(Boolean);
    const fetched = await Promise.all(ids.map((id) => getQuotation(id)));
    for (const entry of fetched) {
      if (entry?.id) seen.set(entry.id, entry);
    }
  } else {
    pruneCacheIfNoBucket();
  }

  // Always merge in-memory cache so a transient GCS failure (or a quote that
  // was registered on this instance but persistence fell back) still surfaces.
  for (const entry of cache.values()) {
    if (entry?.id && !seen.has(entry.id)) seen.set(entry.id, entry);
  }

  let entries = Array.from(seen.values());
  entries.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (!includeCancelled) {
    entries = entries.filter((e) => e.status !== "cancelled");
  }
  return entries.slice(0, Math.max(1, Math.min(500, limit)));
}

/**
 * Mark a quote as cancelled (soft delete). Returns { ok, entry } or { ok:false, error }.
 * @param {string} pdfId
 * @param {object} [opts]
 * @param {string} [opts.reason]
 * @param {string} [opts.by]
 * @returns {Promise<{ok:true,entry:object}|{ok:false,error:string}>}
 */
export async function cancelQuotation(pdfId, { reason, by } = {}) {
  const existing = await getQuotation(pdfId);
  if (!existing) return { ok: false, error: `Cotización ${pdfId} no encontrada` };
  if (existing.status === "cancelled") {
    return { ok: true, entry: existing, alreadyCancelled: true };
  }

  const updated = {
    ...existing,
    status: "cancelled",
    cancelledAt: new Date().toISOString(),
    cancelReason: reason ? String(reason).slice(0, 500) : null,
    cancelBy: by ? String(by).slice(0, 200) : null,
  };
  cache.set(pdfId, updated);

  const b = bucket();
  if (b) {
    try {
      await uploadJsonToGcsPath(updated, gcsPath(pdfId), b);
    } catch (err) {
      return { ok: false, error: `GCS update falló: ${err.message}` };
    }
  }
  return { ok: true, entry: updated };
}

/** Test/admin reset of in-memory cache. Does not touch GCS. */
export function _resetCacheForTests() {
  cache.clear();
  warnedNoBucket = false;
}
