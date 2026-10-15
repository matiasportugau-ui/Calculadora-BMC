/**
 * Normalize operator-voice transcript posts (no PCM, length-capped).
 */

const UUID_RE = /^[a-f0-9-]{36}$/i;
const ROLES = new Set(["user", "assistant", "tool"]);

export function normalizeVoiceLogBody(body = {}) {
  const roleRaw = String(body.role || "").toLowerCase();
  const conv = String(body.conversationId || "").trim();
  const turnN = Number(body.turnIndex);
  return {
    conversationId: UUID_RE.test(conv) ? conv : null,
    sessionId: String(body.sessionId || "").slice(0, 80) || null,
    surface: String(body.surface || "panelin_chat").slice(0, 40) || "panelin_chat",
    channel: "voice",
    role: ROLES.has(roleRaw) ? roleRaw : null,
    content: String(body.content || "").slice(0, 8000),
    tool: String(body.tool || "").slice(0, 80) || null,
    requestId: String(body.requestId || "").slice(0, 80) || null,
    turnIndex: Number.isFinite(turnN) ? turnN : undefined,
  };
}
