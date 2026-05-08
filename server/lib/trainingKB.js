import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { normalizeSurface, SURFACE_LIMITS } from "./kbSurface.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const dataDir = path.join(repoRoot, "data");
const kbPath = path.join(dataDir, "training-kb.json");
const sessionsDir = path.join(dataDir, "training-sessions");
const backupsDir = path.join(dataDir, "prompt-backups");
const chatPromptsPath = path.join(repoRoot, "server/lib/chatPrompts.js");

const KB_VERSION = "1.0.0";

const MS_PER_DAY = 86_400_000;

// ─── GCS persistence (Cloud Run) ─────────────────────────────────────────────
// Cloud Run filesystem is ephemeral — every deploy loses local writes.
// When running in Cloud Run (K_SERVICE env set) and GCS_KB_BUCKET is configured,
// loadTrainingKB() reads from GCS and saveTrainingKB() writes to GCS.
// A 60-second in-memory cache avoids GCS reads on every chat turn.

const GCS_BUCKET = process.env.GCS_KB_BUCKET || process.env.GCS_QUOTES_BUCKET || "";
const GCS_OBJECT = process.env.GCS_KB_OBJECT || "kb/training-kb.json";
const IS_CLOUD_RUN = !!(process.env.K_SERVICE);
const USE_GCS = IS_CLOUD_RUN && !!GCS_BUCKET;

let _kbCache = null; // { kb, loadedAt }
const CACHE_TTL_MS = 60_000;

function _cacheValid() {
  return _kbCache && (Date.now() - _kbCache.loadedAt < CACHE_TTL_MS);
}

function _setCache(kb) {
  _kbCache = { kb: JSON.parse(JSON.stringify(kb)), loadedAt: Date.now() };
}

export function clearKbCache() {
  _kbCache = null;
}

async function _loadFromGcs() {
  const { Storage } = await import("@google-cloud/storage");
  const storage = new Storage();
  try {
    const [contents] = await storage.bucket(GCS_BUCKET).file(GCS_OBJECT).download();
    return JSON.parse(contents.toString("utf8"));
  } catch (err) {
    if (err.code === 404) return null; // first boot — no remote file yet
    throw err;
  }
}

async function _saveToGcs(safe) {
  const { Storage } = await import("@google-cloud/storage");
  const storage = new Storage();
  await storage.bucket(GCS_BUCKET).file(GCS_OBJECT).save(
    JSON.stringify(safe, null, 2),
    { contentType: "application/json; charset=utf-8", resumable: false }
  );
}

// ─── Local helpers ────────────────────────────────────────────────────────────

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function emptyKb() {
  return {
    version: KB_VERSION,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    entries: [],
  };
}

function ensureKbFile() {
  ensureDir(dataDir);
  if (!fs.existsSync(kbPath)) fs.writeFileSync(kbPath, JSON.stringify(emptyKb(), null, 2), "utf8");
}

// ─── GCS startup init ─────────────────────────────────────────────────────────
// On Cloud Run: pre-load KB from GCS into memory cache at import time.
// Writes propagate: local snapshot (fast) + async GCS (persistent).

let _gcsInitPromise = null;

/** Public: await before any read when GCS mode is active (Cloud Run cold-start guard). */
export function ensureGcsInit() { return _ensureGcsInit(); }

function _ensureGcsInit() {
  if (!USE_GCS) return Promise.resolve();
  if (!_gcsInitPromise) {
    _gcsInitPromise = _loadFromGcs()
      .then((remote) => {
        if (remote && Array.isArray(remote.entries)) {
          _setCache(remote);
          // Mirror remote → local for dev inspection
          try { ensureDir(dataDir); fs.writeFileSync(kbPath, JSON.stringify(remote, null, 2), "utf8"); } catch { /* read-only FS ok */ }
        } else {
          // No remote yet — push local file to GCS as seed
          ensureKbFile();
          try {
            const local = JSON.parse(fs.readFileSync(kbPath, "utf8"));
            _setCache(local);
            _saveToGcs(local).catch(() => {});
          } catch { _setCache(emptyKb()); }
        }
      })
      .catch((err) => { console.error("[KB] GCS init failed:", err?.message || err); });
  }
  return _gcsInitPromise;
}

