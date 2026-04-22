import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
export const CONV_DIR = path.join(repoRoot, "data", "conversations");

const HEDGE_PHRASES = [
  "no sé", "no se", "creo que", "me parece", "no estoy seguro",
  "podría ser", "quizás", "tal vez", "no tengo certeza",
  "aproximadamente", "habría que confirmar", "tendría que verificar",
  "no tengo el dato", "depende", "en principio", "debería ser",
];

export function countHedges(text) {
  if (!text) return 0;
  const lower = text.toLowerCase();
  return HEDGE_PHRASES.filter((p) => lower.includes(p)).length;
}

function ensureConvDir() {
  if (!fs.existsSync(CONV_DIR)) fs.mkdirSync(CONV_DIR, { recursive: true });
}

function convFilePath(date) {
  const day = (date || new Date()).toISOString().slice(0, 10);
  return path.join(CONV_DIR, `CONV-${day}.jsonl`);
}

function appendEvent(event) {
  ensureConvDir();
  const row = { ts: new Date().toISOString(), ...event };
  const filePath = convFilePath();
  fs.promises.appendFile(filePath, `${JSON.stringify(row)}\n`, "utf8").catch(() => {});
}

export function logConversationMeta(conversationId, { provider, model, devMode }) {
  appendEvent({ event: "meta", conversationId, provider, model, devMode: !!devMode });
}

export function logConversationTurn(conversationId, { turnIndex, role, content, latencyMs, kbMatchCount, hedgeCount }) {
  appendEvent({
    event: "turn",
    conversationId,
    turnIndex,
    role,
    content: String(content || ""),
    charCount: String(content || "").length,
    ...(latencyMs != null ? { latencyMs } : {}),
    ...(kbMatchCount != null ? { kbMatchCount } : {}),
    ...(hedgeCount != null ? { hedgeCount } : {}),
  });
}

export function logConversationAction(conversationId, { turnIndex, actionType, payload }) {
  appendEvent({ event: "action", conversationId, turnIndex, actionType, payload });
}

export function closeConversation(conversationId, { turnCount, hedgeCount }) {
  appendEvent({ event: "close", conversationId, turnCount, hedgeCount });
}

// ─── Read helpers ────────────────────────────────────────────────────────────

function parseConvFile(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const lines = fs.readFileSync(filePath, "utf8").split("\n").filter(Boolean);
  const events = [];
  for (const line of lines) {
    try { events.push(JSON.parse(line)); } catch { /* skip malformed */ }
  }
  return events;
}

function groupByConversation(events) {
  const map = new Map();
  for (const ev of events) {
    const id = ev.conversationId;
    if (!id) continue;
    if (!map.has(id)) map.set(id, []);
    map.get(id).push(ev);
  }
  return map;
}

function buildConversationFromEvents(id, events) {
  const turns = [];
  const actions = [];
  let provider, model, devMode, startedAt, closedAt, turnCount;
  let totalHedgeCount = 0;

  for (const ev of events) {
    if (!startedAt) startedAt = ev.ts;
    if (ev.event === "meta") {
      provider = ev.provider;
      model = ev.model;
      devMode = ev.devMode;
    } else if (ev.event === "turn") {
      turns.push({
        index: ev.turnIndex,
        ts: ev.ts,
        role: ev.role,
        content: ev.content,
        charCount: ev.charCount,
        ...(ev.latencyMs != null ? { latencyMs: ev.latencyMs } : {}),
        ...(ev.kbMatchCount != null ? { kbMatchCount: ev.kbMatchCount } : {}),
      });
      // Sum hedge counts from each assistant turn for accurate per-conversation total
      if (ev.role === "assistant" && ev.hedgeCount != null) {
        totalHedgeCount += ev.hedgeCount;
      }
    } else if (ev.event === "action") {
      actions.push({ turnIndex: ev.turnIndex, actionType: ev.actionType, payload: ev.payload });
    } else if (ev.event === "close") {
      closedAt = ev.ts;
      turnCount = ev.turnCount;
    }
  }

  return {
    conversationId: id,
    startedAt,
    closedAt,
    provider,
    model,
    devMode: !!devMode,
    turnCount: turnCount ?? turns.length,
    hedgeCount: totalHedgeCount,
    actionsEmitted: [...new Set(actions.map((a) => a.actionType))],
    turns,
    actionsDetail: actions,
  };
}

export function computeResume(conv) {
  const userTurns = conv.turns.filter((t) => t.role === "user");
  const assistantTurns = conv.turns.filter((t) => t.role === "assistant");
  const durationSecs = conv.startedAt && conv.closedAt
    ? Math.round((new Date(conv.closedAt) - new Date(conv.startedAt)) / 1000)
    : null;
  return {
    conversationId: conv.conversationId,
    startedAt: conv.startedAt,
    closedAt: conv.closedAt,
    durationSecs,
    provider: conv.provider,
    model: conv.model,
    devMode: conv.devMode,
    turnCount: conv.turnCount,
    hedgeCount: conv.hedgeCount,
    actionsEmitted: conv.actionsEmitted,
    firstUserMessage: userTurns[0]?.content?.slice(0, 120) || "",
    lastAssistantMessage: assistantTurns[assistantTurns.length - 1]?.content?.slice(0, 120) || "",
    totalUserChars: userTurns.reduce((s, t) => s + (t.charCount || 0), 0),
    totalAssistantChars: assistantTurns.reduce((s, t) => s + (t.charCount || 0), 0),
  };
}

export function loadConversations({ days = 7, page = 1, limit = 20 } = {}) {
  ensureConvDir();
  const allEvents = [];
  const now = new Date();
  for (let d = 0; d < days; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    const fp = convFilePath(date);
    allEvents.push(...parseConvFile(fp));
  }

  const byId = groupByConversation(allEvents);
  const conversations = [];
  for (const [id, events] of byId) {
    conversations.push(buildConversationFromEvents(id, events));
  }
  conversations.sort((a, b) => (b.startedAt || "").localeCompare(a.startedAt || ""));

  const total = conversations.length;
  const offset = (page - 1) * limit;
  const items = conversations.slice(offset, offset + limit);
  return { total, page, limit, items };
}

export function loadConversationById(conversationId) {
  ensureConvDir();
  // Scan ALL daily files and merge events — conversations can span midnight
  const files = fs.readdirSync(CONV_DIR).filter((f) => f.startsWith("CONV-") && f.endsWith(".jsonl")).sort();
  const allEvents = [];
  for (const file of files) {
    const events = parseConvFile(path.join(CONV_DIR, file)).filter((e) => e.conversationId === conversationId);
    if (events.length > 0) allEvents.push(...events);
  }
  if (allEvents.length === 0) return null;
  // Events already include ISO timestamps; ensure chronological ordering for turn reconstruction
  allEvents.sort((a, b) => String(a.ts || "").localeCompare(String(b.ts || "")));
  return buildConversationFromEvents(conversationId, allEvents);
}
