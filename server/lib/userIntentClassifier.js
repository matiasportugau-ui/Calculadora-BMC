/**
 * Server-side user intent classifier for the Panelin agent.
 *
 * Reads the LAST USER MESSAGE in a conversation and returns the set of
 * agent tool names the user has explicitly authorized to fire on this turn.
 *
 * The model cannot fabricate this signal — it comes from the user's own
 * words, not from a tool input the model assembles. Replaces the prior
 * theatre where guarded tools accepted a model-set `user_confirmed: true`.
 *
 * Negation handling: if the message contains "no <phrase>" or "sin <phrase>",
 * that specific phrase doesn't count toward intent. Naive but covers the
 * common cases ("no lo guardes en CRM").
 */

const TOOL_INTENT_PATTERNS = {
  guardar_en_crm: [
    /\bguarda(lo)?\s+(en\s+)?crm\b/,
    /\bpega(lo)?\s+(al\s+|en\s+)?crm\b/,
    /\bmete(lo)?\s+(al\s+|en\s+)?crm\b/,
    /\bsuma(lo)?\s+(al\s+|en\s+)?crm\b/,
    /\bagrega(lo)?\s+a\s+(la\s+)?planilla\b/,
    /\banota(lo)?\s+(en\s+)?(el\s+)?crm\b/,
  ],
  enviar_whatsapp_link: [
    /\bmanda(le|lo)?\s+por\s+(wa|whatsapp)\b/,
    /\benvia(lo|le)?\s+por\s+whatsapp\b/,
    /\bmanda(le)?\s+el\s+link\b/,
    /\benvia(lo|le)?\s+al\s+cliente\b/,
    /\bmanda(le|lo)?\s+al\s+(cliente|wa|whatsapp)\b/,
  ],
  cancelar_cotizacion: [
    /\bcancela(r)?\s*(la\s+)?cotizacion\b/,
    /\bborra(r)?\s*(la\s+)?cotizacion\b/,
    /\bel\s+cliente\s+(declin|desisti)/,
    /\bdejar\s+sin\s+efecto\b/,
    /\bdar\s+de\s+baja\s+(la\s+)?cotizacion\b/,
  ],
  programar_seguimiento: [
    /\brecorda(me)?\s+(en|el|la|de)?\b/,
    /\bagenda\s+(seguimiento|recordatorio)/,
    /\bavisa(me)?\s+(en|el|cuando)/,
    /\bpone(le)?\s+recordatorio\b/,
    /\bagregar?\s+seguimiento\b/,
  ],
  wolfboard_sync: [
    /\bsincroniza(r)?\s+(wolfboard)?/,
    /\bpropaga(r)?\s+(las\s+)?respuestas\b/,
    /\bsync\s+wolfboard\b/,
  ],
  wolfboard_actualizar_fila: [
    /\bactualiza(r)?\s+(la\s+)?fila\b/,
    /\bedita(r)?\s+(la\s+)?fila\b/,
    /\bcambia(r)?\s+(la\s+respuesta|el\s+estado)\b/,
    /\bmodifica(r)?\s+(la\s+)?fila\b/,
  ],
  wolfboard_marcar_enviado: [
    /\bmarca(r)?\s+(como\s+)?enviad/,
    /\bya\s+(la\s+)?envie\b/,
    /\b(esta|esto)\s+enviad/,
    /\bmove(r)?\s+a\s+enviados\b/,
  ],
  wolfboard_quote_batch: [
    /\bgenera(r)?\s+(las\s+)?respuestas\b/,
    /\bbatch\s+quoting\b/,
    /\bcotiza(r)?\s+(todas\s+)?las\s+pendientes\b/,
    /\bcotizar\s+pendientes\b/,
    /\bgenera(r)?\s+respuestas\s+(con\s+)?ia\b/,
  ],
};

/**
 * 1-2 phrase summaries surfaced in tool error messages so the model
 * gets actionable feedback when the gate fires.
 */
export const INTENT_HINTS = {
  guardar_en_crm: ["guardalo en CRM", "pegalo al CRM", "agregalo a la planilla"],
  enviar_whatsapp_link: ["mandale por WhatsApp", "envialo al cliente"],
  cancelar_cotizacion: ["cancelá la cotización", "el cliente desistió"],
  programar_seguimiento: ["recordame en X días", "agendá seguimiento"],
  wolfboard_sync: ["sincronizá Wolfboard", "propagá las respuestas"],
  wolfboard_actualizar_fila: ["actualizá la fila X", "editá la respuesta"],
  wolfboard_marcar_enviado: ["marcá como enviada", "ya la envié"],
  wolfboard_quote_batch: ["generá las respuestas con IA", "cotizá todas las pendientes"],
};

/**
 * Strip Spanish accents/diacritics so "cotización" matches "cotizacion" patterns.
 * Also lowercase + collapse whitespace for stable matching.
 */
function normalize(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Strip negation contexts ("no <phrase>", "sin <phrase>") so they don't
 * trigger intent. Stops at Spanish conjunctions (y, pero, aunque, mas, o, ni)
 * so positive intents that follow in the same sentence are preserved —
 * e.g. "no lo guardes en CRM y mandale por WhatsApp" correctly fires only
 * the WhatsApp intent.
 *
 * Idiom guard: "dejar sin efecto" is a fixed Spanish phrase where "sin"
 * doesn't negate intent — it's part of the cancelar_cotizacion trigger.
 * Skip "sin" stripping when preceded by "dejar".
 */
function stripNegations(text) {
  return text
    .replace(/\bno\s+((?!(?:y|pero|aunque|mas|o|ni)\b)\S+\s+){0,6}/g, " ")
    .replace(/(?<!\bdejar\s)\bsin\s+((?!(?:y|pero|aunque|mas|o|ni)\b)\S+\s+){0,6}/g, " ");
}

/**
 * @param {string} lastUserMessage  the most recent user message in the chat
 * @returns {Set<string>} set of approved tool names for this turn
 */
export function classifyIntents(lastUserMessage) {
  const result = new Set();
  if (!lastUserMessage || typeof lastUserMessage !== "string") return result;

  const normalized = normalize(lastUserMessage);
  const denegated = stripNegations(normalized);

  for (const [tool, patterns] of Object.entries(TOOL_INTENT_PATTERNS)) {
    for (const p of patterns) {
      if (p.test(denegated)) {
        result.add(tool);
        break;
      }
    }
  }
  return result;
}

/** Exported for testing / future per-tenant overrides. */
export { TOOL_INTENT_PATTERNS };
