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

function buildEntry({ pdfId, pdfUrl, code, client, scenario, total, lista, source }) {
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
    source: source === "ae_agent" ? "ae_agent" : "calculator",
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
 * @param {number}  [opts.limit=50]
 * @param {boolean} [opts.includeCancelled=false]
 * @param {string}  [opts.cliente]   Case-insensitive substring filter on client
 * @param {string}  [opts.source]    "ae_agent" | "calculator"
 * @param {boolean} [opts.omitCalcOnly=false] When true, drop `kind: "calc_only"` rows (HTTP list for humans).
 * @returns {Promise<Array<object>>}
 *
 * Filters apply BEFORE the limit cap so requesting "10 quotes for cliente=Juan"
 * returns up to 10 matching Juan quotes — not the 10 newest quotes that
 * happen to include Juan. (Copilot finding: prior code paginated first then
 * filtered, silently missing matches outside the first page.)
 */
export async function listQuotations({ limit = 50, includeCancelled = false, cliente = null, source = null, omitCalcOnly = false } = {}) {
  const b = bucket();
  const seen = new Map();

  if (b) {
    // Pull a wider GCS window when filters are active so post-filter results
    // can still satisfy `limit`. 500 covers ~6 months at typical volume.
    // Only widen fetch if filters are actually non-empty after validation.
    const hasClienteFilter = cliente && String(cliente).trim().length > 0;
    const hasSourceFilter = source && (source === "ae_agent" || source === "calculator");
    const fetchLimit = (hasClienteFilter || hasSourceFilter) ? 500 : Math.max(limit * 2, 100);
    const files = await listJsonInGcs({ bucket: b, prefix: PREFIX, limit: fetchLimit });
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
  if (cliente) {
    const needle = String(cliente).trim().toLowerCase();
    // Short-circuit if needle is empty to avoid matching everything
    if (needle.length > 0) {
      entries = entries.filter((e) => String(e.client || "").toLowerCase().includes(needle));
    }
  }
  if (source && (source === "ae_agent" || source === "calculator")) {
    entries = entries.filter((e) => (e.source || "calculator") === source);
  }
  if (omitCalcOnly) {
    entries = entries.filter((e) => e.kind !== "calc_only");
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

// ── Calc-only event archive (no PDF) ────────────────────────────────────────
//
// `recordCalcEvent` registers a thin entry whenever an AE-agent quote runs
// through /calc/cotizar without a follow-up /calc/cotizar/pdf. It satisfies
// the "every agent quote archived" requirement without forcing a PDF render.
// Entries carry kind="calc_only" so listar_cotizaciones_recientes can
// distinguish them from full PDF-backed quotes (which carry kind="pdf").
//
// Idempotency: a 5-minute hash window prevents duplicates when the same
// session retries the same body. The PDF path's existing registerQuotation
// remains the canonical entry — when a calc_only row exists with the same
// hash and a PDF is later generated, the PDF entry replaces it.

const CALC_EVENT_PREFIX = "calc-events/";
const DEDUPE_WINDOW_MS = 5 * 60 * 1000;
const recentCalcEvents = new Map(); // hash → { id, ts }

function calcEventGcsPath(id) {
  return `${CALC_EVENT_PREFIX}${id}.json`;
}

function pruneCalcEventDedupe() {
  const cutoff = Date.now() - DEDUPE_WINDOW_MS;
  for (const [hash, info] of recentCalcEvents) {
    if (info.ts < cutoff) recentCalcEvents.delete(hash);
  }
}

/**
 * Register a thin "this AE quote was computed" entry. Best-effort: GCS
 * failures are logged, never thrown, never block the caller.
 *
 * @param {object} input
 * @param {string} input.source              "ae_agent" or "calculator"
 * @param {string} input.scenario
 * @param {string} input.lista
 * @param {object} input.summary             { total_usd, subtotal_usd, area_m2, cant_paneles }
 * @param {string} input.requestHash         hash for dedupe
 * @param {string} [input.sessionId]
 * @param {string} [input.client]
 * @returns {Promise<{ok:true,entry:object,deduped?:boolean}|{ok:false,error:string}>}
 */
export async function recordCalcEvent({ source = "ae_agent", scenario, lista = "web", summary = {}, requestHash, sessionId = null, client = "—" } = {}) {
  pruneCalcEventDedupe();
  if (requestHash && recentCalcEvents.has(requestHash)) {
    const info = recentCalcEvents.get(requestHash);
    return { ok: true, entry: cache.get(info.id) || null, deduped: true };
  }

  warnIfNoBucketOnce();
  const id = `calc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const entry = {
    id,
    kind: "calc_only",
    code: null,
    client,
    scenario: scenario || "",
    total: Number(summary?.total_usd || 0),
    subtotal: Number(summary?.subtotal_usd || 0),
    area_m2: Number(summary?.area_m2 || 0),
    cant_paneles: Number(summary?.cant_paneles || 0),
    lista: lista || "web",
    pdfUrl: null,
    sessionId,
    requestHash: requestHash || null,
    createdAt: Date.now(),
    timestamp: new Date().toISOString(),
    source: source === "ae_agent" ? "ae_agent" : "calculator",
    status: "active",
    cancelledAt: null,
    cancelReason: null,
    cancelBy: null,
  };
  cache.set(id, entry);
  if (requestHash) recentCalcEvents.set(requestHash, { id, ts: entry.createdAt });

  const b = bucket();
  if (b) {
    try {
      await uploadJsonToGcsPath(entry, calcEventGcsPath(id), b);
    } catch (err) {
      console.warn(`[quoteRegistry] GCS persist failed for calc-event ${id}: ${err.message}`);
    }
  }
  pruneCacheIfNoBucket();
  return { ok: true, entry };
}

/** Test/admin reset of in-memory cache. Does not touch GCS. */
export function _resetCacheForTests() {
  cache.clear();
  recentCalcEvents.clear();
  warnedNoBucket = false;
}
