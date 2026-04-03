import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const dataDir = path.join(repoRoot, "data");
const kbPath = path.join(dataDir, "training-kb.json");
const sessionsDir = path.join(dataDir, "training-sessions");
const chatPromptsPath = path.join(repoRoot, "server/lib/chatPrompts.js");

const KB_VERSION = "1.0.0";

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function ensureKbFile() {
  ensureDir(dataDir);
  if (fs.existsSync(kbPath)) return;
  const initial = {
    version: KB_VERSION,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    entries: [],
  };
  fs.writeFileSync(kbPath, JSON.stringify(initial, null, 2), "utf8");
}

function normalizeCategory(category) {
  const value = String(category || "conversational").trim().toLowerCase();
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

export function loadTrainingKB() {
  ensureKbFile();
  try {
    const raw = fs.readFileSync(kbPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.entries)) throw new Error("Invalid KB shape");
    return parsed;
  } catch {
    ensureKbFile();
    const fallback = fs.readFileSync(kbPath, "utf8");
    return JSON.parse(fallback);
  }
}

export function saveTrainingKB(kb) {
  ensureKbFile();
  const safe = {
    version: KB_VERSION,
    createdAt: kb.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    entries: Array.isArray(kb.entries) ? kb.entries : [],
  };
  fs.writeFileSync(kbPath, JSON.stringify(safe, null, 2), "utf8");
  return safe;
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

export function findRelevantExamples(query, { limit = 5 } = {}) {
  const kb = loadTrainingKB();
  const entries = kb.entries
    .map((entry) => {
      const score =
        (entry.permanent ? 100 : 0) +
        scoreOverlap(query, entry.question) * 3 +
        scoreOverlap(query, entry.context) +
        scoreOverlap(query, entry.goodAnswer);
      return { entry, score };
    })
    .filter((it) => it.score > 0)
    .sort((a, b) => b.score - a.score || b.entry.updatedAt.localeCompare(a.entry.updatedAt))
    .slice(0, limit)
    .map((it) => ({ ...it.entry, matchScore: it.score }));
  return entries;
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

export function appendTrainingSessionEvent(event = {}) {
  ensureDir(sessionsDir);
  const stamp = new Date();
  const day = stamp.toISOString().slice(0, 10);
  const filePath = path.join(sessionsDir, `SESSION-${day}.jsonl`);
  const row = {
    ts: stamp.toISOString(),
    ...event,
  };
  fs.appendFileSync(filePath, `${JSON.stringify(row)}\n`, "utf8");
  return filePath;
}

export function getTrainingPaths() {
  return { kbPath, sessionsDir, chatPromptsPath };
}