// Kick off immediately on import in Cloud Run
if (USE_GCS) _ensureGcsInit();

// ─── Public load / save ───────────────────────────────────────────────────────

export function loadTrainingKB() {
  if (USE_GCS && _cacheValid()) return JSON.parse(JSON.stringify(_kbCache.kb));

  ensureKbFile();
  try {
    const raw = fs.readFileSync(kbPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.entries)) throw new Error("Invalid KB shape");
    if (USE_GCS) _setCache(parsed);
    return parsed;
  } catch {
    const fallback = emptyKb();
    if (USE_GCS) _setCache(fallback);
    return fallback;
  }
}

export function saveTrainingKB(kb) {
  const safe = {
    version: KB_VERSION,
    createdAt: kb.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    entries: Array.isArray(kb.entries) ? kb.entries : [],
  };

  // Local write (dev + Cloud Run snapshot)
  try { ensureDir(dataDir); fs.writeFileSync(kbPath, JSON.stringify(safe, null, 2), "utf8"); } catch { /* ignore on read-only FS */ }

  if (USE_GCS) {
    _setCache(safe); // immediate cache update so next read sees new data
    _saveToGcs(safe).catch((err) => {
      console.error("[KB] GCS save failed (non-critical):", err.message);
    });
  }

  return safe;
}

// ─── Entry CRUD ───────────────────────────────────────────────────────────────

// Freshness windows per category (days until reviewDueAt). null = never stale.
const FRESHNESS_DAYS = { sales: 30, product: 90, conversational: 180, math: null };

