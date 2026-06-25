// cannedReplies.js — Chatwoot-style "/" quick replies for the Omni composer.
// Phase 1 is frontend-only: a seed list plus operator-added entries in localStorage.
// (A team-shared library is a deferred backend feature; see the master spec.)

const LS_KEY = "bmc.omni.cannedReplies.v1";

/** Built-in starter replies (Spanish, BMC tone). shortcut is matched after "/". */
export const SEED_REPLIES = [
  { shortcut: "saludo", title: "Saludo inicial", body: "¡Hola! Gracias por escribir a BMC. ¿En qué te puedo ayudar?" },
  { shortcut: "medidas", title: "Pedir medidas", body: "Para cotizarte necesito las medidas (largo y ancho en metros) y el espesor de panel que buscás. ¿Me las pasás?" },
  { shortcut: "envio", title: "Tiempos de envío", body: "Los tiempos de entrega dependen de la zona y el stock. Apenas confirmemos el pedido te doy una fecha estimada." },
  { shortcut: "pago", title: "Formas de pago", body: "Aceptamos transferencia y los medios habituales. El total que te paso es sin IVA; se agrega 22% al final." },
  { shortcut: "gracias", title: "Cierre", body: "¡Gracias por tu consulta! Cualquier cosa quedo a las órdenes." },
];

function readCustom() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((r) => r && r.shortcut && r.body) : [];
  } catch {
    return [];
  }
}

/** All replies: custom first (operator-curated), then seeds, de-duped by shortcut. */
export function getCannedReplies() {
  const custom = readCustom();
  const seen = new Set(custom.map((r) => r.shortcut));
  return [...custom, ...SEED_REPLIES.filter((r) => !seen.has(r.shortcut))];
}

/** Persist a new operator reply (best-effort; ignores quota/availability errors). */
export function addCannedReply({ shortcut, title, body }) {
  if (!shortcut || !body) return getCannedReplies();
  const custom = readCustom().filter((r) => r.shortcut !== shortcut);
  custom.unshift({ shortcut: String(shortcut).trim(), title: title || shortcut, body });
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(custom.slice(0, 50)));
  } catch {
    /* storage unavailable — keep working without persistence */
  }
  return getCannedReplies();
}

/**
 * Detect an active "/query" token at the caret and return matches.
 * Returns { active, query, matches } — active is true only when the text
 * up to `caret` ends with a "/word" not preceded by a non-space character.
 */
export function matchSlashQuery(text, caret, replies = getCannedReplies()) {
  const upto = String(text || "").slice(0, caret ?? (text ? text.length : 0));
  const m = upto.match(/(^|\s)\/([\w-]*)$/);
  if (!m) return { active: false, query: "", matches: [] };
  const query = m[2].toLowerCase();
  const matches = replies.filter(
    (r) => r.shortcut.toLowerCase().includes(query) || r.title.toLowerCase().includes(query),
  );
  return { active: true, query, matches, tokenStart: upto.length - m[2].length - 1 };
}

/** Replace the "/query" token (from tokenStart) with the chosen reply body. */
export function applyReply(text, caret, tokenStart, body) {
  const before = String(text || "").slice(0, tokenStart);
  const after = String(text || "").slice(caret ?? (text ? text.length : 0));
  const joiner = before && !/\s$/.test(before) ? " " : "";
  return `${before}${joiner}${body}${after}`;
}
