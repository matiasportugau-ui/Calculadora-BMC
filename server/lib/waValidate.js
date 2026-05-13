/**
 * WA Cockpit — validators puros (sin I/O, fácil de testear desde tests/wa-ingest-contract.js).
 */

const ALLOWED_DIRECTIONS = new Set(["in", "out"]);
const ALLOWED_TYPES = new Set(["text", "image", "audio", "doc", "video", "sticker", "location"]);
const ALLOWED_SOURCES = new Set(["wa_web", "cloud_api", "manual"]);

/**
 * Normaliza un número de teléfono a formato E.164.
 *
 * Reglas (conservadoras para no romper números válidos):
 *  - Strip caracteres no-dígito excepto '+' inicial
 *  - Si la cadena original empezaba con '+', o los dígitos resultantes son >= 10, agrega '+'
 *  - '00XXXX' (marcado internacional alternativo) → '+XXXX'
 *  - Limita a 33 chars ('+' + 32 dígitos máx.)
 *
 * @param {string} raw
 * @returns {string}
 */
export function normalizePhoneE164(raw) {
  const s = String(raw).trim();
  const hasPlus = s.startsWith("+");
  const digits = s.replace(/\D/g, "");
  if (!digits) return digits;

  // Strip leading international dialing prefix "00"
  const clean = digits.startsWith("00") ? digits.slice(2) : digits;

  // If it already had '+', or cleaned digits look like a full international number (≥10 digits)
  if (hasPlus || clean.length >= 10) {
    return ("+" + clean).slice(0, 33);
  }

  // Short local number — no country prefix can be reliably inferred here; return digits only.
  return clean.slice(0, 32);
}

/**
 * Devuelve { valid: boolean, errors: string[], normalized?: NormalizedMessage }
 *
 * @param {any} raw
 * @param {object} [opts]
 * @param {number} [opts.maxTextLen=8000]
 */
export function validateIngestMessage(raw, opts = {}) {
  const maxTextLen = Number(opts.maxTextLen ?? 8000);
  const errors = [];

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { valid: false, errors: ["message must be an object"] };
  }

  const chat_id = String(raw.chat_id || "").trim();
  const msg_id = String(raw.msg_id || "").trim();
  const ts = raw.ts;
  const direction = String(raw.direction || "").trim();
  const type = String(raw.type || "text").trim();
  const source = String(raw.source || "wa_web").trim();
  const text = raw.text == null ? null : String(raw.text);
  const reply_to = raw.reply_to ? String(raw.reply_to) : null;
  const status = raw.status ? String(raw.status) : null;

  if (!chat_id) errors.push("chat_id is required");
  if (chat_id && chat_id.length > 256) errors.push("chat_id too long");
  if (!msg_id) errors.push("msg_id is required");
  if (msg_id && msg_id.length > 256) errors.push("msg_id too long");

  let tsIso = null;
  if (typeof ts === "string" || typeof ts === "number") {
    const d = new Date(ts);
    if (Number.isFinite(d.getTime())) {
      tsIso = d.toISOString();
    }
  }
  if (!tsIso) errors.push("ts must be ISO date or epoch ms");

  if (!ALLOWED_DIRECTIONS.has(direction)) errors.push("direction must be in|out");
  if (!ALLOWED_TYPES.has(type)) errors.push(`type must be one of ${[...ALLOWED_TYPES].join(",")}`);
  if (!ALLOWED_SOURCES.has(source)) errors.push(`source must be one of ${[...ALLOWED_SOURCES].join(",")}`);

  if (text != null && text.length > maxTextLen) errors.push(`text exceeds ${maxTextLen} chars`);

  const phone =
    (raw.from && typeof raw.from === "object" && raw.from.phone ? String(raw.from.phone) : null) ||
    (raw.phone ? String(raw.phone) : null);
  const contactName =
    (raw.from && typeof raw.from === "object" && raw.from.name ? String(raw.from.name) : null) ||
    (raw.contact_name ? String(raw.contact_name) : null);

  const phoneNormalized = phone ? normalizePhoneE164(phone) : null;

  if (errors.length) return { valid: false, errors };

  return {
    valid: true,
    errors: [],
    normalized: {
      chat_id,
      msg_id,
      ts: tsIso,
      direction,
      type,
      source,
      text,
      reply_to,
      status,
      phone: phoneNormalized,
      contact_name: contactName ? contactName.slice(0, 256) : null,
      raw: raw.raw && typeof raw.raw === "object" ? raw.raw : {},
      meta: raw.meta && typeof raw.meta === "object" ? raw.meta : {},
    },
  };
}

/**
 * @param {any} body
 * @returns {{ ok: boolean, errors: string[], messages: any[], live: boolean, operator_id: string|null, batch_id: string|null }}
 */
export function validateIngestBatch(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, errors: ["body must be an object"], messages: [], live: false, operator_id: null, batch_id: null };
  }
  const { messages, live = false, operator_id = null, batch_id = null } = body;
  if (!Array.isArray(messages)) {
    return { ok: false, errors: ["messages must be an array"], messages: [], live: false, operator_id: null, batch_id: null };
  }
  if (messages.length === 0) {
    return { ok: false, errors: ["messages array is empty"], messages: [], live: false, operator_id: null, batch_id: null };
  }
  if (messages.length > 500) {
    return { ok: false, errors: ["batch too large (max 500)"], messages: [], live: false, operator_id: null, batch_id: null };
  }
  return {
    ok: true,
    errors: [],
    messages,
    live: Boolean(live),
    operator_id: operator_id ? String(operator_id).slice(0, 64) : null,
    batch_id: batch_id ? String(batch_id).slice(0, 64) : null,
  };
}