function reviewDueAt(category) {
  const days = FRESHNESS_DAYS[category] ?? null;
  if (!days) return null;
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

function normalizeCategory(category) {
  const value = String(category || "conversational").trim().toLowerCase();
  if (value === "mercadolibre" || value === "ml") return "sales";
  if (["sales", "math", "product", "conversational"].includes(value)) return value;
  return "conversational";
}

function scoreOverlap(query, text) {
  const qTokens = new Set(
    String(query || "")
      .toLowerCase()
      .split(/[^a-z0-9áéíóúñü]+/i)
      .filter((t) => t.length >= 3)
  );
  if (qTokens.size === 0) return 0;
  let score = 0;
  for (const token of qTokens) {
    if (String(text || "").toLowerCase().includes(token)) score += 1;
  }
  return score;
}

export function addTrainingEntry(payload = {}) {
  const kb = loadTrainingKB();
  const goodAnswerRaw = payload.goodAnswer ?? payload.answer;
  const entry = {
    id: crypto.randomUUID(),
    category: normalizeCategory(payload.category),
    question: String(payload.question || "").trim(),
    badAnswer: String(payload.badAnswer || "").trim(),
    goodAnswer: String(goodAnswerRaw || "").trim(),
    context: String(payload.context || "").trim(),
    source: String(payload.source || "manual"),
    permanent: Boolean(payload.permanent),
    status: ["active", "pending", "rejected"].includes(payload.status) ? payload.status : "active",
    confidence: payload.confidence != null ? Number(payload.confidence) : null,
    convId: payload.convId ? String(payload.convId) : null,
    goodAnswerML: payload.goodAnswerML ? String(payload.goodAnswerML).trim() : null,
    goodAnswerWA: payload.goodAnswerWA ? String(payload.goodAnswerWA).trim() : null,
    retrievalCount: 0,
    lastRetrievedAt: null,
    reviewDueAt: payload.permanent ? null : reviewDueAt(normalizeCategory(payload.category)),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (!entry.question || !entry.goodAnswer) {
    throw new Error("question and goodAnswer are required");
  }
  // Flag conflicts at ingest time (non-blocking — stored on entry for admin review)
  entry.conflictWith = detectConflicts(entry).map((c) => c.id);
  kb.entries.unshift(entry);
  saveTrainingKB(kb);
  return entry;
}

export function approveTrainingEntry(entryId) {
  return updateTrainingEntry(entryId, { status: "active" });
}

export function rejectTrainingEntry(entryId, reason = "") {
  const kb = loadTrainingKB();
  const idx = kb.entries.findIndex((e) => e.id === entryId);
  if (idx < 0) throw new Error("entry not found");
  kb.entries[idx] = { ...kb.entries[idx], status: "rejected", rejectReason: String(reason), updatedAt: new Date().toISOString() };
  saveTrainingKB(kb);
  return kb.entries[idx];
}

export function listPendingEntries() {
  const kb = loadTrainingKB();
  return kb.entries.filter((e) => e.status === "pending");
}

export function updateTrainingEntry(entryId, patch = {}) {
  const kb = loadTrainingKB();
  const idx = kb.entries.findIndex((e) => e.id === entryId);
  if (idx < 0) throw new Error("entry not found");
  const prev = kb.entries[idx];
  let nextGood = prev.goodAnswer;
  if (Object.prototype.hasOwnProperty.call(patch, "goodAnswer")) {
    nextGood = String(patch.goodAnswer ?? "").trim();
  } else if (Object.prototype.hasOwnProperty.call(patch, "answer")) {
    nextGood = String(patch.answer ?? "").trim();
  }
  const next = {
    ...prev,
    category: patch.category ? normalizeCategory(patch.category) : prev.category,
    question: patch.question != null ? String(patch.question).trim() : prev.question,
    badAnswer: patch.badAnswer != null ? String(patch.badAnswer).trim() : prev.badAnswer,
    goodAnswer: nextGood,
    context: patch.context != null ? String(patch.context).trim() : prev.context,
    permanent: patch.permanent != null ? Boolean(patch.permanent) : prev.permanent,
    status: patch.status && ["active", "pending", "rejected"].includes(patch.status) ? patch.status : prev.status ?? "active",
    goodAnswerML: patch.goodAnswerML !== undefined ? (patch.goodAnswerML ? String(patch.goodAnswerML).trim() : null) : prev.goodAnswerML ?? null,
    goodAnswerWA: patch.goodAnswerWA !== undefined ? (patch.goodAnswerWA ? String(patch.goodAnswerWA).trim() : null) : prev.goodAnswerWA ?? null,
    conflictWith: patch.conflictWith !== undefined ? (Array.isArray(patch.conflictWith) ? patch.conflictWith : []) : prev.conflictWith ?? [],
    reviewDueAt: patch.reviewDueAt !== undefined ? (patch.reviewDueAt || null) : prev.reviewDueAt ?? null,
    updatedAt: new Date().toISOString(),
  };
  kb.entries[idx] = next;
  saveTrainingKB(kb);
  return next;
}

export function deleteTrainingEntry(entryId) {
  const kb = loadTrainingKB();
  const nextEntries = kb.entries.filter((e) => e.id !== entryId);
  kb.entries = nextEntries;
  saveTrainingKB(kb);
  return { ok: true };
}

export function listTrainingEntries({ category } = {}) {
  const kb = loadTrainingKB();
  if (!category) return kb.entries;
  const target = normalizeCategory(category);
  return kb.entries.filter((e) => e.category === target);
}

export const DEFAULT_SCORING_CONFIG = {
  permanentBonus: 100,
  questionMatchWeight: 3,
  contextMatchWeight: 1,
  answerMatchWeight: 1,
};

export function loadScoringConfig() {
  try {
    const p = path.join(dataDir, "kb-score-config.json");
    if (fs.existsSync(p)) return { ...DEFAULT_SCORING_CONFIG, ...JSON.parse(fs.readFileSync(p, "utf8")) };
  } catch { /* ignore */ }
  return DEFAULT_SCORING_CONFIG;
}

export function saveScoringConfig(config) {
  ensureDir(dataDir);
  fs.writeFileSync(path.join(dataDir, "kb-score-config.json"), JSON.stringify(config, null, 2), "utf8");
}

/**
 * Detect conflicts: entries with similar question (≥3 tokens) but different answer (≤2 tokens overlap).
 * Same topic + different answer = likely contradiction.
 * Excludes the entry itself (by id) and rejected/archived entries.
 */
export function detectConflicts(entry, { questionThreshold = 3, answerThreshold = 2 } = {}) {
  const kb = loadTrainingKB();
  const qTokens = String(entry.question || "").toLowerCase().split(/[^a-z0-9áéíóúñü]+/i).filter(t => t.length >= 3);
  const aTokens = String(entry.goodAnswer || "").toLowerCase().split(/[^a-z0-9áéíóúñü]+/i).filter(t => t.length >= 3);
  if (qTokens.length === 0) return [];

  return kb.entries.filter((e) => {
    if (e.id === entry.id) return false;
    if (e.archived || e.status === "rejected") return false;

    let qScore = 0;
    for (const t of qTokens) { if (String(e.question || "").toLowerCase().includes(t)) qScore++; }
    if (qScore < questionThreshold) return false;

    let aScore = 0;
    for (const t of aTokens) { if (String(e.goodAnswer || "").toLowerCase().includes(t)) aScore++; }
    return aScore <= answerThreshold;
  }).map((e) => ({ id: e.id, question: e.question, goodAnswer: e.goodAnswer.slice(0, 150) }));
}

/** Run conflict detection across all active entries and return pairs. */
export function findAllConflicts() {
  const kb = loadTrainingKB();
  const active = kb.entries.filter((e) => !e.archived && (e.status == null || e.status === "active"));
  const seen = new Set();
  const pairs = [];

  for (const entry of active) {
    const conflicts = detectConflicts(entry);
    for (const c of conflicts) {
      const key = [entry.id, c.id].sort().join("|");
      if (!seen.has(key)) {
        seen.add(key);
        pairs.push({ a: { id: entry.id, question: entry.question, goodAnswer: entry.goodAnswer }, b: c });
      }
    }
  }
  return pairs;
}

/** Question-only dedup check — ignores permanentBonus, compares question tokens only. */
export function hasSimilarQuestion(question, { threshold = 4 } = {}) {
  const kb = loadTrainingKB();
  const qTokens = String(question || "").toLowerCase().split(/[^a-z0-9áéíóúñü]+/i).filter(t => t.length >= 3);
  if (qTokens.length === 0) return false;
  return kb.entries
    .filter((e) => !e.archived && (e.status == null || e.status === "active"))
    .some((e) => {
      let score = 0;
      for (const t of qTokens) { if (String(e.question || "").toLowerCase().includes(t)) score++; }
      return score >= threshold;
    });
}

/**
 * Resolves the answer text for an entry on a given surface (channel).
 *
 * Fallback chain (per Brief §6.4):
 *   1. entry.responses[surface]    (new shape, per-surface override)
 *   2. legacy fields               (goodAnswerML for mercado_libre, goodAnswerWA for whatsapp)
 *   3. entry.responses.default     (new shape, canonical)
 *   4. entry.goodAnswer            (legacy canonical)
 *   5. "" (empty — caller should treat as "no entry to inject")
 *
 * The result is truncated to SURFACE_LIMITS[surface] with an ellipsis suffix.
 * Empty strings in any layer are skipped (treated as missing).
 *
 * @param {object|null|undefined} entry — KB entry or null.
 * @param {string} [surface] — one of KB_SURFACES; invalid values fall back to "panelin_chat".
 * @returns {string}
 */
export function resolveTrainingAnswer(entry, surface) {
  if (!entry || typeof entry !== "object") return "";
  const s = normalizeSurface(surface);
  const responses = entry.responses && typeof entry.responses === "object" ? entry.responses : null;

  const LEGACY_BY_SURFACE = {
    mercado_libre: entry.goodAnswerML,
    whatsapp: entry.goodAnswerWA,
  };

  const candidates = [
    responses ? responses[s] : null,
    LEGACY_BY_SURFACE[s],
    responses ? responses.default : null,
    entry.goodAnswer,
  ];

  let text = "";
  for (const c of candidates) {
    if (typeof c === "string" && c.length > 0) { text = c; break; }
  }

  const max = SURFACE_LIMITS[s] ?? SURFACE_LIMITS.panelin_chat;
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

export function findRelevantExamples(query, { limit = 5, scoringConfig, track = true } = {}) {
  const cfg = scoringConfig || loadScoringConfig();
  const kb = loadTrainingKB();
  const matched = kb.entries
    .filter((e) => !e.archived && (e.status == null || e.status === "active"))
    .map((entry) => {
      const score =
        (entry.permanent ? cfg.permanentBonus : 0) +
        scoreOverlap(query, entry.question) * cfg.questionMatchWeight +
        scoreOverlap(query, entry.context) * cfg.contextMatchWeight +
        scoreOverlap(query, entry.goodAnswer) * cfg.answerMatchWeight;
      return { entry, score };
    })
    .filter((it) => it.score > 0)
    .sort((a, b) => b.score - a.score || b.entry.updatedAt.localeCompare(a.entry.updatedAt))
    .slice(0, limit);

  // Track retrieval counts — write-back is async/fire-and-forget to avoid
  // blocking the chat response. Uses setImmediate so the caller gets results first.
  if (track && matched.length > 0) {
    const ids = new Set(matched.map((m) => m.entry.id));
    const now = new Date().toISOString();
    setImmediate(() => {
      try {
        const kb2 = loadTrainingKB();
        let changed = false;
        for (const e of kb2.entries) {
          if (ids.has(e.id)) {
            e.retrievalCount = (e.retrievalCount ?? 0) + 1;
            e.lastRetrievedAt = now;
            changed = true;
          }
        }
        if (changed) saveTrainingKB(kb2);
      } catch { /* non-critical */ }
    });
  }

  return matched.map((it) => ({ ...it.entry, matchScore: it.score }));
}

export function bulkDeleteEntries(ids) {
  const idSet = new Set(Array.isArray(ids) ? ids : []);
  const kb = loadTrainingKB();
  const before = kb.entries.length;
  kb.entries = kb.entries.filter((e) => !idSet.has(e.id));
  const deletedCount = before - kb.entries.length;
  saveTrainingKB(kb);
  return { ok: true, deletedCount, requestedCount: idSet.size };
}

export function bulkPatchEntries(ids, patch) {
  const idSet = new Set(Array.isArray(ids) ? ids : []);
  const kb = loadTrainingKB();
  let patchedCount = 0;
  kb.entries = kb.entries.map((e) => {
    if (!idSet.has(e.id)) return e;
    patchedCount += 1;
    return {
      ...e,
      ...(patch.archived != null ? { archived: Boolean(patch.archived) } : {}),
      ...(patch.permanent != null ? { permanent: Boolean(patch.permanent) } : {}),
      updatedAt: new Date().toISOString(),
    };
  });
  saveTrainingKB(kb);
  return { ok: true, patchedCount, requestedCount: idSet.size };
}

/** Returns the actual entry objects for each health category (for the health panel UI). */
export function getHealthEntries() {
  const kb = loadTrainingKB();
  const active = kb.entries.filter((e) => !e.archived && (e.status == null || e.status === "active"));
  const now = new Date().toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();

  // mlGap / waGap: canonical answer too long for the channel and no override.
  // Override = responses[surface] (new shape) OR legacy goodAnswerML/WA.
  const hasMlOverride = (e) => !!(e.responses?.mercado_libre) || !!e.goodAnswerML;
  const hasWaOverride = (e) => !!(e.responses?.whatsapp) || !!e.goodAnswerWA;

  return {
    stale: active.filter((e) => e.reviewDueAt && e.reviewDueAt < now),
    zeroRetrieval: active.filter((e) => !e.permanent && (e.retrievalCount ?? 0) === 0 && (e.createdAt || "") < thirtyDaysAgo),
    mlGap: active.filter((e) => (e.goodAnswer || "").length > 350 && !hasMlOverride(e)),
    waGap: active.filter((e) => (e.goodAnswer || "").length > 700 && !hasWaOverride(e)),
  };
}

export function getTrainingStats() {
  const kb = loadTrainingKB();
  const all = kb.entries;
  const active = all.filter((e) => !e.archived && (e.status == null || e.status === "active"));
  const now = Date.now();
  const thirtyDaysAgo = new Date(now - 30 * 86_400_000).toISOString();

  const byCategory = active.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + 1;
    return acc;
  }, {});

  const bySource = active.reduce((acc, e) => {
    const s = e.source || "manual";
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  // Health signals — count entries that need attention per channel.
  // Override = new responses[surface] map OR legacy goodAnswerML/WA field.
  const hasMlOverride = (e) => !!(e.responses?.mercado_libre) || !!e.goodAnswerML;
  const hasWaOverride = (e) => !!(e.responses?.whatsapp) || !!e.goodAnswerWA;
  const stale = active.filter((e) => e.reviewDueAt && e.reviewDueAt < new Date().toISOString()).length;
  const zeroRetrieval = active.filter((e) => !e.permanent && (e.retrievalCount ?? 0) === 0 && e.createdAt < thirtyDaysAgo).length;
  const mlGap = active.filter((e) => (e.goodAnswer || "").length > 350 && !hasMlOverride(e)).length;
  const waGap = active.filter((e) => (e.goodAnswer || "").length > 700 && !hasWaOverride(e)).length;
  const pending = all.filter((e) => e.status === "pending").length;

  return {
    total: active.length,
    pending,
    byCategory,
    bySource,
    health: {
      stale,           // have reviewDueAt in the past
      zeroRetrieval,   // never retrieved, older than 30 days
      mlGap,           // goodAnswer too long for ML channel, no override
      waGap,           // goodAnswer too long for WA channel, no override
      score: Math.max(0, 100 - stale * 5 - zeroRetrieval * 2 - mlGap * 3 - waGap * 2),
    },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Per-surface coverage metrics (F4 / Brief §6.6).
 *
 * For each non-default surface, count entries that:
 *   - have an override (responses[surface] or legacy goodAnswer{ML,WA})
 *   - are eligible for an override (active + non-permanent + canonical
 *     answer too long for the surface limit)
 *
 * The result lets the Admin compute coverage_pct = with_override / eligible.
 *
 * @returns {{
 *   mercado_libre: { total_with_override: number, gap_count: number, eligible: number, coverage_pct: number },
 *   whatsapp:      { total_with_override: number, gap_count: number, eligible: number, coverage_pct: number },
 *   email:         { total_with_override: number, gap_count: number, eligible: number, coverage_pct: number }
 * }}
 */
export function getSurfaceCoverage() {
  const kb = loadTrainingKB();
  // Exclude archived, permanent, and non-active entries — permanent entries
  // don't need surface overrides so they are excluded from eligibility, matching
  // the JSDoc contract ("active + non-permanent + canonical answer too long").
  const active = kb.entries.filter(
    (e) => !e.archived && !e.permanent && (e.status == null || e.status === "active")
  );

  const SURFACE_TO_LEGACY = {
    mercado_libre: "goodAnswerML",
    whatsapp: "goodAnswerWA",
    email: null,
  };

  const out = {};
  for (const surface of Object.keys(SURFACE_TO_LEGACY)) {
    const legacyField = SURFACE_TO_LEGACY[surface];
    // Use the shared constant from kbSurface.js to avoid duplication and drift.
    const limit = SURFACE_LIMITS[surface];

    let withOverride = 0;
    let eligible = 0;
    for (const e of active) {
      const isLong = (e.goodAnswer || "").length > limit;
      if (!isLong) continue;
      // Only count eligible entries — prevents coverage_pct from exceeding 100.
      eligible++;
      const hasMapOverride = !!(e.responses && typeof e.responses === "object" && e.responses[surface]);
      const hasLegacy = !!(legacyField && e[legacyField]);
      if (hasMapOverride || hasLegacy) withOverride++;
    }
    const gap = Math.max(0, eligible - withOverride);
    const coveragePct = eligible === 0 ? 100 : Math.round((withOverride / eligible) * 100);

    out[surface] = {
      total_with_override: withOverride,
      gap_count: gap,
      eligible,
      coverage_pct: coveragePct,
    };
  }
  return out;
}

/**
 * Daily retrieval trend over the last `days` days, as `[{ date, count }]`
 * sorted oldest → newest. Counts are based on `entry.lastRetrievedAt` only,
 * so the series only reflects ONE retrieval per entry per period (the
 * latest). For full per-turn aggregation we'd need session JSONLs — see
 * getTopQueries for that path.
 *
 * @param {{ days?: number }} [opts]
 * @returns {Array<{ date: string, count: number }>}
 */
export function getRetrievalTrend({ days = 14 } = {}) {
  const kb = loadTrainingKB();
  const buckets = new Map(); // YYYY-MM-DD → count
  // Snap to UTC midnight so bucket keys align with the calendar-day slices of
  // lastRetrievedAt ISO strings, regardless of the server's local timezone.
  const todayMidnightMs = new Date().setUTCHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(todayMidnightMs - i * MS_PER_DAY);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const e of kb.entries) {
    if (!e.lastRetrievedAt) continue;
    const day = String(e.lastRetrievedAt).slice(0, 10);
    if (buckets.has(day)) buckets.set(day, buckets.get(day) + 1);
  }
  return [...buckets.entries()].map(([date, count]) => ({ date, count }));
}

/**
 * Aggregated top user queries from session JSONL files over the last `days`
 * days. Each row is a query string + occurrence count + a `hasMatch` flag
 * derived from whether ANY session event for that query reported at least
 * one matched KB entry.
 *
 * Falls back to an empty array if no sessions are available (sessionsDir
 * missing or unreadable). Never throws.
 *
 * @param {{ days?: number, limit?: number }} [opts]
 * @returns {Array<{ query: string, count: number, hasMatch: boolean }>}
 */
export function getTopQueries({ days = 14, limit = 20 } = {}) {
  if (!fs.existsSync(sessionsDir)) return [];
  const cutoff = new Date(Date.now() - days * MS_PER_DAY).toISOString();
  const counts = new Map(); // normalizedQuery → { raw, count, hasMatch }

  let files;
  try {
    // Only load files whose date portion falls within the requested window.
    // Session files are named SESSION-YYYY-MM-DD.jsonl, so we can derive the
    // earliest expected date and skip files older than the window entirely.
    const cutoffFileDate = new Date(Date.now() - days * MS_PER_DAY).toISOString().slice(0, 10);
    files = fs.readdirSync(sessionsDir).filter(
      (f) => f.startsWith("SESSION-") && f.endsWith(".jsonl") && f.slice(8, 18) >= cutoffFileDate
    );
  }
  catch { return []; }

  for (const f of files) {
    let content;
    try { content = fs.readFileSync(path.join(sessionsDir, f), "utf8"); }
    catch { continue; }
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let row;
      try { row = JSON.parse(trimmed); }
      catch { continue; }
      if (!row.ts || row.ts < cutoff) continue;
      const q = row.query || row.question || row.user_message;
      if (typeof q !== "string" || !q.trim()) continue;
      const norm = q.trim().toLowerCase().slice(0, 200);
      const matchedCount = Number(row.matchedCount ?? row.matches?.length ?? 0);
      const prev = counts.get(norm);
      if (prev) {
        prev.count++;
        if (matchedCount > 0) prev.hasMatch = true;
      } else {
        counts.set(norm, { raw: q.trim().slice(0, 200), count: 1, hasMatch: matchedCount > 0 });
      }
    }
  }

  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((row) => ({ query: row.raw, count: row.count, hasMatch: row.hasMatch }));
}

/**
 * Bundles all analytics for the GET /agent/training-kb/analytics endpoint.
 * Composed from existing helpers + the F4 additions above.
 *
 * @param {{ days?: number, topQueriesLimit?: number }} [opts]
 */
export function getTrainingAnalytics({ days = 14, topQueriesLimit = 20 } = {}) {
  const stats = getTrainingStats();
  return {
    byCategory: stats.byCategory,
    bySource: stats.bySource,
    bySurface: getSurfaceCoverage(),
    retrievalTrend: getRetrievalTrend({ days }),
    topQueries: getTopQueries({ days, limit: topQueriesLimit }),
    conflicts: { count: findAllConflicts().length },
    health: stats.health,
    total: stats.total,
    pending: stats.pending,
    updatedAt: new Date().toISOString(),
  };
}

export function loadPromptSections() {
  const source = fs.readFileSync(chatPromptsPath, "utf8");
  const sections = {};
  const names = ["IDENTITY", "CATALOG", "WORKFLOW", "ACTIONS_DOC"];
  for (const name of names) {
    const marker = `const ${name} = \``;
    const start = source.indexOf(marker);
    if (start < 0) continue;
    const contentStart = start + marker.length;
    const end = source.indexOf("`;", contentStart);
    if (end < 0) continue;
    sections[name] = source.slice(contentStart, end);
  }
  return sections;
}

export function updatePromptSection(sectionName, nextContent) {
  const source = fs.readFileSync(chatPromptsPath, "utf8");
  const target = String(sectionName || "").toUpperCase();
  if (!["IDENTITY", "CATALOG", "WORKFLOW", "ACTIONS_DOC"].includes(target)) {
    throw new Error("Unsupported section");
  }
  const marker = `const ${target} = \``;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`${target} not found`);
  const contentStart = start + marker.length;
  const end = source.indexOf("`;", contentStart);
  if (end < 0) throw new Error(`Could not locate end of ${target}`);

  const currentContent = source.slice(contentStart, end);
  savePromptSectionBackup(target, currentContent);

  const safeContent = String(nextContent || "")
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${");
  const updated =
    source.slice(0, contentStart) +
    safeContent +
    source.slice(end);
  fs.writeFileSync(chatPromptsPath, updated, "utf8");
  return { ok: true, section: target };
}

function savePromptSectionBackup(sectionName, content) {
  ensureDir(backupsDir);
  const backupPath = path.join(backupsDir, `${sectionName}.json`);
  let versions = [];
  try {
    if (fs.existsSync(backupPath)) versions = JSON.parse(fs.readFileSync(backupPath, "utf8"));
    if (!Array.isArray(versions)) versions = [];
  } catch { versions = []; }
  versions.push({ savedAt: new Date().toISOString(), content });
  versions = versions.slice(-3);
  fs.writeFileSync(backupPath, JSON.stringify(versions, null, 2), "utf8");
}

const ALLOWED_PROMPT_SECTIONS = new Set(["IDENTITY", "CATALOG", "WORKFLOW", "ACTIONS_DOC"]);

export function loadPromptSectionHistory(sectionName) {
  const target = String(sectionName || "").toUpperCase();
  if (!ALLOWED_PROMPT_SECTIONS.has(target)) throw new Error("Unsupported section");
  const backupPath = path.join(backupsDir, `${target}.json`);
  try {
    if (!fs.existsSync(backupPath)) return [];
    const versions = JSON.parse(fs.readFileSync(backupPath, "utf8"));
    return Array.isArray(versions) ? versions.map((v, i) => ({
      versionIndex: i,
      savedAt: v.savedAt,
      preview: String(v.content || "").slice(0, 200),
    })).reverse() : [];
  } catch { return []; }
}

export function revertPromptSection(sectionName, versionIndex) {
  const target = String(sectionName || "").toUpperCase();
  if (!ALLOWED_PROMPT_SECTIONS.has(target)) throw new Error("Unsupported section");
  const backupPath = path.join(backupsDir, `${target}.json`);
  if (!fs.existsSync(backupPath)) throw new Error("No backup found");
  const versions = JSON.parse(fs.readFileSync(backupPath, "utf8"));
  if (!Array.isArray(versions) || versions.length === 0) throw new Error("Version not found");
  const fileIndex = versions.length - 1 - Number(versionIndex);
  if (fileIndex < 0 || fileIndex >= versions.length || !versions[fileIndex]) throw new Error("Version not found");
  return updatePromptSection(target, versions[fileIndex].content);
}

export function appendTrainingSessionEvent(event = {}) {
  ensureDir(sessionsDir);
  const stamp = new Date();
  const day = stamp.toISOString().slice(0, 10);
  const filePath = path.join(sessionsDir, `SESSION-${day}.jsonl`);
  const row = { ts: stamp.toISOString(), ...event };
  fs.appendFileSync(filePath, `${JSON.stringify(row)}\n`, "utf8");
  return filePath;
}

export function getTrainingPaths() {
  return { kbPath, sessionsDir, chatPromptsPath, backupsDir, gcs: USE_GCS ? `gs://${GCS_BUCKET}/${GCS_OBJECT}` : null };
}
