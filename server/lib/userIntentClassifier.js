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
  sheets_write_range: [
    /\bescribi(lo|r)?\s+(en\s+)?(la\s+)?planilla\b/,
    /\bpega(lo)?\s+(en\s+)?(admin|crm|la\s+planilla)\b/,
    /\bguarda(lo)?\s+(en\s+)?(la\s+)?planilla\b/,
    /\bescribi(r)?\s+(en\s+)?(admin|crm)\b/,
    /\bconfirma(r)?\s+(la\s+)?escritura\b/,
    /\bsi[,]?\s+escribi(lo)?\b/,
  ],
  wolfboard_quote_batch: [
    /\bgenera(r)?\s+(las\s+)?respuestas\b/,
    /\bbatch\s+quoting\b/,
    /\bcotiza(r)?\s+(todas\s+)?las\s+pendientes\b/,
    /\bcotizar\s+pendientes\b/,
    /\bgenera(r)?\s+respuestas\s+(con\s+)?ia\b/,
  ],
  escribir_crm_taxonomia: [
    /\bclasifica(r)?\s+(esta\s+)?(fila|contacto)\b/,
    /\bguarda(r)?\s+(la\s+)?(taxonomia|clasificacion)\s+(en\s+)?(el\s+)?crm\b/,
    /\betiqueta(r)?\s+(esta\s+)?fila\b/,
    /\bactualiza(r)?\s+(el\s+)?(tipo|tags)\s+(en\s+)?(el\s+)?crm\b/,
    /\bmarca(r)?\s+(como\s+)?(proveedor|cliente)\s+(en\s+)?(el\s+)?crm\b/,
  ],
  email_enviar: [
    /\benvia(r|lo|le)?\s+(el\s+)?(correo|mail|email|respuesta)\b/,
    /\bmanda(r|lo|le)?\s+(el\s+)?(correo|mail|email)\b/,
    /\bsi[,]?\s+envia(lo|le)?\b/,
    /\bconfirma(r)?\s+(el\s+)?envio\b/,
    /\benvia(lo|le)?\s+ya\b/,
  ],
  wa_lead_to_admin: [
    /\bcarga(r|lo)?\s+(al\s+|en\s+)?admin\b/,
    /\bcrea(r)?\s+(la\s+)?(fila|consulta|lead)\b/,
    /\bguarda(lo)?\s+(en\s+)?(admin|wolfboard)\b/,
    /\bwa_lead_to_admin\b/,
    /\bmetelo\s+(al\s+)?admin\b/,
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
  sheets_write_range: ["escribilo en la planilla", "pegá en Admin", "confirmá la escritura", "guardalo en la planilla"],
  escribir_crm_taxonomia: ["clasificá la fila en CRM", "guardá la taxonomía en CRM", "marcá como proveedor en CRM"],
  email_enviar: ["enviá el correo", "mandá el mail", "sí envialo", "confirmá el envío"],
  wa_lead_to_admin: ["cargalo al Admin", "creá la consulta", "guardalo en Admin"],
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
 * trigger intent. The window stops at the next conjunction (y, o, pero,
 * mientras) or punctuation (`,;.!?`) so a mixed instruction like
 * "no lo guardes en CRM y mandale por WhatsApp" loses only the first
 * clause — the WhatsApp trigger after `y` survives. (Copilot finding.)
 *
 * Idiom guard: "dejar sin efecto" is a fixed Spanish phrase where "sin"
 * doesn't negate intent — skip "sin" stripping when preceded by "dejar".
 */
function stripNegations(text) {
  // Word match excludes terminator chars (`,;.!?`) so the non-greedy `+?`
  // actually stops at the first one. Earlier `\S+` swallowed the comma in
  // "no canceles, mandale por WA" which broke the "WA after comma survives"
  // case. STOP lookahead enforces the negation window ends at a terminator
  // or conjunction (y / o / pero / mientras).
  const WORD = "[^\\s,;.!?]+";
  const STOP = "(?=$|[,;.!?]|\\by\\b|\\bo\\b|\\bpero\\b|\\bmientras\\b)";
  return text
    .replace(new RegExp(`\\bno\\s+(?:${WORD}\\s*)+?${STOP}`, "g"), " ")
    .replace(new RegExp(`(?<!\\bdejar\\s)\\bsin\\s+(?:${WORD}\\s*)+?${STOP}`, "g"), " ");
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
