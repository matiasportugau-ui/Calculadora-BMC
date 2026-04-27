import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const dataDir = path.join(repoRoot, "data");
const kbPath = path.join(dataDir, "training-kb.json");
const sessionsDir = path.join(dataDir, "training-sessions");
const backupsDir = path.join(dataDir, "prompt-backups");
const chatPromptsPath = path.join(repoRoot, "server/lib/chatPrompts.js");

const KB_VERSION = "1.0.0";

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
      .catch(() => { /* GCS unavailable — fall through to local */ });
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
  const entry = {
    id: crypto.randomUUID(),
    category: normalizeCategory(payload.category),
    question: String(payload.question || "").trim(),
    badAnswer: String(payload.badAnswer || "").trim(),
    goodAnswer: String(payload.goodAnswer || "").trim(),
    context: String(payload.context || "").trim(),
    source: String(payload.source || "manual"),
    permanent: Boolean(payload.permanent),
    status: ["active", "pending", "rejected"].includes(payload.status) ? payload.status : "active",
    confidence: payload.confidence != null ? Number(payload.confidence) : null,
    convId: payload.convId ? String(payload.convId) : null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (!entry.question || !entry.goodAnswer) {
    throw new Error("question and goodAnswer are required");
  }
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
  const next = {
    ...prev,
    category: patch.category ? normalizeCategory(patch.category) : prev.category,
    question: patch.question != null ? String(patch.question).trim() : prev.question,
    badAnswer: patch.badAnswer != null ? String(patch.badAnswer).trim() : prev.badAnswer,
    goodAnswer: patch.goodAnswer != null ? String(patch.goodAnswer).trim() : prev.goodAnswer,
    context: patch.context != null ? String(patch.context).trim() : prev.context,
    permanent: patch.permanent != null ? Boolean(patch.permanent) : prev.permanent,
    status: patch.status && ["active", "pending", "rejected"].includes(patch.status) ? patch.status : prev.status ?? "active",
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

export function findRelevantExamples(query, { limit = 5, scoringConfig } = {}) {
  const cfg = scoringConfig || loadScoringConfig();
  const kb = loadTrainingKB();
  const entries = kb.entries
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
    .slice(0, limit)
    .map((it) => ({ ...it.entry, matchScore: it.score }));
  return entries;
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

export function getTrainingStats() {
  const entries = listTrainingEntries();
  const byCategory = entries.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + 1;
    return acc;
  }, {});
  return {
    total: entries.length,
    byCategory,
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
