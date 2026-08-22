// brainKB.js — read side of the CENTRALIZED AI BRAIN for the Panelin agent.
//
// The brain is a set of self-evolving, human-verified "lessons" (policies distilled from real team
// corrections) maintained by the sheet-quote pipeline and published to gs://bmc-ml-tokens/bmc-brain/
// lessons.json. This module pulls that object into an in-memory cache (out-of-band, like trainingKB.js)
// and exposes a SYNCHRONOUS brainBlock(query) so buildSystemPrompt() — which is sync and cannot await —
// can inject the same "CONOCIMIENTO ACUMULADO" block every other BMC AI surface uses.
//
// Safety / design:
//  - READ-ONLY: never writes the store (the pipeline owns evolution). No hitCount mutation here.
//  - Off by default: gated by config.brainEnabled (VITE_FEATURE_BRAIN). brainBlock(), refreshBrain(), and
//    ensureBrainInit() are no-ops when disabled; if the cache is empty brainBlock() also returns "".
//  - GCS fetch is out-of-band (warm load at import + setInterval), never on the request path.
//  - Local-path override (config.brainLocalPath / BRAIN_LOCAL_PATH) for dev validation without GCS.
import fs from "node:fs";
import { config } from "../config.js";

const REFRESH_MS = Math.max(60_000, Number(process.env.BRAIN_REFRESH_MS || 300_000)); // 5 min default
const IS_CLOUD_RUN = !!process.env.K_SERVICE;

let _cache = { lessons: [], loadedAt: 0, source: "none" };
let _initPromise = null;

// ─── ranking (ported verbatim from the pipeline's knowledge.mjs so all surfaces rank identically) ──────
const _tokens = (s) =>
  new Set(String(s || "").toLowerCase().replace(/[^a-z0-9áéíóúñ ]/gi, " ").split(/\s+/).filter((w) => w.length > 2));
function _overlap(a, b) {
  const A = _tokens(a), B = _tokens(b);
  if (!A.size || !B.size) return 0;
  let n = 0; for (const w of A) if (B.has(w)) n++;
  return n / Math.sqrt(A.size * B.size);
}

// ─── loaders ───────────────────────────────────────────────────────────────────────────────────────
function _parseLessons(raw) {
  const arr = JSON.parse(raw);
  return Array.isArray(arr) ? arr : Array.isArray(arr?.lessons) ? arr.lessons : [];
}

async function _loadFromGcs() {
  const { Storage } = await import("@google-cloud/storage");
  const storage = new Storage();
  const [contents] = await storage.bucket(config.brainGcsBucket).file(config.brainGcsObject).download();
  return _parseLessons(contents.toString("utf8"));
}

function _loadFromLocal() {
  return _parseLessons(fs.readFileSync(config.brainLocalPath, "utf8"));
}

const _disabledResult = () => ({ count: 0, source: "none", skipped: true });

/** Refresh the in-memory cache from the canonical store. Best-effort; keeps the prior cache on failure. */
export async function refreshBrain() {
  if (!config.brainEnabled) return _disabledResult();
  try {
    let lessons = null, source = "none";
    if (config.brainLocalPath) { lessons = _loadFromLocal(); source = "local"; }
    else if (config.brainGcsBucket) { lessons = await _loadFromGcs(); source = "gcs"; }
    if (Array.isArray(lessons)) _cache = { lessons, loadedAt: Date.now(), source };
    return { count: _cache.lessons.length, source: _cache.source };
  } catch (err) {
    // 404 on first boot or transient GCS error — keep whatever we had, log once.
    if (err?.code !== 404) console.error("[brain] refresh failed:", err?.message || err);
    return { count: _cache.lessons.length, source: _cache.source, error: err?.message };
  }
}

/** Warm the cache once, then keep it fresh on an interval. Idempotent. Safe no-op when disabled or no source. */
export function ensureBrainInit() {
  if (!config.brainEnabled) return Promise.resolve(_disabledResult());
  if (_initPromise) return _initPromise;
  _initPromise = refreshBrain();
  // Background refresh (unref so it never holds the process open, e.g. in tests).
  const t = setInterval(() => { refreshBrain().catch(() => {}); }, REFRESH_MS);
  if (typeof t?.unref === "function") t.unref();
  return _initPromise;
}

/**
 * The injectable brain block for a query — SYNC, read-only, fail-soft. Returns "" when disabled/empty.
 * Lessons are POLICIES (not retrieval): rank by confidence·0.6 + overlap·0.4 and inject the top-N always.
 * @param {string} query  customer text to rank against ("" → top-N by confidence).
 * @param {number} [n]    cap (defaults to config.brainInjectCap).
 */
export function brainBlock(query = "", n = config.brainInjectCap) {
  if (!config.brainEnabled) return "";
  const active = _cache.lessons.filter((l) => l && l.status === "active");
  if (!active.length) return "";
  const ranked = active
    .map((l) => {
      const rel = Math.max(_overlap(query, l.trigger), _overlap(query, l.rule) * 0.7);
      return { l, score: (l.confidence ?? 0.7) * 0.6 + rel * 0.4 };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
  const lines = ranked.map(({ l }) => `- ${l.rule}`).join("\n");
  return `## CONOCIMIENTO ACUMULADO (reglas aprendidas de correcciones previas — aplicalas SIEMPRE que correspondan, tienen prioridad sobre los defaults)\n${lines}`;
}

/** Snapshot for diagnostics / health. */
export function brainStatus() {
  return {
    enabled: config.brainEnabled,
    active: _cache.lessons.filter((l) => l && l.status === "active").length,
    total: _cache.lessons.length,
    source: _cache.source,
    loadedAt: _cache.loadedAt ? new Date(_cache.loadedAt).toISOString() : null,
  };
}

// Self-init at import only when the feature flag is ON and a source is configured.
// Mirrors trainingKB.js's import-time warm load. In offline tests neither is set → silent no-op.
if (
  config.brainEnabled
  && (config.brainLocalPath || (IS_CLOUD_RUN && config.brainGcsBucket))
) {
  ensureBrainInit();
}
