/**
 * Persistent conversation logger for the Panelin AI agent.
 *
 * Stores complete conversations as JSON files in `data/conversations/`.
 * Each conversation has a unique ID and is updated per turn.
 * Provides listing, filtering, and analysis helpers.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const conversationsDir = path.join(repoRoot, "data", "conversations");

/** Maximum length for user messages stored in logs */
const MAX_USER_MESSAGE_LENGTH = 8000;
/** Maximum length for assistant messages stored in logs */
const MAX_ASSISTANT_MESSAGE_LENGTH = 16000;
/** Similarity threshold above which two consecutive messages are considered repetitive */
const REPETITION_SIMILARITY_THRESHOLD = 0.7;
/** Regex to validate conversation IDs — only alphanumeric, hyphens, and underscores */
const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,80}$/;

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

/**
 * Sanitize and validate a conversation ID to prevent path traversal.
 * @param {string} id
 * @returns {string} Safe conversation ID
 * @throws {Error} If the ID is invalid
 */
function sanitizeConversationId(id) {
  const safeId = String(id || "").trim();
  if (!SAFE_ID_PATTERN.test(safeId)) {
    throw new Error("Invalid conversation ID format");
  }
  return safeId;
}

/**
 * Get the file path for a conversation, ensuring it stays within the conversations directory.
 * @param {string} conversationId
 * @returns {string}
 */
function getConversationFilePath(conversationId) {
  const safeId = sanitizeConversationId(conversationId);
  const filePath = path.join(conversationsDir, `${safeId}.json`);
  // Double-check resolved path is within the conversations directory
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(conversationsDir) + path.sep)) {
    throw new Error("Invalid conversation ID — path traversal blocked");
  }
  return filePath;
}

/**
 * Create a new conversation record.
 * @param {{ conversationId?: string, provider?: string, model?: string, devMode?: boolean, origin?: string }} meta
 * @returns {{ id: string, filePath: string }}
 */
export function createConversation(meta = {}) {
  ensureDir(conversationsDir);
  const id = meta.conversationId ? sanitizeConversationId(meta.conversationId) : crypto.randomUUID();
  const now = new Date().toISOString();
  const conversation = {
    id,
    createdAt: now,
    updatedAt: now,
    provider: meta.provider || "unknown",
    model: meta.model || "unknown",
    devMode: Boolean(meta.devMode),
    origin: meta.origin || "",
    turnCount: 0,
    turns: [],
    summary: null,
    analysis: null,
  };
  const filePath = getConversationFilePath(id);
  fs.writeFileSync(filePath, JSON.stringify(conversation, null, 2), "utf8");
  return { id, filePath };
}

/**
 * Append a turn (user question + assistant answer + metadata) to a conversation.
 * Creates the conversation file if it doesn't exist.
 * @param {string} conversationId
 * @param {{ userMessage: string, assistantMessage: string, actions?: object[], kbMatches?: number, calcValidation?: object, provider?: string, model?: string, devMode?: boolean, durationMs?: number }} turn
 * @returns {object} Updated conversation
 */
export function appendTurn(conversationId, turn = {}) {
  ensureDir(conversationsDir);
  const safeId = sanitizeConversationId(conversationId);
  const filePath = getConversationFilePath(safeId);

  let conversation;
  if (fs.existsSync(filePath)) {
    try {
      conversation = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
      conversation = null;
    }
  }

  if (!conversation) {
    conversation = {
      id: safeId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      provider: turn.provider || "unknown",
      model: turn.model || "unknown",
      devMode: Boolean(turn.devMode),
      origin: "",
      turnCount: 0,
      turns: [],
      summary: null,
      analysis: null,
    };
  }

  const turnRecord = {
    turnIndex: conversation.turnCount,
    timestamp: new Date().toISOString(),
    userMessage: String(turn.userMessage || "").slice(0, MAX_USER_MESSAGE_LENGTH),
    assistantMessage: String(turn.assistantMessage || "").slice(0, MAX_ASSISTANT_MESSAGE_LENGTH),
    actions: Array.isArray(turn.actions) ? turn.actions : [],
    kbMatches: Number(turn.kbMatches) || 0,
    calcValidation: turn.calcValidation || null,
    provider: turn.provider || conversation.provider,
    model: turn.model || conversation.model,
    durationMs: Number(turn.durationMs) || 0,
  };

  conversation.turns.push(turnRecord);
  conversation.turnCount = conversation.turns.length;
  conversation.updatedAt = new Date().toISOString();

  // Update provider/model if changed mid-conversation
  if (turn.provider) conversation.provider = turn.provider;
  if (turn.model) conversation.model = turn.model;

  fs.writeFileSync(filePath, JSON.stringify(conversation, null, 2), "utf8");
  return conversation;
}

/**
 * Load a conversation by ID.
 * @param {string} conversationId
 * @returns {object|null}
 */
export function loadConversation(conversationId) {
  try {
    const filePath = getConversationFilePath(conversationId);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

/**
 * List conversations with optional filters.
 * @param {{ limit?: number, offset?: number, since?: string, devMode?: boolean|null, provider?: string }} filters
 * @returns {{ conversations: object[], total: number }}
 */
export function listConversations(filters = {}) {
  ensureDir(conversationsDir);
  const { limit = 50, offset = 0, since, devMode, provider } = filters;

  const files = fs.readdirSync(conversationsDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse(); // newest first by filename (UUID is random, so sort by content)

  const conversations = [];
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(conversationsDir, file), "utf8");
      const conv = JSON.parse(raw);
      if (since && conv.createdAt < since) continue;
      if (devMode != null && conv.devMode !== devMode) continue;
      if (provider && conv.provider !== provider) continue;
      conversations.push(conv);
    } catch {
      // skip corrupt files
    }
  }

  // Sort by updatedAt descending
  conversations.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));

  return {
    conversations: conversations.slice(offset, offset + limit).map((c) => ({
      id: c.id,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      provider: c.provider,
      model: c.model,
      devMode: c.devMode,
      turnCount: c.turnCount,
      hasSummary: !!c.summary,
      hasAnalysis: !!c.analysis,
      // Include first user message as preview
      preview: c.turns?.[0]?.userMessage?.slice(0, 120) || "",
    })),
    total: conversations.length,
  };
}

