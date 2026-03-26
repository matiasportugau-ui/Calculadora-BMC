/**
 * Helpers to turn conexion-cuentas-email-agentes-bmc snapshot JSON into
 * POST /api/crm/ingest-email bodies. Pure functions — unit-tested.
 */

/** @param {{ address?: string, name?: string }[]} from */
export function remitenteFromFrom(from) {
  if (!Array.isArray(from) || !from.length) return "";
  const a = from[0]?.address || "";
  const n = from[0]?.name || "";
  if (a && n) return `${n} <${a}>`;
  return a || n || "";
}

export function stableMessageKey(msg) {
  if (msg?.messageId && String(msg.messageId).trim()) return String(msg.messageId).trim();
  if (msg?.accountId != null && msg?.uid != null) return `${msg.accountId}:${msg.uid}`;
  return "";
}

export function stripHtmlMinimal(html) {
  if (!html || typeof html !== "string") return "";
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {{ text?: string, html?: string }} msg
 * @returns {string}
 */
export function cuerpoFromMessage(msg) {
  const t = (msg?.text && String(msg.text).trim()) || "";
  if (t) return t;
  return stripHtmlMinimal(msg?.html || "");
}

/**
 * @param {object} snapshot — snapshot-latest.json (schemaVersion 1)
 * @param {{ category?: string | null, limit?: number, since?: Date | null, processed?: Set<string> }} opts
 *   category: default "ventas"; pass null to skip category filter
 */
export function selectMessagesForIngest(snapshot, opts = {}) {
  const category = opts.category !== undefined ? opts.category : "ventas";
  const limit = Number(opts.limit) > 0 ? Number(opts.limit) : 50;
  const since = opts.since instanceof Date ? opts.since : null;
  const processed = opts.processed instanceof Set ? opts.processed : new Set();

  const messages = Array.isArray(snapshot?.messages) ? snapshot.messages : [];
  const out = [];
  for (const m of messages) {
    if (category != null && String(m?.category || "").toLowerCase() !== String(category).toLowerCase()) {
      continue;
    }
    const key = stableMessageKey(m);
    if (key && processed.has(key)) continue;
    if (since && m?.date) {
      const d = new Date(m.date);
      if (!Number.isNaN(d.getTime()) && d < since) continue;
    }
    const body = cuerpoFromMessage(m);
    if (!body || body.length < 8) continue;
    out.push(m);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * @param {object} msg — snapshot message
 * @returns {{ asunto: string, cuerpo: string, remitente: string, messageId: string }}
 */
export function messageToIngestBody(msg) {
  const key = stableMessageKey(msg);
  return {
    asunto: String(msg?.subject || "").slice(0, 500),
    cuerpo: cuerpoFromMessage(msg),
    remitente: remitenteFromFrom(msg?.from),
    messageId: key,
  };
}
