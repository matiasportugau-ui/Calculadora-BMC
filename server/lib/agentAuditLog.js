/**
 * agentAuditLog — durable, structured audit trail for agent tool calls.
 *
 * Every agent-driven tool invocation (in-app Panelin chat-loop OR external
 * MCP `/api/agent/exec-tool`) emits one JSON line to stdout with a stable
 * shape so Cloud Logging / log scrapers can index it. Survives Cloud Run
 * cold-starts (the in-memory ring buffer in `toolStats.js` does not).
 *
 * Filter in Cloud Logging:
 *   jsonPayload.event="agent_tool_audit"
 *
 * Why this is separate from `toolStats.js`:
 *   - toolStats: per-process aggregates (count, p50/p95) for the dev panel
 *   - agentAuditLog: durable per-call records for compliance / forensics
 *
 * Inputs are *redacted* before logging:
 *   - free-text fields (mensaje, consulta, observaciones, …) → length only
 *   - identifying tokens (telefono, rut, pdf_id) → SHA-256 first 12 chars
 *   - auth bearer token (caller) → SHA-256 first 12 chars (fingerprint)
 *
 * Schema of each line:
 *   {
 *     event: "agent_tool_audit",
 *     timestamp: ISO 8601,
 *     tool: string,
 *     source: "chat" | "mcp",
 *     caller: string|null,        // "chat:<sessionId|null>" or "mcp:<token_fp>"
 *     ok: boolean,
 *     error_class: string|null,   // when !ok
 *     duration_ms: number,
 *     input_summary: object,      // redacted
 *     request_id: string|null,
 *   }
 */
import { createHash } from "node:crypto";

// Free-text fields we never want in plaintext logs. We replace each with
// `{<key>_len: N}` so analytics can still see "the message was 240 chars"
// without storing the message itself.
const FREE_TEXT_FIELDS = new Set([
  "mensaje", "consulta", "respuesta", "observaciones",
  "motivo", "comentario", "nota", "mensaje_cliente",
  "texto", "message", "body",
]);

// Identifying tokens — replace with SHA-256 first 12 chars so we can
// correlate without re-deriving the value.
const IDENTIFYING_FIELDS = new Set([
  "telefono", "rut", "pdf_id", "drive_id", "client_id",
  "session_id", "to", "phone", "email", "cuit",
]);

const MAX_STRING = 80; // truncate any other string this long

function fingerprint(value) {
  if (!value) return null;
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 12);
}

function summarizeInput(input) {
  if (input === null || input === undefined) return null;
  if (typeof input !== "object") return { _type: typeof input };
  const out = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === null || v === undefined) continue;
    if (FREE_TEXT_FIELDS.has(k)) {
      const len = typeof v === "string" ? v.length : JSON.stringify(v).length;
      out[`${k}_len`] = len;
      continue;
    }
    if (IDENTIFYING_FIELDS.has(k)) {
      out[`${k}_fp`] = fingerprint(v);
      continue;
    }
    if (typeof v === "string") {
      out[k] = v.length > MAX_STRING ? v.slice(0, MAX_STRING) + "…" : v;
      continue;
    }
    if (typeof v === "number" || typeof v === "boolean") {
      out[k] = v;
      continue;
    }
    if (Array.isArray(v)) {
      out[`${k}_count`] = v.length;
      continue;
    }
    if (typeof v === "object") {
      // shallow recursion — keep keys, redact same way; never go deeper
      // than 2 levels (calc inputs nest cliente/proyecto/techo).
      out[k] = summarizeShallow(v);
      continue;
    }
  }
  return out;
}

function summarizeShallow(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    if (FREE_TEXT_FIELDS.has(k)) { out[`${k}_len`] = String(v).length; continue; }
    if (IDENTIFYING_FIELDS.has(k)) { out[`${k}_fp`] = fingerprint(v); continue; }
    if (typeof v === "object") { out[k] = "<obj>"; continue; }
    if (typeof v === "string" && v.length > MAX_STRING) { out[k] = v.slice(0, MAX_STRING) + "…"; continue; }
    out[k] = v;
  }
  return out;
}

/**
 * Record a single agent tool invocation.
 *
 * @param {object} entry
 * @param {string} entry.tool          tool name (e.g. "calcular_cotizacion")
 * @param {"chat"|"mcp"} entry.source  invocation surface
 * @param {string|null} [entry.caller] session id (chat) or token fingerprint (mcp)
 * @param {object|null} [entry.input]  raw tool input — will be redacted
 * @param {boolean} entry.ok           whether the call succeeded
 * @param {string|null} [entry.error_class]  short error category (matches toolStats classes)
 * @param {number} entry.duration_ms   wall-clock duration in ms
 * @param {string|null} [entry.request_id]   express req.id when available
 * @param {(line:string)=>void} [sink]  test seam — defaults to console.log
 */
export function recordAgentToolCall(entry, sink = defaultSink) {
  const line = {
    event: "agent_tool_audit",
    timestamp: new Date().toISOString(),
    tool: String(entry.tool || ""),
    source: entry.source === "mcp" ? "mcp" : "chat",
    caller: entry.caller || null,
    ok: !!entry.ok,
    error_class: entry.ok ? null : (entry.error_class || "unknown"),
    duration_ms: Math.max(0, Math.round(Number(entry.duration_ms) || 0)),
    input_summary: summarizeInput(entry.input),
    request_id: entry.request_id || null,
  };
  try {
    sink(JSON.stringify(line));
  } catch {
    // never let audit logging break the caller
  }
}

function defaultSink(s) {
  // Cloud Run captures stdout as structured logs when payload is JSON.
  // Use a single plain console.log so log routers don't re-wrap it.
  // eslint-disable-next-line no-console
  console.log(s);
}

/**
 * Compute a non-reversible fingerprint of a Bearer token for the `caller`
 * field. Returns null if no token / empty string.
 */
export function bearerFingerprint(authHeader) {
  if (!authHeader || typeof authHeader !== "string") return null;
  const trimmed = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader.trim();
  if (!trimmed) return null;
  return fingerprint(trimmed);
}

// Exposed for tests
export const __testing = { summarizeInput, summarizeShallow, fingerprint };