/**
 * Save analysis/summary to a conversation.
 * @param {string} conversationId
 * @param {{ summary?: string, analysis?: object }} data
 * @returns {object|null}
 */
export function updateConversationMeta(conversationId, data = {}) {
  const conv = loadConversation(conversationId);
  if (!conv) return null;

  if (data.summary !== undefined) conv.summary = data.summary;
  if (data.analysis !== undefined) conv.analysis = data.analysis;
  conv.updatedAt = new Date().toISOString();

  const filePath = getConversationFilePath(conversationId);
  fs.writeFileSync(filePath, JSON.stringify(conv, null, 2), "utf8");
  return conv;
}

/**
 * Build a basic conversation analysis (no AI needed — rule-based).
 * @param {object} conversation
 * @returns {object}
 */
export function analyzeConversation(conversation) {
  if (!conversation?.turns?.length) {
    return { turnCount: 0, strengths: [], issues: [], suggestions: [] };
  }

  const turns = conversation.turns;
  const strengths = [];
  const issues = [];
  const suggestions = [];

  // Metric: turn count
  const turnCount = turns.length;
  if (turnCount >= 3) strengths.push("Conversación sostenida con múltiples turnos");

  // Metric: actions emitted
  const totalActions = turns.reduce((sum, t) => sum + (t.actions?.length || 0), 0);
  if (totalActions > 0) strengths.push(`${totalActions} acciones emitidas (auto-completar calculadora)`);
  if (turnCount >= 4 && totalActions === 0) suggestions.push("Ninguna acción emitida — el bot podría ser más proactivo auto-completando la calculadora");

  // Metric: calc validation
  const validations = turns.filter((t) => t.calcValidation?.available);
  const mismatches = validations.filter((t) => t.calcValidation?.matches === false);
  if (validations.length > 0 && mismatches.length === 0) strengths.push("Validación de cálculo correcta en todos los turnos verificados");
  if (mismatches.length > 0) issues.push(`${mismatches.length} turno(s) con discrepancia en validación de cálculo`);

  // Metric: KB matches
  const kbUsed = turns.filter((t) => t.kbMatches > 0);
  if (kbUsed.length > 0) strengths.push("Se utilizaron ejemplos del KB de entrenamiento");
  if (kbUsed.length === 0 && turnCount >= 2) suggestions.push("Sin coincidencias del KB — considerar agregar ejemplos de entrenamiento relevantes");

  // Metric: repetition detection
  const assistantTexts = turns.map((t) => t.assistantMessage || "");
  const repetitions = detectRepetitions(assistantTexts);
  if (repetitions.length > 0) issues.push(`Respuestas repetitivas detectadas en ${repetitions.length} turno(s)`);

  // Metric: empty/short responses
  const shortResponses = turns.filter((t) => (t.assistantMessage || "").length < 50);
  if (shortResponses.length > 0) issues.push(`${shortResponses.length} respuesta(s) muy cortas (< 50 caracteres)`);

  // Metric: long response time
  const slowTurns = turns.filter((t) => t.durationMs > 15000);
  if (slowTurns.length > 0) issues.push(`${slowTurns.length} turno(s) con latencia alta (> 15s)`);

  // Metric: average response length
  const avgLen = Math.round(assistantTexts.reduce((s, t) => s + t.length, 0) / (assistantTexts.length || 1));

  return {
    turnCount,
    totalActions,
    validationCount: validations.length,
    mismatchCount: mismatches.length,
    kbMatchTurns: kbUsed.length,
    repetitionCount: repetitions.length,
    avgResponseLength: avgLen,
    strengths,
    issues,
    suggestions,
  };
}

/**
 * Detect repetitive patterns across assistant messages.
 * @param {string[]} texts
 * @returns {number[]} Indices of turns that are repetitive
 */
function detectRepetitions(texts) {
  const repetitive = [];
  for (let i = 1; i < texts.length; i++) {
    if (!texts[i] || texts[i].length < 30) continue;
    const similarity = computeSimilarity(texts[i], texts[i - 1]);
    if (similarity > REPETITION_SIMILARITY_THRESHOLD) repetitive.push(i);
  }
  return repetitive;
}

/**
 * Simple Jaccard similarity on 4-gram shingles.
 * @param {string} a
 * @param {string} b
 * @returns {number} 0..1
 */
function computeSimilarity(a, b) {
  if (!a || !b) return 0;
  const shingles = (text) => {
    const s = new Set();
    const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
    for (let i = 0; i <= normalized.length - 4; i++) {
      s.add(normalized.slice(i, i + 4));
    }
    return s;
  };
  const sa = shingles(a);
  const sb = shingles(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let intersection = 0;
  for (const s of sa) {
    if (sb.has(s)) intersection++;
  }
  return intersection / (sa.size + sb.size - intersection);
}

export function getConversationsDir() {
  return conversationsDir;
}
